-- ==========================================================================
-- SCHEMA POSTGRESQL / SUPABASE: LISTA DE PRESENTES RHEBECA & MATHEUS (v.1.0.0)
-- ==========================================================================

-- 1. TABELA DE PRESENTES E COTAS
CREATE TABLE IF NOT EXISTS public.gifts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    is_cota BOOLEAN NOT NULL DEFAULT false,
    quota_value NUMERIC,
    quota_total INTEGER,
    quota_current INTEGER DEFAULT 0,
    amount_raised NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available', -- 'available', 'reserved', 'completed'
    description TEXT,
    image_url TEXT,
    product_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    reserved_by TEXT,
    guest_phone TEXT,
    guest_message TEXT,
    reserved_at TIMESTAMPTZ,
    contributions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE MENSAGENS DE FELICITAÇÕES DOS CONVIDADOS
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    gift_title TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE CONFIRMAÇÃO DE PRESENÇA (RSVP)
CREATE TABLE IF NOT EXISTS public.rsvps (
    id TEXT PRIMARY KEY,
    guest_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    companions INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'declined'
    dietary TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA DE CONFIGURAÇÕES DO CASAMENTO
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. HABILITAR ROW LEVEL SECURITY (RLS) COM POLÍTICAS PÚBLICAS (ANON)
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso irrestrito para convidados e noivos (anon role)
DROP POLICY IF EXISTS "Permitir leitura pública de presentes" ON public.gifts;
CREATE POLICY "Permitir leitura pública de presentes" ON public.gifts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita pública de presentes" ON public.gifts;
CREATE POLICY "Permitir escrita pública de presentes" ON public.gifts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura pública de mensagens" ON public.messages;
CREATE POLICY "Permitir leitura pública de mensagens" ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita pública de mensagens" ON public.messages;
CREATE POLICY "Permitir escrita pública de mensagens" ON public.messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura pública de rsvps" ON public.rsvps;
CREATE POLICY "Permitir leitura pública de rsvps" ON public.rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita pública de rsvps" ON public.rsvps;
CREATE POLICY "Permitir escrita pública de rsvps" ON public.rsvps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura pública de settings" ON public.settings;
CREATE POLICY "Permitir leitura pública de settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escrita pública de settings" ON public.settings;
CREATE POLICY "Permitir escrita pública de settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.gifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
