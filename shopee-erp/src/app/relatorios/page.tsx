'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0)

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
  // FIX: colunas agora mapeiam para os nomes REAIS das colunas do banco
  colunas: { key: string; label: string }[]
  ordenar?: string
}

const RELATORIOS: RelConfig[] = [
  {
    id: 'financeiro',
    icone: '💰',
    titulo: 'Financeiro — Pedidos',
    descricao: 'Todos os pedidos importados da Shopee com receita, taxas e lucro operacional calculado',
    cor: '#ff6600',
    tabela: 'financeiro',
    ordenar: 'data',
    // FIX: nomes corretos conforme tabela real do banco (seção 2.2 do doc de referência)
    colunas: [
      { key: 'data',            label: 'Data' },
      { key: 'loja',            label: 'Loja' },
      { key: 'pedido',          label: 'Pedido' },          // era 'numero_pedido' — ERRADO
      { key: 'sku',             label: 'SKU' },              // era 'sku_vendido' — ERRADO
      { key: 'produto',         label: 'Produto' },
      { key: 'quantidade',      label: 'Qtd' },
      { key: 'valor_bruto',     label: 'Receita Bruta' },    // era 'receita_bruta' — ERRADO
      { key: 'comissao_shopee', label: 'Taxa Shopee' },      // era 'taxa_shopee' — ERRADO
      // FIX: taxa_fixa REMOVIDA — não existe no banco nem no sistema
      { key: 'valor_liquido',   label: 'Valor Líquido' },
      { key: 'desconto',        label: 'Desconto' },
      { key: 'frete',           label: 'Frete' },
      // NOTA: custo_produto, imposto e lucro_operacional são calculados em runtime
      // e não são salvos no banco — não é possível exportá-los diretamente
    ],
  },
  {
    id: 'estoque',
    icone: '📦',
    titulo: 'Estoque — Produtos Base',
    descricao: 'Situação atual do estoque com quantidade, mínimo e valor em estoque',
    cor: '#0ea5e9',
    tabela: 'estoque',
    colunas: [
      { key: 'sku_base',        label: 'SKU Base' },
      { key: 'produto',         label: 'Produto' },
      { key: 'categoria',       label: 'Categoria' },
      { key: 'unidade',         label: 'Unidade' },
      { key: 'estoque_atual',   label: 'Estoque Atual' },
      { key: 'estoque_minimo',  label: 'Estoque Mín' },
      { key: 'custo',           label: 'Custo Unit (R$)' },
      { key: 'custo_embalagem', label: 'Custo Emb (R$)' },
    ],
  },
  {
    id: 'ads',
    icone: '📣',
    titulo: 'Shopee Ads',
    descricao: 'Gastos e retorno de anúncios por loja e data',
    cor: '#f59e0b',
    tabela: 'ads',
    ordenar: 'data',
    colunas: [
      { key: 'data',            label: 'Data' },
      { key: 'loja',            label: 'Loja' },
      { key: 'produto',         label: 'Produto/Campanha' },
      { key: 'investimento',    label: 'Investimento (R$)' },
      { key: 'vendas_geradas',  label: 'Vendas Geradas (R$)' },
      { key: 'roas',            label: 'ROAS' },
    ],
  },
  {
    id: 'sku_map',
    icone: '🔗',
    titulo: 'Composição de SKUs',
    descricao: 'Mapa completo de SKU de venda × SKU base e quantidades',
    cor: '#a855f7',
    tabela: 'sku_map',
    colunas: [
      { key: 'sku_venda',   label: 'SKU Venda' },
      { key: 'sku_base',    label: 'SKU Base' },
      { key: 'quantidade',  label: 'Qtd por Venda' },
    ],
  },
  {
    id: 'movimentacoes',
    icone: '🔄',
    titulo: 'Movimentações de Estoque',
    descricao: 'Histórico de entradas e ajustes manuais de estoque',
    cor: '#22c55e',
    tabela: 'movimentacoes',
    ordenar: 'data',
    colunas: [
      { key: 'data',        label: 'Data' },
      { key: 'tipo',        label: 'Tipo' },
      { key: 'sku_base',    label: 'SKU Base' },
      { key: 'quantidade',  label: 'Quantidade' },
      { key: 'origem',      label: 'Origem' },
      { key: 'observacao',  label: 'Observação' },
    ],
  },
]

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']

type StatusRel = { loading: boolean; total: number; erro?: string }

