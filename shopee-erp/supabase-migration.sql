-- ============================================================
-- SHOPEE ERP MASTER — SQL Migration para Supabase
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- Tabela de Ads (se não existir)
CREATE TABLE IF NOT EXISTS ads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data date NOT NULL,
  loja text NOT NULL,
  produto text NOT NULL,
  investimento numeric(10,2) DEFAULT 0,
  vendas_geradas numeric(10,2) DEFAULT 0,
  roas numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Garantir colunas corretas em estoque
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS sku_base text;
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS produto text;
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS estoque_atual integer DEFAULT 0;
ALTER TABLE estoque ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0;

-- Garantir colunas corretas em sku_map
ALTER TABLE sku_map ADD COLUMN IF NOT EXISTS sku_venda text;
ALTER TABLE sku_map ADD COLUMN IF NOT EXISTS sku_base text;
ALTER TABLE sku_map ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT 1;

-- Garantir colunas corretas em vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS loja text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS pedido text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS sku_venda text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT 1;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_venda numeric(10,2) DEFAULT 0;

-- Garantir colunas corretas em movimentacoes
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('ENTRADA', 'VENDA', 'AJUSTE'));
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS sku_base text;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT 0;
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS origem text DEFAULT 'Manual';
ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS observacao text DEFAULT '';

-- Garantir colunas corretas em financeiro
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS pedido text;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS data date;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS produto text;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT 1;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS valor_bruto numeric(10,2) DEFAULT 0;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS desconto numeric(10,2) DEFAULT 0;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS frete numeric(10,2) DEFAULT 0;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS comissao_shopee numeric(10,2) DEFAULT 0;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS taxas_shopee numeric(10,2) DEFAULT 0;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS valor_liquido numeric(10,2) DEFAULT 0;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS loja text;

-- ============================================================
-- DADOS DE EXEMPLO — Mapa de SKUs
-- ============================================================
INSERT INTO sku_map (sku_venda, sku_base, quantidade) VALUES
  ('FM50', 'FORMA', 1),
  ('FM100', 'FORMA', 2),
  ('FM200', 'FORMA', 4),
  ('FM300', 'FORMA', 6),
  ('KIT2TP', 'TAPETES', 2),
  ('KIT3TP', 'TAPETES', 3),
  ('KIT4TP', 'TAPETES', 4),
  ('KIT120', 'SAQUINHO', 6),
  ('KIT240', 'SAQUINHO', 12),
  ('KIT480', 'SAQUINHO', 24),
  ('KIT120B', 'SAQUINHO', 6),
  ('KIT120B', 'PORTASAQUINHO', 1),
  ('KIT240B', 'SAQUINHO', 12),
  ('KIT240B', 'PORTASAQUINHO', 1),
  ('KIT480B', 'SAQUINHO', 24),
  ('KIT480B', 'PORTASAQUINHO', 1)
ON CONFLICT DO NOTHING;

-- Estoque inicial de exemplo
INSERT INTO estoque (sku_base, produto, estoque_atual, estoque_minimo) VALUES
  ('FORMA', 'Forma de Gelo', 100, 20),
  ('TAPETES', 'Tapetes', 50, 10),
  ('SAQUINHO', 'Saquinho', 500, 100),
  ('PORTASAQUINHO', 'Porta Saquinho', 30, 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY — Permite acesso autenticado
-- ============================================================
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

-- Policies: usuário autenticado pode tudo
CREATE POLICY "auth_all_estoque" ON estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_sku_map" ON sku_map FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_vendas" ON vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_movimentacoes" ON movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_financeiro" ON financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ads" ON ads FOR ALL TO authenticated USING (true) WITH CHECK (true);
