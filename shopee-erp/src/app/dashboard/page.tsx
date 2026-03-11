'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ─── CONSTANTS (idênticas ao App.js) ─────────────────────────────────────────
const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20
const TAXA_FIXA = 4.05

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

// ─── UI ATOMS (idênticos ao App.js) ──────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  card:      { background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10, padding: 16 },
  th:        { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 0.8, textTransform: 'uppercase', borderBottom: '1px solid #2a2a3a', whiteSpace: 'nowrap' },
  td:        { padding: '7px 12px', fontSize: 12.5, borderBottom: '1px solid #1e1e2a', whiteSpace: 'nowrap' },
  inp:       { background: '#0f0f13', border: '1px solid #2a2a3a', borderRadius: 6, padding: '7px 10px', color: '#e8e8f0', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' },
  btn:       { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:     { background: '#ff660022', color: '#ff6600', border: '1px solid #ff660044', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
}

function Badge({ children, color = '#ff6600' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  )
}
function StatusBadge({ v }: { v: number }) {
  if (v >= 0.20) return <Badge color="#22c55e">▲ {P(v)}</Badge>
  if (v >= 0.10) return <Badge color="#f59e0b">● {P(v)}</Badge>
  return <Badge color="#ef4444">▼ {P(v)}</Badge>
}
function ROASBadge({ v }: { v: number }) {
  const color = v >= 2 ? '#22c55e' : v >= 1 ? '#f59e0b' : '#ef4444'
  return <Badge color={color}>{(+v || 0).toFixed(2)}x</Badge>
}
function KPI({ label, value, sub, color = '#ff9933', icon }: any) {
  return (
    <div style={{ ...S.card, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function MiniBar({ data, height = 100, colorFn }: { data: { l: string; v: number }[]; height?: number; colorFn?: (i: number) => string }) {
  const max = Math.max(...data.map(d => d.v), 1)
  const defaultColors = ['#ff6600', '#0ea5e9', '#a855f7', '#22c55e', '#f59e0b']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '4px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', background: colorFn ? colorFn(i) : defaultColors[i % defaultColors.length], borderRadius: '3px 3px 0 0', height: `${(d.v / max) * (height - 20)}px`, minHeight: d.v > 0 ? 3 : 0, transition: 'height .4s' }} />
          <span style={{ fontSize: 9, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 50, textOverflow: 'ellipsis', textAlign: 'center' }}>{d.l}</span>
        </div>
      ))}
    </div>
  )
}
function Table({ headers, rows, emptyMsg = 'Nenhum dado.' }: { headers: string[]; rows: React.ReactNode[][]; emptyMsg?: string }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={S.th as any}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ ...S.td, color: '#555', textAlign: 'center', padding: 32 } as any}>{emptyMsg}</td></tr>
            : rows.map((r, i) => <tr key={i} style={{ cursor: 'default' }}>{r.map((c, j) => <td key={j} style={S.td as any}>{c}</td>)}</tr>)
          }
        </tbody>
      </table>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [ads,        setAds]        = useState<any[]>([])
  const [estoque,    setEstoque]    = useState<any[]>([])
  const [skuMap,     setSkuMap]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lojaFiltro, setLojaFiltro] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, adsRes, estRes, mapRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000),
      supabase.from('ads').select('*').order('data', { ascending: false }),
      supabase.from('estoque').select('*'),
      supabase.from('sku_map').select('*'),
    ])
    setFinanceiro(finRes.data || [])
    setAds(adsRes.data || [])
    setEstoque(estRes.data || [])
    setSkuMap(mapRes.data || [])
    setLoading(false)
  }

  function calcCustoProd(skuVendido: string, quantidade: number): number {
    if (!skuVendido) return 0
    const comps = skuMap.filter(m => m.sku_venda === skuVendido)
    if (!comps.length) return 0
    const custoProd = comps.reduce((t, c) => {
      const prod = estoque.find(e => e.sku_base === c.sku_base)
      return t + (prod?.custo || 0) * (c.quantidade || 1) * quantidade
    }, 0)
    const prodPrincipal = estoque.find(e => e.sku_base === comps[0]?.sku_base)
    return custoProd + (prodPrincipal?.custo_embalagem || 0)
  }

  const finF = useMemo(() => financeiro.filter(f => {
    if (lojaFiltro !== 'Todas' && f.loja !== lojaFiltro) return false
    if (dateFrom && f.data < dateFrom) return false
    if (dateTo   && f.data > dateTo)   return false
    return true
  }), [financeiro, lojaFiltro, dateFrom, dateTo])

  const adsF = useMemo(() => ads.filter(a => {
    if (lojaFiltro !== 'Todas' && a.loja !== lojaFiltro) return false
    if (dateFrom && a.data < dateFrom) return false
    if (dateTo   && a.data > dateTo)   return false
    return true
  }), [ads, lojaFiltro, dateFrom, dateTo])

  // ── KPIs (lógica idêntica ao App.js) ──────────────────────────────────────
  const totalRec   = finF.reduce((s, f) => s + (f.receita_bruta || f.valor_bruto || 0), 0)
  const totalTaxas = finF.reduce((s, f) => {
    const rb = f.receita_bruta || f.valor_bruto || 0
    const ts = (f.taxa_shopee && f.taxa_shopee > 0) ? f.taxa_shopee : rb * TAXA_SHOPEE
    const tf = (f.taxa_fixa   && f.taxa_fixa   > 0) ? f.taxa_fixa   : TAXA_FIXA
    return s + ts + tf
  }, 0)
  const totalCprod = finF.reduce((s, f) => {
    const sku = f.sku_vendido || f.sku || ''
    const calc = calcCustoProd(sku, f.quantidade || 1)
    return s + ((f.custo_produto && f.custo_produto > 0) ? f.custo_produto : calc)
  }, 0)
  const totalCemb  = finF.reduce((s, f) => s + (f.custo_embalagem || 0), 0)
  const totalMC    = totalRec - totalTaxas - totalCprod - totalCemb
  const mcPct      = totalRec > 0 ? totalMC / totalRec : 0
  const totalLucOp = finF.reduce((s, f) => s + (f.lucro_operacional || f.valor_liquido || 0), 0)
  const totalAds   = adsF.reduce((s, a) => s + (a.gasto || a.investimento || 0), 0)
  const lucroLiq   = totalLucOp - totalAds
  const margemLiq  = totalRec > 0 ? lucroLiq / totalRec : 0
  const roas       = totalAds  > 0 ? totalRec / totalAds  : 0
  const pedSet     = new Set(finF.map(f => f.numero_pedido)).size
  const ticket     = pedSet > 0 ? totalRec / pedSet : 0

  // Resultado por loja (igual ao App.js)
  const porLoja = LOJAS.map(loja => {
    const lp    = finF.filter(f => f.loja === loja)
    const rec   = lp.reduce((s, f) => s + (f.receita_bruta || f.valor_bruto || 0), 0)
    const taxas = lp.reduce((s, f) => {
      const rb = f.receita_bruta || f.valor_bruto || 0
      const ts = (f.taxa_shopee && f.taxa_shopee > 0) ? f.taxa_shopee : rb * TAXA_SHOPEE
      const tf = (f.taxa_fixa   && f.taxa_fixa   > 0) ? f.taxa_fixa   : TAXA_FIXA
      return s + ts + tf
    }, 0)
    const cprod = lp.reduce((s, f) => {
      const sku = f.sku_vendido || f.sku || ''
      const calc = calcCustoProd(sku, f.quantidade || 1)
      return s + ((f.custo_produto && f.custo_produto > 0) ? f.custo_produto : calc)
    }, 0)
    const cemb  = lp.reduce((s, f) => s + (f.custo_embalagem || 0), 0)
    const mc    = rec - taxas - cprod - cemb
    const lucOp = lp.reduce((s, f) => s + (f.lucro_operacional || f.valor_liquido || 0), 0)
    const gads  = adsF.filter(a => a.loja === loja).reduce((s, a) => s + (a.gasto || a.investimento || 0), 0)
    const ll    = lucOp - gads
    return { loja, rec, mc, mcPct: rec > 0 ? mc / rec : 0, lucOp, gads, ll, roas: gads > 0 ? rec / gads : 0, peds: new Set(lp.map(f => f.numero_pedido)).size }
  })

  // Top SKUs
  const skuAgg: Record<string, any> = {}
  finF.forEach(f => {
    const sku = f.sku_vendido || f.sku || 'SEM SKU'
    if (!skuAgg[sku]) skuAgg[sku] = { sku, nome: f.nome_produto || sku, rec: 0, lucro: 0, qtd: 0 }
    skuAgg[sku].rec   += f.receita_bruta || f.valor_bruto   || 0
    skuAgg[sku].lucro += f.lucro_operacional || f.valor_liquido || 0
    skuAgg[sku].qtd   += f.quantidade    || 1
  })
  const topSkus = Object.values(skuAgg).sort((a: any, b: any) => b.rec - a.rec).slice(0, 8)

  // Chart por dia
  const byDay: Record<string, number> = {}
  finF.forEach(f => { byDay[f.data] = (byDay[f.data] || 0) + (f.valor_bruto || 0) })
  const dayChart = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ l: d.slice(8,10) + '/' + d.slice(5,7), v }))

  // Alertas de estoque
  const criticos = estoque.filter(e => (e.estoque_atual || 0) <= (e.estoque_minimo || 0))

  const temFiltro = lojaFiltro !== 'Todas' || dateFrom || dateTo

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ff660033', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Todas', ...LOJAS].map(l => {
            const cor = LOJA_COLORS[l] || '#ff6600'
            const ativo = lojaFiltro === l
            const label = l === 'Todas' ? 'Todas' : l === 'KL MARKET' ? 'KL' : l === 'UNIVERSO DOS ACHADOS' ? 'UNIVERSO' : 'MUNDO'
            return (
              <button key={l} onClick={() => setLojaFiltro(l)} style={{
                background: ativo ? cor + '33' : 'transparent',
                border: `1px solid ${ativo ? cor : '#2a2a3a'}`,
                color: ativo ? cor : '#555',
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: ativo ? 700 : 400, transition: 'all .15s'
              }}>{label}</button>
            )
          })}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 140, padding: '5px 8px', fontSize: 12 } as any} />
        <span style={{ color: '#555', fontSize: 12 }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 140, padding: '5px 8px', fontSize: 12 } as any} />
        {temFiltro && (
          <button onClick={() => { setLojaFiltro('Todas'); setDateFrom(''); setDateTo('') }} style={S.btnSm as any}>
            ✕ Limpar filtros
          </button>
        )}
        <button onClick={loadData} style={{ ...S.btnSm, marginLeft: 'auto' } as any}>🔄 Atualizar</button>
      </div>

      {/* 6 KPIs (idêntico ao App.js) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI icon="💰" label="Faturamento Total"        value={R(totalRec)}          color="#ff9933"                                                    sub={`${N(pedSet)} pedidos · Ticket: ${R(ticket)}`} />
        <KPI icon="📊" label="Margem de Contribuição"   value={`${R(totalMC)} · ${P(mcPct)}`} color={mcPct >= 0.30 ? '#a78bfa' : mcPct >= 0.15 ? '#f59e0b' : '#ef4444'} sub="Receita − Custos Variáveis" />
        <KPI icon="✅" label="Lucro Líquido Real"       value={R(lucroLiq)}          color={lucroLiq >= 0 ? '#22c55e' : '#ef4444'}                      sub={`Op: ${R(totalLucOp)} · Ads: ${R(totalAds)}`} />
        <KPI icon="📈" label="Margem Líquida"           value={P(margemLiq)}         color={margemLiq > .15 ? '#22c55e' : margemLiq > .05 ? '#f59e0b' : '#ef4444'} sub="sobre receita bruta" />
        <KPI icon="⚡" label="ROAS Geral"               value={`${roas.toFixed(2)}x`} color={roas >= 2 ? '#22c55e' : roas >= 1 ? '#f59e0b' : '#ef4444'} sub={roas >= 2 ? 'Eficiente' : roas >= 1 ? 'Atenção' : 'Abaixo do ideal'} />
        <KPI icon="🛒" label="Total de Pedidos"         value={N(pedSet)}            color="#a78bfa"                                                    sub={`Ticket médio: ${R(ticket)}`} />
      </div>

      {/* Resultado por Loja + Gráfico Dia */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>🏪 Resultado por Loja</div>
          <Table
            headers={['Loja', 'Faturamento', 'Mg Contrib', 'MC%', 'Lucro Op', 'Gasto Ads', 'Lucro Líq', 'ROAS', 'Margem']}
            rows={porLoja.map(l => [
              <span style={{ color: LOJA_COLORS[l.loja], fontWeight: 700, fontSize: 11 }}>{l.loja}</span>,
              <span style={{ fontFamily: 'monospace' }}>{R(l.rec)}</span>,
              <span style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>{R(l.mc)}</span>,
              <span style={{ background: l.mcPct >= 0.30 ? '#22c55e22' : l.mcPct >= 0.15 ? '#f59e0b22' : '#ef444422', color: l.mcPct >= 0.30 ? '#22c55e' : l.mcPct >= 0.15 ? '#f59e0b' : '#ef4444', border: `1px solid ${l.mcPct >= 0.30 ? '#22c55e44' : l.mcPct >= 0.15 ? '#f59e0b44' : '#ef444444'}`, borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>{P(l.mcPct)}</span>,
              <span style={{ fontFamily: 'monospace' }}>{R(l.lucOp)}</span>,
              <span style={{ fontFamily: 'monospace', color: '#e67e22' }}>{R(l.gads)}</span>,
              <span style={{ fontFamily: 'monospace', color: l.ll >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{R(l.ll)}</span>,
              <ROASBadge v={l.roas} />,
              <StatusBadge v={l.rec > 0 ? l.ll / l.rec : 0} />,
            ])}
          />
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>📅 Faturamento por Dia</div>
          {dayChart.length > 0
            ? <MiniBar data={dayChart} height={130} />
            : <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Sem dados no período</div>
          }
        </div>
      </div>

      {/* Top Produtos + Alertas Estoque */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>🏆 Top Produtos por Receita</div>
          <Table
            headers={['#', 'SKU', 'Produto', 'Qtd', 'Receita', 'Lucro', 'Margem']}
            rows={topSkus.map((s: any, i: number) => [
              <span style={{ color: '#555', fontFamily: 'monospace' }}>{i + 1}</span>,
              <span style={{ fontFamily: 'monospace', color: '#ff6600', fontSize: 11 }}>{s.sku}</span>,
              <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{s.nome}</span>,
              N(s.qtd),
              <span style={{ fontFamily: 'monospace' }}>{R(s.rec)}</span>,
              <span style={{ fontFamily: 'monospace', color: s.lucro >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{R(s.lucro)}</span>,
              <StatusBadge v={s.rec > 0 ? s.lucro / s.rec : 0} />,
            ])}
            emptyMsg="Sem dados de vendas"
          />
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>⚠️ Alertas de Estoque</div>
          {criticos.length === 0
            ? <div style={{ color: '#22c55e', textAlign: 'center', padding: 32, fontSize: 13 }}>✅ Todos os produtos com estoque adequado</div>
            : (
              <Table
                headers={['SKU', 'Produto', 'Atual', 'Mínimo', 'Status']}
                rows={criticos.map(e => [
                  <span style={{ fontFamily: 'monospace', color: '#ef4444', fontSize: 11 }}>{e.sku_base}</span>,
                  e.produto,
                  N(e.estoque_atual || 0),
                  N(e.estoque_minimo || 0),
                  e.estoque_atual <= 0
                    ? <Badge color="#ef4444">SEM ESTOQUE</Badge>
                    : <Badge color="#f59e0b">BAIXO</Badge>,
                ])}
              />
            )
          }

          {/* Barras de estoque */}
          <div style={{ marginTop: 14 }}>
            {estoque.map(e => {
              const cor = (e.estoque_atual || 0) <= 0 ? '#ef4444' : (e.estoque_atual || 0) < (e.estoque_minimo || 0) ? '#f59e0b' : '#22c55e'
              const pct = (e.estoque_minimo || 0) > 0
                ? Math.min((e.estoque_atual || 0) / ((e.estoque_minimo || 0) * 2), 1)
                : (e.estoque_atual || 0) > 0 ? 1 : 0
              return (
                <div key={e.id} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#888' }}>{e.produto}</span>
                    <span style={{ fontFamily: 'monospace', color: cor, fontWeight: 700 }}>{N(e.estoque_atual || 0)} {e.unidade || 'un'}</span>
                  </div>
                  <div style={{ height: 4, background: '#1e1e2a', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct * 100}%`, background: cor, borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
