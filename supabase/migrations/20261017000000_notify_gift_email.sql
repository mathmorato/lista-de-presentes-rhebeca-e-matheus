-- ==========================================================================
-- NOTIFICAÇÃO POR E-MAIL DE PRESENTES E COTAS (v.1.6.8)
-- Chama a Edge Function notify-gift via pg_net quando:
--   * um presente físico passa para 'pending_approval' (reserva de convidado)
--   * o array contributions de uma cota ganha novas contribuições
-- A URL e o segredo ficam no Supabase Vault (não versionados):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-gift', 'notify_gift_url');
--   select vault.create_secret('<mesmo NOTIFY_SECRET da função>', 'notify_gift_secret');
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_gift_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  fn_url TEXT;
  fn_secret TEXT;
  old_count INT := COALESCE(jsonb_array_length(OLD.contributions), 0);
  new_count INT := COALESCE(jsonb_array_length(NEW.contributions), 0);
  i INT;
BEGIN
  SELECT decrypted_secret INTO fn_url FROM vault.decrypted_secrets WHERE name = 'notify_gift_url';
  SELECT decrypted_secret INTO fn_secret FROM vault.decrypted_secrets WHERE name = 'notify_gift_secret';
  IF fn_url IS NULL OR fn_secret IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reserva de presente físico feita por convidado
  IF NEW.status = 'pending_approval' AND OLD.status IS DISTINCT FROM 'pending_approval' THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', fn_secret),
      body := jsonb_build_object('kind', 'gift', 'gift', to_jsonb(NEW))
    );
  END IF;

  -- Novas contribuições em cotas (uma notificação por contribuição)
  IF new_count > old_count THEN
    FOR i IN old_count .. new_count - 1 LOOP
      PERFORM net.http_post(
        url := fn_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', fn_secret),
        body := jsonb_build_object(
          'kind', 'cota',
          'gift', to_jsonb(NEW) - 'contributions',
          'contribution', NEW.contributions -> i
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_gift_event ON public.gifts;
CREATE TRIGGER trg_notify_gift_event
AFTER UPDATE ON public.gifts
FOR EACH ROW
EXECUTE FUNCTION public.notify_gift_event();
