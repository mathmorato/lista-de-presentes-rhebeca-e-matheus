-- ==============================================================================
-- LISTA DE PRESENTES DE CASAMENTO - RHEBECA & MATHEUS
-- Data do Casamento: 09/01/2027 • São Luís de Montes Belos - GO
-- Script de Configuração Completa do Supabase (PostgreSQL)
-- Versão: v.1.2.2
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

-- ==============================================================================
-- CARGA INICIAL DE PRESENTES DO CATÁLOGO DE CASAMENTO
-- ==============================================================================
INSERT INTO public.gifts (id, title, category, price, is_cota, status, is_featured, description, image_url, product_url, updated_at)
VALUES
  ('gift_1', 'Faqueiro 101 Peças em Aço Inox Nobre', 'cozinha', 850.00, false, 'available', true, 'Conjunto completo de talheres em aço inox com acabamento espelhado e estojo nobre.', 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80', 'https://www.amazon.com.br', now()),
  ('gift_2', 'Jogo de Panelas Cerâmica Antiaderente Verde Oliva', 'cozinha', 1200.00, false, 'available', true, 'Linha premium em cerâmica atóxica com pegadores em aço escovado e tampas de vidro temperado.', 'https://images.unsplash.com/photo-1556911073-38141963c9e0?auto=format&fit=crop&w=600&q=80', 'https://www.magazineluiza.com.br', now()),
  ('gift_3', 'Cafeteira Espresso para Grãos e Cápsulas', 'eletro', 1450.00, false, 'available', true, 'Bomba italiana de 19 bar com vaporizador integrado para expressos, cappuccinos e lattes cremosos.', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80', 'https://www.mercadolivre.com.br', now()),
  ('gift_4', 'Jogo de Cama 400 Fios Cetim de Algodão Egípcio', 'quarto', 680.00, false, 'available', false, 'Toque acetinado ultra macio na tonalidade pérola com detalhes elegantes em ponto ajour.', 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_5', 'Fritadeira Elétrica Air Fryer Digital 5.5L', 'eletro', 520.00, false, 'available', false, 'Painel digital sensível ao toque, cesto antiaderente e acabamento em inox escovado.', 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_6', 'Aparelho de Jantar 30 Peças em Porcelana', 'sala', 980.00, false, 'available', false, 'Porcelana nobre esmaltada com suave filete dourado fosco e pratos de sobremesa refinados.', 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_7', 'Aspirador de Pó Robô Inteligente com Mop', 'eletro', 1600.00, false, 'available', false, 'Mapeamento a laser, controle por aplicativo e função simultânea de varrer e passar pano.', 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_8', 'Conjunto de Taças de Cristal Lapidado para Vinho e Brinde', 'cozinha', 420.00, false, 'available', false, 'Cristal com titânio de alta resistência e sonoridade impecável para celebrações especiais.', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_cota_1', 'Cotas para Passagens Aéreas da Lua de Mel', 'cotas', 4000.00, true, 'available', true, 'Ajude os noivos a voarem rumo ao destino dos sonhos para celebrar o início dessa nova família.', 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_cota_2', 'Jantar Romântico à Luz de Velas na Lua de Mel', 'cotas', 1500.00, true, 'available', false, 'Uma experiência gastronômica inesquecível e intimista para os recém-casados.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80', '', now()),
  ('gift_cota_3', 'Passeio de Barco e Mergulho no Paraíso', 'cotas', 2000.00, true, 'available', false, 'Dia de aventura e passeios pelas águas cristalinas para colecionar memórias inesquecíveis.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', '', now())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  is_cota = EXCLUDED.is_cota,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  product_url = EXCLUDED.product_url,
  is_featured = EXCLUDED.is_featured,
  updated_at = EXCLUDED.updated_at;

-- Configurar cotas específicas para os presentes do tipo cota
UPDATE public.gifts SET quota_value = 200, quota_total = 20, quota_current = 8, amount_raised = 1600 WHERE id = 'gift_cota_1';
UPDATE public.gifts SET quota_value = 150, quota_total = 10, quota_current = 3, amount_raised = 450 WHERE id = 'gift_cota_2';
UPDATE public.gifts SET quota_value = 100, quota_total = 20, quota_current = 5, amount_raised = 500 WHERE id = 'gift_cota_3';
