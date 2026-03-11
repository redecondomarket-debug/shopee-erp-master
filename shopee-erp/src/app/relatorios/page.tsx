'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n || 0)
}

// ── Exportar Excel ────────────────────────────────────────────────────────────
async function exportarExcel(nomeArquivo: string, dados: Record<string, any>[], colunas: string[]) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(dados.map(row => {
    const obj: Record<string, any> = {}
    colunas.forEach(c => { obj[c] = row[c] ?? '' })
    return obj
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`)
}

// ── Exportar CSV simples ──────────────────────────────────────────────────────
function exportarCSV(nomeArquivo: string, dados: Record<string, any>[], colunas: string[]) {
  const header = colunas.join(';')
  const rows = dados.map(row => colunas.map(c => `"${row[c] ?? ''}"`).join(';'))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${nomeArquivo}.csv`; a.click()
  URL.revokeObjectURL(url)
}

type RelConfig = {
  id: string
  icone: string
  titulo: string
  descricao: string
  cor: string
  tabela: string
  colunas: { key: string; label: string }[]
  filtros?: { campo: string; label: string }[]
  ordenar?: string
}

const RELATORIOS: RelConfig[] = [
  {
    id: 'financeiro',
    icone: '💰',
    titulo: 'Financeiro — Pedidos',
    descricao: 'Todos os pedidos importados da Shopee com receita, taxas, lucro e margem',
    cor: '#EE2C00',
    tabela: 'financeiro',
    ordenar: 'data',
    colunas: [
      { key: 'data', label: 'Data' },
      { key: 'loja', label: 'Loja' },
      { key: 'numero_pedido', label: 'Pedido' },
      { key: 'sku_vendido', label: 'SKU' },
      { key: 'nome_produto', label: 'Produto' },
      { key: 'quantidade', label: 'Qtd' },
      { key: 'preco_unitario', label: 'Vl Unit' },
      { key: 'receita_bruta', label: 'Rec Bruta' },
      { key: 'taxa_shopee', label: 'Taxa Shopee' },
      { key: 'taxa_fixa', label: 'Taxa Fixa' },
      { key: 'custo_produto', label: 'Custo Prod' },
      { key: 'custo_embalagem', label: 'Custo Emb' },
      { key: 'imposto', label: 'Imposto' },
      { key: 'lucro_operacional', label: 'Lucro Op' },
    ],
  },
  {
    id: 'estoque',
    icone: '📦',
    titulo: 'Estoque — Produtos Base',
    descricao: 'Situação atual do estoque com quantidade, mínimo e valor em estoque',
    cor: '#0095ff',
    tabela: 'estoque',
    colunas: [
      { key: 'sku_base', label: 'SKU Base' },
      { key: 'produto', label: 'Produto' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'estoque_atual', label: 'Estoque Atual' },
      { key: 'estoque_minimo', label: 'Estoque Mín' },
      { key: 'custo', label: 'Custo Unit' },
      { key: 'custo_embalagem', label: 'Custo Emb' },
    ],
  },
  {
    id: 'ads',
    icone: '📣',
    titulo: 'Shopee Ads',
    descricao: 'Gastos e retorno de anúncios por loja e data',
    cor: '#ffaa00',
    tabela: 'ads',
    ordenar: 'data',
    colunas: [
      { key: 'data', label: 'Data' },
      { key: 'loja', label: 'Loja' },
      { key: 'investimento', label: 'Investimento' },
      { key: 'vendas_geradas', label: 'Vendas Geradas' },
      { key: 'cliques', label: 'Cliques' },
      { key: 'impressoes', label: 'Impressões' },
    ],
  },
  {
    id: 'sku_map',
    icone: '🔗',
    titulo: 'Composição de SKUs',
    descricao: 'Mapa completo de SKU de venda × SKU base e quantidades',
    cor: '#A855F7',
    tabela: 'sku_map',
    colunas: [
      { key: 'sku_venda', label: 'SKU Venda' },
      { key: 'sku_base', label: 'SKU Base' },
      { key: 'quantidade', label: 'Qtd por Venda' },
    ],
  },
]

type StatusRel = { loading: boolean; total: number; erro?: string }

export default function RelatoriosPage() {
  const [status, setStatus] = useState<Record<string, StatusRel>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [lojaFilter, setLojaFilter] = useState('')

  const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

  async function gerarRelatorio(rel: RelConfig, formato: 'xlsx' | 'csv') {
    setStatus(prev => ({ ...prev, [rel.id]: { loading: true, total: 0 } }))
    try {
      let query = supabase.from(rel.tabela).select('*').limit(10000)
      if (rel.ordenar) query = query.order(rel.ordenar, { ascending: false })
      if (dateFrom && rel.tabela !== 'estoque' && rel.tabela !== 'sku_map') query = query.gte('data', dateFrom)
      if (dateTo && rel.tabela !== 'estoque' && rel.tabela !== 'sku_map') query = query.lte('data', dateTo)
      if (lojaFilter && rel.tabela !== 'estoque' && rel.tabela !== 'sku_map') query = query.eq('loja', lojaFilter)

      const { data, error } = await query
      if (error) throw error

      const dados = (data || []).map(row => {
        const obj: Record<string, any> = {}
        rel.colunas.forEach(c => { obj[c.label] = row[c.key] ?? '' })
        return obj
      })

      const nomeArq = `${rel.id}${dateFrom ? `_${dateFrom}` : ''}${dateTo ? `_${dateTo}` : ''}`
      const colunas = rel.colunas.map(c => c.label)

      if (formato === 'xlsx') await exportarExcel(nomeArq, dados, colunas)
      else exportarCSV(nomeArq, dados, colunas)

      setStatus(prev => ({ ...prev, [rel.id]: { loading: false, total: dados.length } }))
    } catch (err: any) {
      setStatus(prev => ({ ...prev, [rel.id]: { loading: false, total: 0, erro: err.message || 'Erro' } }))
    }
  }

  const S = {
    page: { padding: '20px 24px', width: '100%', boxSizing: 'border-box' as const },
    title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' },
    sub: { fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' },
    filtersRow: { display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 28, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' },
    filterLabel: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 },
    input: { background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px', color: 'var(--text-primary)', fontSize: 13 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
    card: (cor: string) => ({ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 14, padding: 20, borderTop: `3px solid ${cor}` }),
    cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    icone: (cor: string) => ({ fontSize: 28, background: `${cor}20`, borderRadius: 10, padding: '6px 10px', display: 'inline-block' }),
    tituloCard: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' },
    descCard: { fontSize: 12, color: 'var(--text-secondary)', margin: 0 },
    colunasList: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 14 },
    colTag: { background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontSize: 10, color: 'var(--text-muted)' },
    btnRow: { display: 'flex', gap: 8 },
    btnXlsx: (cor: string) => ({ background: cor, border: 'none', borderRadius: 8, padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 1 }),
    btnCsv: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', flex: 1 },
    statusOk: { fontSize: 12, color: '#00d68f', marginTop: 8 },
    statusErr: { fontSize: 12, color: '#ff3d71', marginTop: 8 },
  }

  return (
    <div style={S.page}>
      <h1 style={S.title}>📊 Relatórios</h1>
      <p style={S.sub}>Exporte dados de qualquer módulo em Excel ou CSV com filtros de período e loja</p>

      {/* Filtros globais */}
      <div style={S.filtersRow}>
        <span style={S.filterLabel}>FILTROS GLOBAIS:</span>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} style={S.input}>
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>De</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={S.input} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={S.input} />
        {(dateFrom || dateTo || lojaFilter) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setLojaFilter('') }}
            style={{ ...S.btnCsv, padding: '7px 12px' }}>✕ Limpar</button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {dateFrom || dateTo ? `📅 ${dateFrom || '...'} → ${dateTo || '...'}` : 'Todos os períodos'}
          {lojaFilter ? ` · ${lojaFilter.split(' ')[0]}` : ''}
        </span>
      </div>

      {/* Cards de relatórios */}
      <div style={S.grid}>
        {RELATORIOS.map(rel => {
          const st = status[rel.id]
          return (
            <div key={rel.id} style={S.card(rel.cor)}>
              <div style={S.cardHeader}>
                <span style={S.icone(rel.cor)}>{rel.icone}</span>
                <div>
                  <p style={S.tituloCard}>{rel.titulo}</p>
                  <p style={S.descCard}>{rel.descricao}</p>
                </div>
              </div>

              <div style={S.colunasList}>
                {rel.colunas.map(c => (
                  <span key={c.key} style={S.colTag}>{c.label}</span>
                ))}
              </div>

              <div style={S.btnRow}>
                <button
                  disabled={st?.loading}
                  onClick={() => gerarRelatorio(rel, 'xlsx')}
                  style={S.btnXlsx(rel.cor)}>
                  {st?.loading ? '⏳ Gerando...' : '⬇ Excel (.xlsx)'}
                </button>
                <button
                  disabled={st?.loading}
                  onClick={() => gerarRelatorio(rel, 'csv')}
                  style={S.btnCsv}>
                  CSV
                </button>
              </div>

              {st && !st.loading && !st.erro && (
                <p style={S.statusOk}>✅ {fmtNum(st.total)} registros exportados</p>
              )}
              {st?.erro && (
                <p style={S.statusErr}>❌ {st.erro}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div style={{ marginTop: 32, padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>ℹ️ Como usar:</strong> Selecione os filtros de período e loja acima, depois clique em <strong>Excel</strong> para baixar uma planilha formatada ou <strong>CSV</strong> para um arquivo simples compatível com qualquer software.
        Os filtros de período e loja se aplicam apenas às tabelas que possuem esses campos (Financeiro e Ads).
      </div>
    </div>
  )
}
