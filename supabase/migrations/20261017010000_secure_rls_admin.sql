-- ==========================================================================
-- SEGURANÇA DO BANCO (v.1.7.0)
-- * Noivos (Supabase Auth, e-mails autorizados) têm acesso total.
-- * Convidados (anon) podem: ler presentes/mensagens/configurações,
--   reservar presentes disponíveis, contribuir em cotas (append-only),
--   enviar mensagens e confirmar presença.
-- * Convidados NÃO podem: criar, excluir ou editar dados dos presentes,
--   desfazer reservas, alterar configurações ou ler RSVPs.
-- ==========================================================================

-- 1. Quem é administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(lower(auth.jwt() ->> 'email'), '') IN (
    'matheus.h.h@hotmail.com',
    'rhebecamendonca@gmail.com'
  );
$$;

-- 2. Remove TODAS as políticas existentes (abertas ou antigas) nas tabelas do casamento
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('gifts', 'messages', 'rsvps', 'settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 3. PRESENTES
DROP POLICY IF EXISTS gifts_select_public ON public.gifts;
CREATE POLICY gifts_select_public ON public.gifts FOR SELECT USING (true);

DROP POLICY IF EXISTS gifts_admin_all ON public.gifts;
CREATE POLICY gifts_admin_all ON public.gifts FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Convidados só atualizam; o gatilho abaixo limita o que pode mudar
DROP POLICY IF EXISTS gifts_guest_update ON public.gifts;
CREATE POLICY gifts_guest_update ON public.gifts FOR UPDATE
  USING (status <> 'trash') WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.guard_guest_gift_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  guest_fields TEXT[] := ARRAY['status', 'reserved_by', 'guest_phone', 'guest_message', 'reserved_at',
                               'quota_current', 'amount_raised', 'contributions', 'updated_at'];
  old_n INT := COALESCE(jsonb_array_length(OLD.contributions), 0);
  new_n INT := COALESCE(jsonb_array_length(NEW.contributions), 0);
  old_prefix JSONB;
BEGIN
  -- Noivos, service_role e SQL Editor passam livremente
  IF public.is_admin() OR auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Sincronização sem mudança real
  IF (to_jsonb(NEW) - 'updated_at') = (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NEW;
  END IF;

  -- Dados cadastrais do presente são exclusivos dos noivos
  IF (to_jsonb(NEW) - guest_fields) IS DISTINCT FROM (to_jsonb(OLD) - guest_fields) THEN
    RAISE EXCEPTION 'Somente os noivos podem editar os dados deste presente.' USING ERRCODE = '42501';
  END IF;

  IF NOT OLD.is_cota THEN
    -- Presente físico: apenas reservar um item disponível
    IF OLD.status = 'available'
       AND NEW.status = 'pending_approval'
       AND COALESCE(btrim(NEW.reserved_by), '') <> ''
       AND NEW.contributions IS NOT DISTINCT FROM OLD.contributions
       AND NEW.quota_current IS NOT DISTINCT FROM OLD.quota_current
       AND NEW.amount_raised IS NOT DISTINCT FROM OLD.amount_raised THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Este presente não está mais disponível para reserva.' USING ERRCODE = '42501';
  END IF;

  -- Cota: somente acrescentar contribuições, sem apagar ou alterar as anteriores
  SELECT COALESCE(jsonb_agg(e ORDER BY i), '[]'::jsonb) INTO old_prefix
  FROM jsonb_array_elements(COALESCE(NEW.contributions, '[]'::jsonb)) WITH ORDINALITY AS t(e, i)
  WHERE i <= old_n;

  IF new_n > old_n
     AND old_prefix = COALESCE(OLD.contributions, '[]'::jsonb)
     AND COALESCE(NEW.quota_current, 0) >= COALESCE(OLD.quota_current, 0)
     AND COALESCE(NEW.amount_raised, 0) >= COALESCE(OLD.amount_raised, 0)
     AND NEW.status IN (OLD.status, 'completed')
     AND OLD.status IN ('available', 'completed')
     AND NEW.reserved_by IS NOT DISTINCT FROM OLD.reserved_by
     AND NEW.guest_phone IS NOT DISTINCT FROM OLD.guest_phone
     AND NEW.guest_message IS NOT DISTINCT FROM OLD.guest_message
     AND NEW.reserved_at IS NOT DISTINCT FROM OLD.reserved_at THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Contribuição inválida para esta cota.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_guest_gift_update ON public.gifts;
CREATE TRIGGER trg_guard_guest_gift_update
BEFORE UPDATE ON public.gifts
FOR EACH ROW
EXECUTE FUNCTION public.guard_guest_gift_update();

-- 4. MENSAGENS: leitura pública, convidados apenas inserem
DROP POLICY IF EXISTS messages_select_public ON public.messages;
CREATE POLICY messages_select_public ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS messages_guest_insert ON public.messages;
CREATE POLICY messages_guest_insert ON public.messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS messages_admin_all ON public.messages;
CREATE POLICY messages_admin_all ON public.messages FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. RSVPs: convidados apenas inserem; leitura e gestão só dos noivos (dados pessoais)
DROP POLICY IF EXISTS rsvps_guest_insert ON public.rsvps;
CREATE POLICY rsvps_guest_insert ON public.rsvps FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS rsvps_admin_all ON public.rsvps;
CREATE POLICY rsvps_admin_all ON public.rsvps FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. CONFIGURAÇÕES: leitura pública, escrita só dos noivos
DROP POLICY IF EXISTS settings_select_public ON public.settings;
CREATE POLICY settings_select_public ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS settings_admin_all ON public.settings;
CREATE POLICY settings_admin_all ON public.settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Conferência: deve listar apenas as políticas criadas acima
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('gifts', 'messages', 'rsvps', 'settings')
ORDER BY tablename, policyname;
