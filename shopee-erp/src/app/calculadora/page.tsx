'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ProdutoBase = { sku_base: string; produto: string; custo: number; custo_embalagem: number }
type SkuMap      = { sku_venda: string; sku_base: string; quantidade: number }
type FinRow      = { sku: string; quantidade: number; valor_bruto: number; data: string }

// Famílias hardcoded
const SKU_FAMILIA: Record<string, string> = {
  FM50: 'Formas', FM100: 'Formas', FM200: 'Formas', FM300: 'Formas',
  KIT2TP: 'Tapetes', KIT3TP: 'Tapetes', KIT4TP: 'Tapetes',
  KIT120: 'Saquinhos', KIT240: 'Saquinhos', KIT480: 'Saquinhos',
  KITPS120B: 'Porta-Saquinho', KITPS240B: 'Porta-Saquinho', KITPS480B: 'Porta-Saquinho',
}
const FAMILIAS_CAL = ['Formas', 'Tapetes', 'Saquinhos', 'Porta-Saquinho']
const FAMILIA_CORES_CAL: Record<string, string> = {
  'Formas': '#f59e0b', 'Tapetes': '#a855f7',
  'Saquinhos': '#0ea5e9', 'Porta-Saquinho': '#22c55e',
}

const R  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const Pf = (v: number, dec = 1) => `${((+v || 0) * 100).toFixed(dec)}%`
const fmt = (d: Date) => d.toISOString().slice(0, 10)

// ── Estilos base ──────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '20px 22px' },
  inp:   { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '9px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any, width: '100%' },
  label: { fontSize: 11, color: '#55556a', marginBottom: 5, display: 'block', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as any },
  btn:   { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
}

// ── Gauge SVG ─────────────────────────────────────────────────────────────────
function Gauge({ value, max, label, color, size = 120 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const pct    = Math.min(Math.max(value / max, 0), 1)
  const cx     = size / 2, cy = size / 2, r = size * 0.38
  const start  = Math.PI * 0.75
  const total  = Math.PI * 1.5
  const end    = start + total * pct
  const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end)
  const large  = total * pct > Math.PI ? 1 : 0
  const trackX1 = cx + r * Math.cos(start),       trackY1 = cy + r * Math.sin(start)
  const trackX2 = cx + r * Math.cos(start + total),trackY2 = cy + r * Math.sin(start + total)
  return (
    <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`} style={{ overflow: 'visible' }}>
      <path d={`M ${trackX1} ${trackY1} A ${r} ${r} 0 1 1 ${trackX2} ${trackY2}`} fill="none" stroke="#1e1e2c" strokeWidth={size * 0.07} strokeLinecap="round" />
      {pct > 0.01 && (
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={size * 0.07} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color}66)` }} />
      )}
      <text x={cx} y={cy * 0.9} textAnchor="middle" fontSize={size * 0.18} fontWeight={800} fill={color} fontFamily="monospace">{value.toFixed(2)}x</text>
      <text x={cx} y={cy * 1.1} textAnchor="middle" fontSize={size * 0.095} fill="#55556a" fontFamily="sans-serif">{label}</text>
    </svg>
  )
}