const S = {
  page:     { padding: '20px 24px', width: '100%', boxSizing: 'border-box' as const },
  card:     { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '20px 22px' },
  inp:      { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none' },
  btn:      { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flex: 1 } as React.CSSProperties,
  btnGhost: { background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13, flex: 1 } as React.CSSProperties,
  label:    { fontSize: 11, color: '#55556a', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as const },
}

export default function RelatoriosPage() {
  const [status,      setStatus]      = useState<Record<string, StatusRel>>({})
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [lojaFilter,  setLojaFilter]  = useState('')

  async function gerarRelatorio(rel: RelConfig, formato: 'xlsx' | 'csv') {
    setStatus(prev => ({ ...prev, [rel.id]: { loading: true, total: 0 } }))
    try {
      let query = supabase.from(rel.tabela).select('*').limit(10000)
      if (rel.ordenar) query = query.order(rel.ordenar, { ascending: false })
      if (dateFrom && !['estoque', 'sku_map'].includes(rel.tabela)) query = query.gte('data', dateFrom)
      if (dateTo   && !['estoque', 'sku_map'].includes(rel.tabela)) query = query.lte('data', dateTo)
      if (lojaFilter && !['estoque', 'sku_map'].includes(rel.tabela)) query = query.eq('loja', lojaFilter)

      const { data, error } = await query
      if (error) throw error

      // Mapeia usando os keys reais do banco
      const dados = (data || []).map(row => {
        const obj: Record<string, any> = {}
        rel.colunas.forEach(c => { obj[c.label] = row[c.key] ?? '' })
        return obj
      })

      const colunas  = rel.colunas.map(c => c.label)
      const nomeArq  = `${rel.id}${dateFrom ? `_${dateFrom}` : ''}${dateTo ? `_ate_${dateTo}` : ''}`

      if (formato === 'xlsx') await exportarExcel(nomeArq, dados, colunas)
      else exportarCSV(nomeArq, dados, colunas)

      setStatus(prev => ({ ...prev, [rel.id]: { loading: false, total: dados.length } }))
    } catch (err: any) {
      setStatus(prev => ({ ...prev, [rel.id]: { loading: false, total: 0, erro: err.message || 'Erro desconhecido' } }))
    }
  }

  return (
    <div style={S.page}>
      <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>📊 Relatórios</h2>
      <p style={{ margin: '0 0 24px', fontSize: 12, color: '#55556a' }}>Exporte dados de qualquer módulo em Excel ou CSV</p>

      {/* FILTROS GLOBAIS */}
      <div style={{ ...S.card, marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 11, color: '#55556a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, alignSelf: 'center' }}>Filtros globais:</div>
        <div>
          <div style={{ ...S.label, marginBottom: 4 }}>Loja</div>
          <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} style={{ ...S.inp, width: 200 }}>
            <option value="">Todas as lojas</option>
            {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...S.label, marginBottom: 4 }}>De</div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 148 }} />
        </div>
        <div>
          <div style={{ ...S.label, marginBottom: 4 }}>Até</div>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 148 }} />
        </div>
        {(dateFrom || dateTo || lojaFilter) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setLojaFilter('') }}
            style={{ background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontSize: 12, alignSelf: 'flex-end' }}>
            ✕ Limpar
          </button>
        )}
        <div style={{ fontSize: 11, color: '#444', marginLeft: 'auto', alignSelf: 'center' }}>
          {dateFrom || dateTo ? `📅 ${dateFrom || '...'} → ${dateTo || '...'}` : 'Todos os períodos'}
          {lojaFilter ? ` · ${lojaFilter.split(' ')[0]}` : ' · Todas as lojas'}
        </div>
      </div>

      {/* CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {RELATORIOS.map(rel => {
          const st = status[rel.id]
          return (
            <div key={rel.id} style={{ ...S.card, borderTop: `3px solid ${rel.cor}` }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 26, background: rel.cor + '20', borderRadius: 10, padding: '6px 10px', flexShrink: 0 }}>{rel.icone}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8', marginBottom: 4 }}>{rel.titulo}</div>
                  <div style={{ fontSize: 12, color: '#55556a' }}>{rel.descricao}</div>
                </div>
              </div>

              {/* Colunas que serão exportadas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                {rel.colunas.map(c => (
                  <span key={c.key} style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 4, padding: '2px 7px', fontSize: 10, color: '#55556a' }}>{c.label}</span>
                ))}
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={st?.loading} onClick={() => gerarRelatorio(rel, 'xlsx')}
                  style={{ ...S.btn, background: st?.loading ? '#333' : rel.cor, cursor: st?.loading ? 'not-allowed' : 'pointer' }}>
                  {st?.loading ? '⏳ Gerando...' : '⬇ Excel (.xlsx)'}
                </button>
                <button disabled={st?.loading} onClick={() => gerarRelatorio(rel, 'csv')} style={S.btnGhost}>
                  CSV
                </button>
              </div>

              {/* Status */}
              {st && !st.loading && !st.erro && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#22c55e' }}>
                  ✅ {N(st.total)} registros exportados
                </div>
              )}
              {st?.erro && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444' }}>
                  ❌ {st.erro}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Nota sobre campos calculados */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 10, fontSize: 12, color: '#55556a' }}>
        <strong style={{ color: '#888' }}>ℹ️ Campos calculados:</strong> Custo do produto, imposto e lucro operacional são calculados em tempo real pelo sistema cruzando sku_map + estoque + alíquota configurada. Eles não são armazenados no banco e por isso não aparecem na exportação direta. Para exportar esses valores, use o botão CSV na tela do Financeiro.
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
