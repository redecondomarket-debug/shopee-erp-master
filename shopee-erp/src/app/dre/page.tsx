'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20
const TAXA_FIXA   = 4.00
const DEFAULT_IMPOSTO = 0.06

const D = (s: string) => { if (!s) return ""; const [y,m,d] = String(s).slice(0,10).split("-"); return d && m && y ? `${d}/${m}/${y}` : s }
const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:    { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:   { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any },
  btnSm: { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
}

function Badge({ children, color = '#ff6600' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{children}</span>
}
function StatusBadge({ v }: { v: number }) {
  if (v >= 0.20) return <Badge color="#22c55e">▲ {P(v)}</Badge>
  if (v >= 0.10) return <Badge color="#f59e0b">● {P(v)}</Badge>
  return <Badge color="#ef4444">▼ {P(v)}</Badge>
}

export default function DREPage() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [ads,        setAds]        = useState<any[]>([])
  const [skuMap,     setSkuMap]     = useState<any[]>([])
  const [estoque,    setEstoque]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lojaFiltro, setLojaFiltro] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [imposto,    setImposto]    = useState(DEFAULT_IMPOSTO)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [modo,       setModo]       = useState<'resumido' | 'porLoja'>('resumido')
  const [periodo,    setPeriodo]    = useState('personalizado')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, adsRes, mapRes, estRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000),
      supabase.from('ads').select('*').order('data', { ascending: false }),
      supabase.from('sku_map').select('*'),
      supabase.from('estoque').select('*'),
    ])
    setFinanceiro(finRes.data || [])
    setAds(adsRes.data || [])
    setSkuMap(mapRes.data || [])
    setEstoque(estRes.data || [])
    setLoading(false)
  }

  function aplicarPeriodo(p: string) {
    setPeriodo(p)
    const hoje = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0,10)
    if (p === 'hoje') { setDateFrom(fmt(hoje)); setDateTo(fmt(hoje)) }
    else if (p === 'ontem') { const d = new Date(hoje); d.setDate(d.getDate()-1); setDateFrom(fmt(d)); setDateTo(fmt(d)) }
    else if (p === 'semana') { const d = new Date(hoje); d.setDate(d.getDate()-6); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'mes') { const d = new Date(hoje); d.setDate(d.getDate()-29); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'tudo') { setDateFrom(''); setDateTo('') }
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

  // ── Calcular linhas por dia×loja (idêntico ao TabDRE do App.js) ──────────
  const rows = useMemo(() => {
    const keys = Array.from(new Set(finF.map(f => modo === 'resumido' ? f.data : `${f.data}||${f.loja}`)))
    return keys.sort().reverse().map(k => {
      const [data, loja] = modo === 'resumido' ? [k, null] : k.split('||')
      const lp    = modo === 'resumido'
        ? finF.filter(f => f.data === data)
        : finF.filter(f => f.data === data && f.loja === loja)

      const rec   = lp.reduce((s, f) => s + (f.valor_bruto || 0), 0)
      const taxas = lp.reduce((s, f) => {
        const rb = f.valor_bruto || 0
        const ts = (f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : rb * TAXA_SHOPEE
        return s + ts
      }, 0)
      const cprod = lp.reduce((s, f) => {
        const sku = f.sku || ''
        const calc = calcCustoProd(sku, f.quantidade || 1)
        return s + ((f.custo_produto && f.custo_produto > 0) ? f.custo_produto : calc)
      }, 0)
      const cemb  = lp.reduce((s, f) => s + (f.custo_embalagem || 0), 0)
      const imp   = rec * imposto
      const lucOp = rec - taxas - cprod - cemb - imp
      const gads  = (modo === 'resumido'
        ? adsF.filter(a => a.data === data)
        : adsF.filter(a => a.data === data && a.loja === loja)
      ).reduce((s, a) => s + (a.gasto || a.investimento || 0), 0)
      const ll     = lucOp - gads
      const peds   = new Set(lp.map(f => f.pedido)).size

      const mc     = rec - taxas - cprod - cemb   // MC = Receita - Custos Variáveis (sem imposto e ads)
      const mcPct  = rec > 0 ? mc / rec : 0

      // Por loja (para modo resumido expandido)
      const porLoja = LOJAS.map(l => {
        const lf    = finF.filter(f => f.data === data && f.loja === l)
        const r2    = lf.reduce((s, f) => s + (f.valor_bruto || 0), 0)
        const t2    = lf.reduce((s, f) => {
          const rb = f.valor_bruto || 0
          const ts = (f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : rb * TAXA_SHOPEE
          const tf = TAXA_FIXA
          return s + ts + tf
        }, 0)
        const i2    = r2 * imposto
        const cp2   = lf.reduce((s, f) => {
          const sku = f.sku || ''
          const calc = calcCustoProd(sku, f.quantidade || 1)
          return s + ((f.custo_produto && f.custo_produto > 0) ? f.custo_produto : calc)
        }, 0)
        const ce2   = lf.reduce((s, f) => s + (f.custo_embalagem || 0), 0)
        const mc2   = r2 - t2 - cp2 - ce2
        const lo2   = mc2 - i2
        const g2    = adsF.filter(a => a.data === data && a.loja === l).reduce((s, a) => s + (a.gasto || a.investimento || 0), 0)
        return { loja: l, rec: r2, taxas: t2, imp: i2, mc: mc2, mcPct: r2 > 0 ? mc2 / r2 : 0, lucOp: lo2, gads: g2, ll: lo2 - g2, peds: new Set(lf.map(f => f.pedido)).size }
      })

      return { data, loja, rec, taxas, cprod, cemb, imp, mc, mcPct, lucOp, gads, ll, peds, margem: rec > 0 ? ll / rec : 0, porLoja }
    })
  }, [finF, adsF, skuMap, estoque, imposto, modo])

  const tot = useMemo(() => {
    const t = { rec: 0, taxas: 0, cprod: 0, cemb: 0, imp: 0, mc: 0, lucOp: 0, gads: 0, ll: 0, peds: 0 }
    rows.forEach(r => Object.keys(t).forEach(k => (t as any)[k] += (r as any)[k] || 0))
    return { ...t, mcPct: t.rec > 0 ? t.mc / t.rec : 0 }
  }, [rows])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>📊 DRE Diário — Resultado Consolidado</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['resumido', '📅 Resumido'], ['porLoja', '🏪 Por Loja']] .map(([id, label]) => (
            <button key={id} onClick={() => setModo(id as any)} style={{
              background: modo === id ? '#ff660033' : 'transparent',
              border: `1px solid ${modo === id ? '#ff6600' : '#2a2a3a'}`,
              color: modo === id ? '#ff6600' : '#555',
              borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: modo === id ? 700 : 400
            }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Imposto</span>
          <input type="number" value={(imposto * 100).toFixed(1)} onChange={e => setImposto(+e.target.value / 100)}
            style={{ ...S.inp, width: 60, textAlign: 'center' as any }} step="0.1" />
          <span style={{ fontSize: 11, color: '#888' }}>%</span>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={lojaFiltro} onChange={e => setLojaFiltro(e.target.value)} style={{ ...S.inp, width: 200, fontSize: 12 } as any}>
          <option value="Todas">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {(['hoje','ontem','semana','mes','tudo','personalizado'] as const).map(p => (
          <button key={p} onClick={() => aplicarPeriodo(p)} style={{
            background: periodo === p ? '#ff6600' : '#13131e',
            color: periodo === p ? '#fff' : '#9090aa',
            border: `1px solid ${periodo === p ? '#ff6600' : '#2a2a3a'}`,
            borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: 11,
          }}>
            {p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : p === 'semana' ? 'Última Semana' : p === 'mes' ? 'Último Mês' : p === 'tudo' ? 'Tudo' : 'Personalizado'}
          </button>
        ))}
        {periodo === 'personalizado' && <>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 150 } as any} />
          <span style={{ color: '#555', fontSize: 12 }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 150 } as any} />
        </>}
      </div>

      {/* KPIs */}
      <div style={{ ...S.card, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', padding: '12px 16px' }}>
        {[
          ['Receita Total',          R(tot.rec),                                       '#ff9933'],
          ['Margem de Contribuição', `${R(tot.mc)} (${P(tot.mcPct)})`,                 tot.mcPct >= 0.30 ? '#22c55e' : tot.mcPct >= 0.15 ? '#f59e0b' : '#ef4444'],
          ['Lucro Líquido Real',     R(tot.ll),                                        tot.ll >= 0 ? '#22c55e' : '#ef4444'],
          ['Taxas Shopee',           R(tot.taxas),                                     '#f59e0b'],
          ['Custo Produtos',         R(tot.cprod),                                     '#888'],
          ['Impostos',               R(tot.imp),                                       '#666'],
          ['Gasto Ads Total',        R(tot.gads),                                      '#e67e22'],
        ].map(([l, v, c]) => (
          <div key={l as string}>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: c as string, fontSize: 15 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* TABELA PRINCIPAL */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Data', ...(modo === 'porLoja' ? ['Loja'] : []), 'Pedidos', 'Receita Bruta', 'Taxas Shopee', 'Custo Prod', 'Custo Emb', 'Mg Contribuição', 'Mg Contrib %', 'Impostos', 'Lucro Op', 'Gasto Ads', 'Lucro Líq Real', 'Margem Líq'].map(h => (
                  <th key={h} style={S.th as any}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <>
                  <tr key={r.data + (r.loja || '')}
                    onClick={() => modo === 'resumido' && setExpanded(expanded === r.data ? null : r.data)}
                    style={{ cursor: modo === 'resumido' ? 'pointer' : 'default', borderBottom: '1px solid #1e1e2a' }}
                  >
                    <td style={S.td as any}>
                      <span style={{ fontFamily: 'monospace' }}>{D(r.data)}</span>
                      {modo === 'resumido' && <span style={{ marginLeft: 6, fontSize: 10, color: '#555' }}>{expanded === r.data ? '▲' : '▼'}</span>}
                    </td>
                    {modo === 'porLoja' && (
                      <td style={S.td as any}><span style={{ color: LOJA_COLORS[r.loja!] || '#ff6600', fontWeight: 600, fontSize: 11 }}>{r.loja}</span></td>
                    )}
                    <td style={S.td as any}>{N(r.peds)}</td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace' }}>{R(r.rec)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{R(r.taxas)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace' }}>{R(r.cprod)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace' }}>{R(r.cemb)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: r.mc >= 0 ? '#a78bfa' : '#ef4444' }}>{R(r.mc)}</span></td>
                    <td style={S.td as any}><span style={{ background: r.mcPct >= 0.30 ? '#22c55e22' : r.mcPct >= 0.15 ? '#f59e0b22' : '#ef444422', color: r.mcPct >= 0.30 ? '#22c55e' : r.mcPct >= 0.15 ? '#f59e0b' : '#ef4444', border: `1px solid ${r.mcPct >= 0.30 ? '#22c55e44' : r.mcPct >= 0.15 ? '#f59e0b44' : '#ef444444'}`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{P(r.mcPct)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace' }}>{R(r.imp)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: r.lucOp >= 0 ? '#22c55e' : '#ef4444' }}>{R(r.lucOp)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#e67e22' }}>{R(r.gads)}</span></td>
                    <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: r.ll >= 0 ? '#22c55e' : '#ef4444' }}>{R(r.ll)}</span></td>
                    <td style={S.td as any}><StatusBadge v={r.margem} /></td>
                  </tr>

                  {/* EXPANSÃO POR LOJA (modo resumido) */}
                  {modo === 'resumido' && expanded === r.data && r.porLoja.filter(l => l.rec > 0).map(l => (
                    <tr key={l.loja} style={{ background: '#13131e', borderBottom: '1px solid #1e1e2a' }}>
                      <td style={{ ...S.td as any, paddingLeft: 28, fontSize: 11 }}>
                        <span style={{ color: LOJA_COLORS[l.loja], fontWeight: 700 }}>↳ {l.loja}</span>
                      </td>
                      <td style={S.td as any}>{N(l.peds)}</td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{R(l.rec)}</span></td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f59e0b' }}>{R(l.taxas)}</span></td>
                      <td style={S.td as any}>—</td>
                      <td style={S.td as any}>—</td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: l.mc >= 0 ? '#a78bfa' : '#ef4444' }}>{R(l.mc)}</span></td>
                      <td style={S.td as any}><span style={{ background: l.mcPct >= 0.30 ? '#22c55e22' : l.mcPct >= 0.15 ? '#f59e0b22' : '#ef444422', color: l.mcPct >= 0.30 ? '#22c55e' : l.mcPct >= 0.15 ? '#f59e0b' : '#ef4444', border: `1px solid ${l.mcPct >= 0.30 ? '#22c55e44' : l.mcPct >= 0.15 ? '#f59e0b44' : '#ef444444'}`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{P(l.mcPct)}</span></td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{R(l.imp)}</span></td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11, color: l.lucOp >= 0 ? '#22c55e' : '#ef4444' }}>{R(l.lucOp)}</span></td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#e67e22' }}>{R(l.gads)}</span></td>
                      <td style={S.td as any}><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: l.ll >= 0 ? '#22c55e' : '#ef4444' }}>{R(l.ll)}</span></td>
                      <td style={S.td as any}><StatusBadge v={l.rec > 0 ? l.ll / l.rec : 0} /></td>
                    </tr>
                  ))}
                </>
              ))}

              {/* LINHA TOTAL */}
              <tr style={{ background: '#0f0f13', borderTop: '2px solid #2a2a3a' }}>
                <td style={{ ...S.td as any, fontWeight: 800 }}>TOTAL GERAL</td>
                {modo === 'porLoja' && <td style={S.td as any} />}
                <td style={{ ...S.td as any, fontWeight: 800 }}>{N(tot.peds)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: '#ff9933' }}>{R(tot.rec)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: '#f59e0b' }}>{R(tot.taxas)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800 }}>{R(tot.cprod)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800 }}>{R(tot.cemb)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: '#a78bfa' }}>{R(tot.mc)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: tot.mcPct >= 0.30 ? '#22c55e' : tot.mcPct >= 0.15 ? '#f59e0b' : '#ef4444' }}>{P(tot.mcPct)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800 }}>{R(tot.imp)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: tot.lucOp >= 0 ? '#22c55e' : '#ef4444' }}>{R(tot.lucOp)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: '#e67e22' }}>{R(tot.gads)}</td>
                <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 800, color: tot.ll >= 0 ? '#22c55e' : '#ef4444' }}>{R(tot.ll)}</td>
                <td style={S.td as any}><StatusBadge v={tot.rec > 0 ? tot.ll / tot.rec : 0} /></td>
              </tr>

              {rows.length === 0 && (
                <tr><td colSpan={12} style={{ ...S.td as any, textAlign: 'center', padding: 48, color: '#555' }}>Sem dados no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