function StatusBadge({ ok, msg }: { ok: boolean; msg: string }) {
  const c = ok ? '#22c55e' : '#ef4444'
  return (
    <span style={{ background: c + '18', color: c, border: `1px solid ${c}33`, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
      {ok ? '✅' : '❌'} {msg}
    </span>
  )
}

function ResultRow({ label, value, sub, color = '#e2e2f0', highlight = false }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: highlight ? '10px 14px' : '8px 0', background: highlight ? color + '12' : 'transparent', borderLeft: highlight ? `3px solid ${color}` : 'none', borderRadius: highlight ? 6 : 0, marginBottom: highlight ? 4 : 0, borderBottom: !highlight ? '1px solid #1a1a26' : 'none' }}>
      <div>
        <div style={{ fontSize: 12, color: highlight ? '#c0c0d8' : '#9090aa', fontWeight: highlight ? 700 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#44445a', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: 'monospace', fontWeight: highlight ? 800 : 600, fontSize: highlight ? 15 : 13, color }}>{value}</div>
    </div>
  )
}

// ── Helpers de período ────────────────────────────────────────────────────────
type Periodo = 'mes_atual' | 'mes_anterior' | 'personalizado'

function getPeriodoDates(periodo: Periodo, customFrom: string, customTo: string): { from: string; to: string } {
  const hoje = new Date()
  if (periodo === 'mes_atual') {
    const from = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const to   = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (periodo === 'mes_anterior') {
    const from = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const to   = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    return { from: fmt(from), to: fmt(to) }
  }
  return { from: customFrom, to: customTo }
}

function labelPeriodo(periodo: Periodo): string {
  if (periodo === 'mes_atual')    return 'Mês Atual'
  if (periodo === 'mes_anterior') return 'Mês Anterior'
  return 'Personalizado'
}

// ── Calculadora principal ─────────────────────────────────────────────────────
export default function CalculadoraPage() {
  const [estoque,    setEstoque]    = useState<ProdutoBase[]>([])
  const [skuMapData, setSkuMapData] = useState<SkuMap[]>([])
  const [loading,    setLoading]    = useState(true)
  const [familia,    setFamilia]    = useState('Formas')

  // ── Filtro de período ──
  const [periodo,     setPeriodo]    = useState<Periodo>('mes_anterior')
  const [customFrom,  setCustomFrom] = useState('')
  const [customTo,    setCustomTo]   = useState('')

  // ── Estado do custo automático ──
  const [custoAuto,       setCustoAuto]       = useState<number | null>(null)
  const [custoAutoInfo,   setCustoAutoInfo]   = useState<string>('')
  const [loadingCusto,    setLoadingCusto]    = useState(false)
  const [custoManual,     setCustoManual]     = useState('')
  const [modoManual,      setModoManual]      = useState(false)

  // Inputs da calculadora
  const [preco,         setPreco]         = useState('')
  const [taxaShopee,    setTaxaShopee]    = useState('20')
  const [metaLucro,     setMetaLucro]     = useState('15')
  const [taxaFixa,      setTaxaFixa]      = useState('4')
  const [imposto,       setImposto]       = useState('4')
  const [roasAtual,     setRoasAtual]     = useState('')
  const [gastoAds,      setGastoAds]      = useState('')
  const [vendasGeradas, setVendasGeradas] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('estoque').select('sku_base,produto,custo,custo_embalagem'),
      supabase.from('sku_map').select('sku_venda,sku_base,quantidade'),
    ]).then(([e, s]) => {
      setEstoque(e.data || [])
      setSkuMapData(s.data || [])
      setLoading(false)
    })
  }, [])

  // ── Calcula custo médio ponderado do Financeiro ───────────────────────────
  const calcularCustoMedio = useCallback(async () => {
    setLoadingCusto(true)
    setCustoAuto(null)
    setCustoAutoInfo('')

    const { from, to } = getPeriodoDates(periodo, customFrom, customTo)

    // Busca pedidos da família selecionada no período
    const skusDaFamilia = Object.entries(SKU_FAMILIA)
      .filter(([, fam]) => fam === familia)
      .map(([sku]) => sku)

    let query = supabase
      .from('financeiro')
      .select('sku, quantidade, valor_bruto, data')

    if (from) query = query.gte('data', from) as any
    if (to)   query = query.lte('data', to)   as any

    const { data: finRows, error } = await query

    if (error || !finRows || finRows.length === 0) {
      setCustoAutoInfo('Sem vendas no período para calcular. Use custo manual.')
      setLoadingCusto(false)
      return
    }

    // Filtra só os SKUs da família
    const rowsDaFamilia = (finRows as FinRow[]).filter(r =>
      skusDaFamilia.includes(String(r.sku || '').toUpperCase())
    )

    if (rowsDaFamilia.length === 0) {
      setCustoAutoInfo('Sem vendas dessa família no período. Use custo manual.')
      setLoadingCusto(false)
      return
    }

    // Calcula custo de cada SKU via sku_map + estoque
    function getCustoPorSku(sku: string, qtd: number): number {
      const componentes = skuMapData.filter(m => m.sku_venda === sku)
      if (!componentes.length) return 0
      const custoProd = componentes.reduce((total, comp) => {
        const prod = estoque.find(e => e.sku_base === comp.sku_base)
        return total + (prod?.custo || 0) * (comp.quantidade || 1) * qtd
      }, 0)
      const primComp   = componentes[0]
      const prodPrinc  = estoque.find(e => e.sku_base === primComp?.sku_base)
      return custoProd + (prodPrinc?.custo_embalagem || 0)
    }

    // Média ponderada: soma(custo × qtd) / soma(qtd)
    let somaCustoTotal = 0
    let somaQtd        = 0
    const breakdown: Record<string, { qtd: number; custoUnit: number }> = {}

    for (const row of rowsDaFamilia) {
      const skuUp = String(row.sku || '').toUpperCase()
      const qtd   = row.quantidade || 1
      const custo = getCustoPorSku(skuUp, 1) // custo unitário (qtd=1)

      somaCustoTotal += custo * qtd
      somaQtd        += qtd

      if (!breakdown[skuUp]) breakdown[skuUp] = { qtd: 0, custoUnit: custo }
      breakdown[skuUp].qtd += qtd
    }

    if (somaQtd === 0) {
      setCustoAutoInfo('Não foi possível calcular. Verifique o cadastro de SKUs.')
      setLoadingCusto(false)
      return
    }

    const custoMedio = somaCustoTotal / somaQtd

    // Monta texto explicativo do breakdown
    const detalhes = Object.entries(breakdown)
      .map(([sku, { qtd, custoUnit }]) => `${sku}: ${qtd}× ${R(custoUnit)}`)
      .join(' | ')

    const periodoLabel = from && to
      ? `${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}`
      : 'período selecionado'

    setCustoAuto(custoMedio)
    setCustoAutoInfo(`${somaQtd} vendas em ${periodoLabel} — ${detalhes}`)
    setModoManual(false)
    setLoadingCusto(false)
  }, [familia, periodo, customFrom, customTo, skuMapData, estoque])

  // Recalcula automaticamente quando muda família ou período
  useEffect(() => {
    if (!loading && skuMapData.length > 0 && estoque.length > 0) {
      calcularCustoMedio()
    }
  }, [familia, periodo, customFrom, customTo, loading])

  const custoProduto = modoManual ? (+custoManual || 0) : (custoAuto || 0)

  // ── Cálculos principais ───────────────────────────────────────────────────
  const calc = useMemo(() => {
    const p    = +preco      || 0
    const taxa = +taxaShopee / 100
    const meta = +metaLucro  / 100
    const cp   = custoProduto
    const tf   = +taxaFixa   || 0
    const imp  = +imposto    / 100
    if (p <= 0) return null

    const valorTaxaPct  = p * taxa
    const valorTaxa     = valorTaxaPct + tf
    const valorImp      = p * imp
    const margemSemAds  = p - valorTaxa - cp - valorImp
    const margemSemAdsPct = margemSemAds / p

    const roasEmpate  = margemSemAdsPct > 0 ? 1 / margemSemAdsPct : 0
    const margemAlvo  = margemSemAds - meta * p
    const roasIdeal   = margemAlvo > 0 ? p / margemAlvo : 0
    const cpaEmpate   = margemSemAds > 0 ? margemSemAds : 0
    const cpaIdeal    = margemAlvo > 0 ? margemAlvo : 0

    const ra = +roasAtual || 0
    let analiseRoas = null
    if (ra > 0 && roasEmpate > 0) {
      const gastoImplicito = p / ra
      const lucroComAds    = margemSemAds - gastoImplicito
      analiseRoas = { lucro: lucroComAds, lucroP: lucroComAds / p, empata: ra >= roasEmpate, atinjeMeta: ra >= roasIdeal }
    }

    let analiseCpa = null
    const ga = +gastoAds     || 0
    const vg = +vendasGeradas || 0
    if (ga > 0 && vg > 0) {
      const cpaReal = ga / vg
      analiseCpa = { cpaReal, ok: cpaReal <= cpaEmpate, okIdeal: cpaReal <= cpaIdeal }
    }

    return {
      preco: p, taxa: valorTaxa, taxaPct: taxa, valorImp, imp, cp,
      margemSemAds, margemSemAdsPct, roasEmpate, roasIdeal,
      cpaEmpate, cpaIdeal, meta, analiseRoas, analiseCpa,
    }
  }, [preco, taxaShopee, taxaFixa, metaLucro, custoProduto, roasAtual, gastoAds, vendasGeradas])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const { from: periodoFrom, to: periodoTo } = getPeriodoDates(periodo, customFrom, customTo)

  return (
    <div style={{ padding: '20px 24px', boxSizing: 'border-box' as any }}>

      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8' }}>🧮 Calculadora de ROAS e CPA</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>
          Descubra o ROAS mínimo para não perder dinheiro e o ideal para atingir sua meta de lucro
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20, alignItems: 'start' }}>

        {/* COLUNA ESQUERDA — Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Família + Período + Custo ── */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ff6600', marginBottom: 14, letterSpacing: 0.5 }}>📦 PRODUTO & PERÍODO</div>

            {/* Seletor de família */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Família</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FAMILIAS_CAL.map(f => {
                  const ativo = familia === f
                  const cor   = FAMILIA_CORES_CAL[f] || '#ff6600'
                  return (
                    <button key={f} onClick={() => { setFamilia(f); setModoManual(false); setCustoManual('') }} style={{
                      background: ativo ? cor + '22' : '#0f0f1a',
                      border: `1px solid ${ativo ? cor : '#2a2a3a'}`,
                      color: ativo ? cor : '#55556a',
                      borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
                      fontSize: 12, fontWeight: ativo ? 700 : 400,
                    }}>{f}</button>
                  )
                })}
              </div>
            </div>

            {/* ── Seletor de período ── */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Período para custo médio</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: periodo === 'personalizado' ? 10 : 0 }}>
                {(['mes_atual', 'mes_anterior', 'personalizado'] as Periodo[]).map(p => (
                  <button key={p} onClick={() => setPeriodo(p)} style={{
                    background: periodo === p ? '#ff660022' : '#0f0f1a',
                    border: `1px solid ${periodo === p ? '#ff6600' : '#2a2a3a'}`,
                    color: periodo === p ? '#ff6600' : '#55556a',
                    borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
                    fontSize: 11, fontWeight: periodo === p ? 700 : 400, flex: 1,
                  }}>{labelPeriodo(p)}</button>
                ))}
              </div>
              {periodo === 'personalizado' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center', marginTop: 8 }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={S.inp as any} />
                  <span style={{ color: '#444', fontSize: 11, textAlign: 'center' as any }}>até</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={S.inp as any} />
                </div>
              )}
            </div>

            {/* ── Custo automático ── */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={S.label}>Custo Médio Ponderado (R$)</label>
                <button onClick={calcularCustoMedio} disabled={loadingCusto} style={{
                  background: 'transparent', border: '1px solid #2a2a3a', borderRadius: 6,
                  color: '#ff6600', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontWeight: 600,
                }}>
                  {loadingCusto ? '⏳' : '🔄 Recalcular'}
                </button>
              </div>

              {/* Card do custo calculado */}
              {!modoManual && (
                <div style={{
                  background: custoAuto !== null ? '#0f1a0f' : '#1a1a0f',
                  border: `1px solid ${custoAuto !== null ? '#22c55e33' : '#f59e0b33'}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 8,
                }}>
                  {loadingCusto ? (
                    <div style={{ fontSize: 12, color: '#55556a' }}>⏳ Calculando média ponderada...</div>
                  ) : custoAuto !== null ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#22c55e' }}>✅ Custo médio ponderado</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#22c55e', fontSize: 16 }}>{R(custoAuto)}</span>
                      </div>
                      {custoAutoInfo && (
                        <div style={{ fontSize: 10, color: '#44665a', marginTop: 4, lineHeight: 1.4 }}>{custoAutoInfo}</div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠️ {custoAutoInfo || 'Sem dados no período'}</div>
                  )}
                </div>
              )}

              {/* Toggle modo manual */}
              <button onClick={() => setModoManual(m => !m)} style={{
                background: 'transparent', border: 'none', color: '#55556a',
                fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline',
                marginBottom: modoManual ? 8 : 0,
              }}>
                {modoManual ? '← Usar custo automático' : '✏️ Inserir custo manualmente'}
              </button>

              {modoManual && (
                <input
                  type="number" step="0.01" min="0"
                  value={custoManual}
                  onChange={e => setCustoManual(e.target.value)}
                  placeholder="ex: 17,45"
                  style={S.inp as any}
                />
              )}
            </div>

            {/* Preço de venda */}
            <div style={{ marginBottom: 4 }}>
              <label style={S.label}>Preço de Venda (R$)</label>
              <input type="number" step="0.01" min="0" value={preco} onChange={e => setPreco(e.target.value)}
                placeholder="ex: 51,79" style={S.inp as any} />
            </div>
          </div>

          {/* Parâmetros */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 14, letterSpacing: 0.5 }}>⚙️ PARÂMETROS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Taxa Shopee (%)</label>
                <input type="number" step="0.1" min="0" max="100" value={taxaShopee}
                  onChange={e => setTaxaShopee(e.target.value)} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Taxa Fixa Shopee (R$)</label>
                <input type="number" step="0.01" min="0" value={taxaFixa}
                  onChange={e => setTaxaFixa(e.target.value)} style={S.inp as any} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Imposto (%)</label>
                <input type="number" step="0.1" min="0" max="100" value={imposto}
                  onChange={e => setImposto(e.target.value)} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Meta de Lucro (%)</label>
                <input type="number" step="0.1" min="0" max="100" value={metaLucro}
                  onChange={e => setMetaLucro(e.target.value)} style={S.inp as any} />
              </div>
            </div>
          </div>

          {/* Análise do ROAS atual */}
          <div style={S.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9', marginBottom: 4, letterSpacing: 0.5 }}>📊 ANALISAR CAMPANHA ATUAL</div>
            <div style={{ fontSize: 10, color: '#44445a', marginBottom: 14 }}>Opcional — analisa se sua campanha atual está dentro do ideal</div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>ROAS atual da campanha</label>
              <input type="number" step="0.01" min="0" value={roasAtual}
                onChange={e => setRoasAtual(e.target.value)} placeholder="ex: 3.5" style={S.inp as any} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Gasto em Ads (R$)</label>
                <input type="number" step="0.01" min="0" value={gastoAds}
                  onChange={e => setGastoAds(e.target.value)} placeholder="ex: 120,00" style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Vendas geradas</label>
                <input type="number" step="1" min="0" value={vendasGeradas}
                  onChange={e => setVendasGeradas(e.target.value)} placeholder="ex: 8" style={S.inp as any} />
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — Resultados */}
        {!calc ? (
          <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <div style={{ textAlign: 'center' as any, color: '#44445a' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🧮</div>
              <div style={{ fontSize: 13 }}>Preencha o preço de venda para calcular</div>
              {custoAuto === null && !loadingCusto && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
                  ⚠️ Sem vendas no período — insira o custo manualmente
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Banner do período usado */}
            <div style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as any }}>
              <span style={{ fontSize: 11, color: '#55556a' }}>📅 Custo baseado em:</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ff6600' }}>{labelPeriodo(periodo)}</span>
              {periodoFrom && periodoTo && (
                <span style={{ fontSize: 11, color: '#44445a' }}>
                  ({periodoFrom.split('-').reverse().join('/')} → {periodoTo.split('-').reverse().join('/')})
                </span>
              )}
              <span style={{ fontSize: 11, color: '#55556a', marginLeft: 'auto' as any }}>
                Custo usado: <strong style={{ color: '#e2e2f0', fontFamily: 'monospace' }}>{R(custoProduto)}</strong>
                {modoManual && <span style={{ color: '#f59e0b', marginLeft: 4 }}>(manual)</span>}
              </span>
            </div>

            {/* Gauges ROAS */}
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c0c0d8', marginBottom: 16, letterSpacing: 0.5 }}>📈 ROAS NECESSÁRIO</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ textAlign: 'center' as any }}>
                  <Gauge value={calc.roasEmpate} max={Math.max(calc.roasIdeal * 1.2, 10)} label="Empate" color="#f59e0b" size={130} />
                  <div style={{ fontSize: 10, color: '#55556a', marginTop: 4 }}>mínimo para não perder</div>
                </div>
                <div style={{ width: 1, height: 80, background: '#2a2a3a' }} />
                <div style={{ textAlign: 'center' as any }}>
                  <Gauge value={calc.roasIdeal} max={Math.max(calc.roasIdeal * 1.2, 10)} label={`Meta ${(calc.meta*100).toFixed(0)}%`} color="#22c55e" size={130} />
                  <div style={{ fontSize: 10, color: '#55556a', marginTop: 4 }}>para atingir {Pf(calc.meta)} de lucro</div>
                </div>
                {+roasAtual > 0 && (
                  <>
                    <div style={{ width: 1, height: 80, background: '#2a2a3a' }} />
                    <div style={{ textAlign: 'center' as any }}>
                      <Gauge value={+roasAtual} max={Math.max(calc.roasIdeal * 1.2, 10)}
                        label="Atual" color={+roasAtual >= calc.roasIdeal ? '#22c55e' : +roasAtual >= calc.roasEmpate ? '#f59e0b' : '#ef4444'} size={130} />
                      <div style={{ fontSize: 10, color: '#55556a', marginTop: 4 }}>sua campanha agora</div>
                    </div>
                  </>
                )}
              </div>

              {+roasAtual > 0 && calc.analiseRoas && (
                <div style={{ padding: '12px 14px', background: '#13131e', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as any }}>
                  <StatusBadge ok={calc.analiseRoas.empata} msg={calc.analiseRoas.empata ? 'Acima do empate' : 'Abaixo do empate — prejuízo'} />
                  <StatusBadge ok={calc.analiseRoas.atinjeMeta} msg={calc.analiseRoas.atinjeMeta ? `Atingindo meta de ${Pf(calc.meta)}` : `Abaixo da meta de ${Pf(calc.meta)}`} />
                  <div style={{ marginLeft: 'auto' as any, fontFamily: 'monospace', fontSize: 12 }}>
                    Lucro estimado por venda:
                    <span style={{ color: calc.analiseRoas.lucro >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, marginLeft: 6 }}>
                      {R(calc.analiseRoas.lucro)} ({Pf(calc.analiseRoas.lucroP)})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Decomposição financeira */}
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c0c0d8', marginBottom: 14, letterSpacing: 0.5 }}>💰 DECOMPOSIÇÃO POR VENDA</div>
              <ResultRow label="Preço de Venda" value={R(calc.preco)} />
              <ResultRow label={`Taxa Shopee (${(calc.taxaPct*100).toFixed(0)}% + ${R(+taxaFixa||0)} fixo)`} value={`-${R(calc.taxa)}`} color="#f59e0b" />
              <ResultRow label="Custo do Produto" value={`-${R(calc.cp)}`} color="#888" />
              <ResultRow label={`Imposto (${(calc.imp*100).toFixed(0)}%)`} value={`-${R(calc.valorImp)}`} color="#666" />
              <div style={{ margin: '8px 0' }} />
              <ResultRow label="Margem antes de Ads" value={`${R(calc.margemSemAds)} (${Pf(calc.margemSemAdsPct)})`}
                color={calc.margemSemAds > 0 ? '#a78bfa' : '#ef4444'} highlight />
            </div>

            {/* CPA */}
            <div style={S.card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c0c0d8', marginBottom: 14, letterSpacing: 0.5 }}>🎯 CUSTO POR CONVERSÃO (CPA)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ background: '#1a1a26', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: '#55556a', marginBottom: 4, textTransform: 'uppercase' as any, letterSpacing: 0.5 }}>CPA Máximo (empate)</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#f59e0b', fontSize: 16 }}>{R(calc.cpaEmpate)}</div>
                  <div style={{ fontSize: 10, color: '#44445a', marginTop: 3 }}>pagar mais = prejuízo</div>
                </div>
                <div style={{ background: '#1a1a26', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: '#55556a', marginBottom: 4, textTransform: 'uppercase' as any, letterSpacing: 0.5 }}>CPA Ideal (meta {(calc.meta*100).toFixed(0)}%)</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#22c55e', fontSize: 16 }}>{R(calc.cpaIdeal)}</div>
                  <div style={{ fontSize: 10, color: '#44445a', marginTop: 3 }}>para atingir sua meta</div>
                </div>
              </div>

              {calc.analiseCpa && (
                <div style={{ padding: '12px 14px', background: '#13131e', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#9090aa' }}>CPA atual da campanha</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: calc.analiseCpa.ok ? '#22c55e' : '#ef4444' }}>{R(calc.analiseCpa.cpaReal)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as any }}>
                    <StatusBadge ok={calc.analiseCpa.ok} msg={calc.analiseCpa.ok ? 'Abaixo do CPA máximo ✓' : 'Acima do CPA máximo — prejuízo'} />
                    <StatusBadge ok={calc.analiseCpa.okIdeal} msg={calc.analiseCpa.okIdeal ? 'Dentro do CPA ideal ✓' : 'Acima do CPA ideal'} />
                  </div>
                  <div style={{ marginTop: 10, height: 8, background: '#1e1e2c', borderRadius: 4, position: 'relative' as any }}>
                    {calc.cpaEmpate > 0 && (
                      <div style={{ position: 'absolute' as any, height: '100%', width: `${Math.min((calc.analiseCpa.cpaReal / (calc.cpaEmpate * 1.5)) * 100, 100)}%`, background: calc.analiseCpa.ok ? '#22c55e' : '#ef4444', borderRadius: 4, opacity: 0.7 }} />
                    )}
                    {calc.cpaEmpate > 0 && (
                      <div style={{ position: 'absolute' as any, left: `${(calc.cpaIdeal / (calc.cpaEmpate * 1.5)) * 100}%`, top: -3, width: 2, height: 14, background: '#22c55e', borderRadius: 1 }} />
                    )}
                    {calc.cpaEmpate > 0 && (
                      <div style={{ position: 'absolute' as any, left: `${Math.min((calc.cpaEmpate / (calc.cpaEmpate * 1.5)) * 100, 100)}%`, top: -3, width: 2, height: 14, background: '#f59e0b', borderRadius: 1 }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 9, color: '#33334a' }}>
                    <span>🟢 CPA ideal: {R(calc.cpaIdeal)}</span>
                    <span>🟡 CPA máx: {R(calc.cpaEmpate)}</span>
                    <span style={{ color: calc.analiseCpa.ok ? '#22c55e' : '#ef4444' }}>● Atual: {R(calc.analiseCpa.cpaReal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Resumo para tomada de decisão */}
            <div style={{ ...S.card, background: '#13131e', border: '1px solid #2a2a3a' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c0c0d8', marginBottom: 12, letterSpacing: 0.5 }}>💡 RESUMO PARA DECISÃO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'ROAS de Empate', v: `${calc.roasEmpate.toFixed(2)}x`, desc: 'ROAS mínimo aceitável', cor: '#f59e0b' },
                  { label: 'ROAS Ideal',     v: `${calc.roasIdeal > 0 ? calc.roasIdeal.toFixed(2) : '∞'}x`, desc: `Para ${Pf(calc.meta)} de lucro`, cor: '#22c55e' },
                  { label: 'CPA Máximo',     v: R(calc.cpaEmpate), desc: 'Não pague mais que isso', cor: '#f59e0b' },
                  { label: 'CPA Ideal',      v: R(calc.cpaIdeal),  desc: `Para ${Pf(calc.meta)} de lucro`, cor: '#22c55e' },
                ].map((k, i) => (
                  <div key={i} style={{ background: '#16161f', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${k.cor}` }}>
                    <div style={{ fontSize: 10, color: '#55556a', marginBottom: 3, textTransform: 'uppercase' as any, letterSpacing: 0.5 }}>{k.label}</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: k.cor, fontSize: 15 }}>{k.v}</div>
                    <div style={{ fontSize: 10, color: '#44445a', marginTop: 2 }}>{k.desc}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
