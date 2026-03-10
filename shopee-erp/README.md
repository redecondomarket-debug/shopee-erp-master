# 🛍️ Shopee ERP Master

Sistema de gestão completo para vendedores da Shopee.

## 🚀 Setup em 5 passos

### 1. Configurar Supabase

Execute o arquivo `supabase-migration.sql` no **SQL Editor** do Supabase:
- Acesse seu projeto em [supabase.com](https://supabase.com)
- Vá em **SQL Editor** → **New Query**
- Cole o conteúdo do arquivo `supabase-migration.sql`
- Clique em **Run**

### 2. Configurar variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hkkkzhuxkpyspzliwjkx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

Para encontrar a `ANON_KEY`:
- Supabase → Settings → API → **anon public** key

### 3. Instalar dependências

```bash
npm install
```

### 4. Rodar localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

### 5. Deploy no Vercel

1. Faça push do projeto para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy**

---

## 📋 Funcionalidades

- ✅ **Autenticação** — Login, cadastro, recuperação de senha
- ✅ **Dashboard** — Visão geral com gráficos e KPIs
- ✅ **Estoque** — Controle de SKUs base com movimentações
- ✅ **Vendas** — Registro manual + importação de relatório Shopee
- ✅ **Financeiro** — Receita bruta, taxas, comissões e lucro líquido
- ✅ **Shopee Ads** — Controle de investimento e ROAS
- ✅ **Curva ABC** — Análise automática de produtos por faturamento
- ✅ **Ordem de Compra** — Sugestão automática de reposição
- ✅ **Relatórios** — Export em Excel e PDF para todos os módulos
- ✅ **Backup** — Export completo em Excel multi-abas

## 🏪 Lojas configuradas

- KL Market
- Universo dos Achados
- Mundo dos Achados

## 📦 Mapa de SKUs padrão

| SKU Venda | Consome |
|-----------|---------|
| FM50 | 1 FORMA |
| FM100 | 2 FORMA |
| FM200 | 4 FORMA |
| FM300 | 6 FORMA |
| KIT2TP | 2 TAPETES |
| KIT3TP | 3 TAPETES |
| KIT4TP | 4 TAPETES |
| KIT120 | 6 SAQUINHO |
| KIT240 | 12 SAQUINHO |
| KIT480 | 24 SAQUINHO |
| KIT120B | 6 SAQUINHO + 1 PORTASAQUINHO |
| KIT240B | 12 SAQUINHO + 1 PORTASAQUINHO |
| KIT480B | 24 SAQUINHO + 1 PORTASAQUINHO |

## 📤 Importação de Relatório Shopee

O sistema aceita arquivos `.xlsx` ou `.csv` exportados da Shopee.
Colunas reconhecidas automaticamente:
- Order ID, Order Creation Date, Product Name, SKU
- Quantity, Original Price, Discount, Shipping Fee
- Shopee Commission, Shopee Fee, Final Amount Received
- Order Status, Store Name
# Shopee ERP
