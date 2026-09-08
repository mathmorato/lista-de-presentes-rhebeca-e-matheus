-- ==============================================================================
-- LISTA DE PRESENTES DE CASAMENTO - RHEBECA & MATHEUS
-- Data do Casamento: 09/01/2027 • São Luís de Montes Belos - GO
-- Script de Configuração Completa do Supabase (PostgreSQL)
-- Versão: v.1.4.8
-- ==============================================================================
-- PARÂMETROS FIXOS DO PROJETO:
-- URL: https://ttggcvricfkoqlorbmnv.supabase.co
-- Anon/Public Key: sb_publishable_vBEg1W6vNGeP2Ia2Fv9DuA_2YxFXirN
-- Connection String: postgresql://postgres:[Mhmm*2738]@db.ttggcvricfkoqlorbmnv.supabase.co:5432/postgres
-- CLI Setup:
--   supabase login
--   supabase init
--   supabase link --project-ref ttggcvricfkoqlorbmnv
-- ==============================================================================
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Acesse o painel do seu projeto Supabase (https://supabase.com/dashboard).
-- 2. No menu lateral esquerdo, clique no ícone "SQL Editor" (ou pressione Shift + S).
-- 3. Clique em "+ New query".
-- 4. Cole todo o conteúdo deste arquivo e clique no botão verde "Run" (ou Ctrl + Enter).
-- 5. Pronto! Todas as tabelas, permissões públicas e canais em tempo real estarão ativos.
-- ==============================================================================

-- 1. TABELA DE PRESENTES E COTAS FINANCEIRAS
CREATE TABLE IF NOT EXISTS public.gifts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'cozinha',
    price NUMERIC DEFAULT 0,
    is_cota BOOLEAN DEFAULT false,
    quota_value NUMERIC,
    quota_total INTEGER,
    quota_current INTEGER DEFAULT 0,
    amount_raised NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'available',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    product_url TEXT DEFAULT '',
    is_featured BOOLEAN DEFAULT false,
    reserved_by TEXT,
    guest_phone TEXT,
    guest_message TEXT,
    reserved_at TIMESTAMPTZ,
    contributions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DO MURAL DE MENSAGENS E FELICITAÇÕES
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    gift_title TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE CONFIRMAÇÕES DE PRESENÇA (RSVP)
CREATE TABLE IF NOT EXISTS public.rsvps (
    id TEXT PRIMARY KEY,
    guest_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    companions INTEGER DEFAULT 0,
    status TEXT DEFAULT 'confirmed',
    dietary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE CONFIGURAÇÕES DOS NOIVOS
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- POLÍTICAS DE ACESSO (ROW LEVEL SECURITY - RLS)
-- Permite leitura e escrita seguras tanto para convidados quanto para os noivos
-- ==============================================================================

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar duplicidade
DROP POLICY IF EXISTS "Acesso público total a gifts" ON public.gifts;
DROP POLICY IF EXISTS "Acesso público total a messages" ON public.messages;
DROP POLICY IF EXISTS "Acesso público total a rsvps" ON public.rsvps;
DROP POLICY IF EXISTS "Acesso público total a settings" ON public.settings;

-- Criar políticas universais para anon e authenticated
CREATE POLICY "Acesso público total a gifts" ON public.gifts 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acesso público total a messages" ON public.messages 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acesso público total a rsvps" ON public.rsvps 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acesso público total a settings" ON public.settings 
    FOR ALL USING (true) WITH CHECK (true);

-- Conceder privilégios aos papéis da API Supabase
GRANT ALL ON TABLE public.gifts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rsvps TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.settings TO anon, authenticated, service_role;

-- ==============================================================================
-- ATIVAÇÃO DO SUPABASE REALTIME
-- Transmite adições, edições e reservas instantaneamente para todos os visitantes
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gifts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rsvps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
  END IF;
END $$;
