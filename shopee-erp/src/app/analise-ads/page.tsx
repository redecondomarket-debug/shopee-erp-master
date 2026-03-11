'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20
const TAXA_FIXA   = 4.05
const DEFAULT_IMPOSTO = 0.06

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`

const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10, padding: 16 },
  th:    { padding: '8px 12px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 0.8, textTransform: 'uppercase' as any, borderBottom: '1px solid #2a2a3a', whiteSpace: 'nowrap' as any },
  td:    { padding: '7px 12px', fontSize: 12.5, borderBottom: '1px solid #1e1e2a', whiteSpace: 'nowrap' as any },
  inp:   { background: '#0f0f13', border: '1px solid #2a2a3a', borderRadius: 6, padding: '5px 8px', color: '#e8e8f0', fontSize: 12, outline: 'none' },
  btnSm: { background: '#ff660022', color: '#ff6600', border: '1px solid #ff660044', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
}

function Badge({ children, color = '#ff6600' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{children}</span>
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
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '4px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', background: colorFn ? colorFn(i) : '#ff6600', borderRadius: '3px 3px 0 0', height: `${(d.v / max) * (height - 20)}px`, minHeight: d.v > 0 ? 3 : 0, transition: 'height .4s' }} />
          <span style={{ fontSize: 9, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60, textOverflow: 'ellipsis', textAlign: 'center' }}>{d.l}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnaliseAdsPage() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [ads,        setAds]        = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lojaFiltro, setLojaFiltro] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [imposto,    setImposto]    = useState(DEFAULT_IMPOSTO)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, adsRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000),
      supabase.from('ads').select('*').order('data', { ascending: false }),
    ])
    setFinanceiro(finRes.data || [])
    setAds(adsRes.data || [])
    setLoading(false)
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

  // Por loja (idêntico ao TabAnaliseAds do App.js)
  const lojasList = lojaFiltro === 'Todas' ? LOJAS : [lojaFiltro]
  const rows = useMemo(() => lojasList.map(loja => {
    const lp    = finF.filter(f => f.loja === loja)
    const rec   = lp.reduce((s, f) => s + (f.valor_bruto || 0), 0)
    const taxas = rec * TAXA_SHOPEE + lp.length * TAXA_FIXA
    const imp   = rec * imposto
    const lucOp = rec - taxas - imp
    const gads  = adsF.filter(a => a.loja === loja).reduce((s, a) => s + (a.gasto || a.investimento || 0), 0)
    const ll    = lucOp - gads
    return { loja, rec, lucOp, gads, ll, roas: gads > 0 ? rec / gads : 0, margem: rec > 0 ? ll / rec : 0 }
  }), [finF, adsF, imposto, lojaFiltro])

  const totRec = rows.reduce((s, r) => s + r.rec, 0)
  const totAds = rows.reduce((s, r) => s + r.gads, 0)
  const totLL  = rows.reduce((s, r) => s + r.ll, 0)
  const totLucOp = rows.reduce((s, r) => s + r.lucOp, 0)

  // Por dia
  const byDay: Record<string, number> = {}
  adsF.forEach(a => { byDay[a.data] = (byDay[a.data] || 0) + (a.gasto || a.investimento || 0) })
  const dayChart = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ l: d.slice(8,10) + '/' + d.slice(5,7), v }))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ff660033', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>📈 Análise de Anúncios — ROAS e Eficiência por Loja</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Imposto</span>
          <input type="number" value={(imposto * 100).toFixed(1)} onChange={e => setImposto(+e.target.value / 100)}
            style={{ ...S.inp, width: 55, textAlign: 'center' as any }} step="0.1" />
          <span style={{ fontSize: 11, color: '#888' }}>%</span>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={lojaFiltro} onChange={e => setLojaFiltro(e.target.value)} style={{ ...S.inp, width: 'auto', fontSize: 12 } as any}>
          <option>Todas</option>{LOJAS.map(l => <option key={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 140 } as any} />
        <span style={{ color: '#555', fontSize: 12 }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 140 } as any} />
        {(lojaFiltro !== 'Todas' || dateFrom || dateTo) && (
          <button onClick={() => { setLojaFiltro('Todas'); setDateFrom(''); setDateTo('') }} style={S.btnSm as any}>✕ Limpar</button>
        )}
      </div>

      {/* 4 KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI icon="💰" label="Receita Total"  value={R(totRec)}  color="#ff9933" />
        <KPI icon="📣" label="Total Ads"      value={R(totAds)}  color="#e67e22" />
        <KPI icon="⚡" label="ROAS Geral"     value={`${(totAds > 0 ? totRec / totAds : 0).toFixed(2)}x`} color={totAds > 0 && totRec / totAds >= 2 ? '#22c55e' : '#f59e0b'} />
        <KPI icon="✅" label="Lucro Líquido"  value={R(totLL)}   color={totLL >= 0 ? '#22c55e' : '#ef4444'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* TABELA POR LOJA */}
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>🏪 Por Loja</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Loja', 'Receita', 'Lucro Op', 'Gasto Ads', 'ROAS', 'Lucro Líq', 'Margem Líq'].map(h => (
                    <th key={h} style={S.th as any}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.loja} style={{ borderBottom: '1px solid #1e1e2a' }}>
                    <td style={S.td as any}><span style={{ color: LOJA_COLORS[r.loja], fontWeight: 700 }}>{r.loja}</span></td>
                    <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace' }}>{R(r.rec)}</span></td>
                    <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace', color: r.lucOp >= 0 ? '#22c55e' : '#ef4444' }}>{R(r.lucOp)}</span></td>
                    <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace', color: '#e67e22' }}>{R(r.gads)}</span></td>
                    <td style={S.td as any}><ROASBadge v={r.roas} /></td>
                    <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: r.ll >= 0 ? '#22c55e' : '#ef4444' }}>{R(r.ll)}</span></td>
                    <td style={S.td as any}><StatusBadge v={r.margem} /></td>
                  </tr>
                ))}
                <tr style={{ background: '#0f0f13', borderTop: '2px solid #2a2a3a' }}>
                  <td style={{ ...S.td as any, fontWeight: 800 }}>TOTAL</td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any, fontFamily: 'monospace', fontWeight: 800, color: '#ff9933' }}>{R(totRec)}</td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any, fontFamily: 'monospace', fontWeight: 800, color: totLucOp >= 0 ? '#22c55e' : '#ef4444' }}>{R(totLucOp)}</td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any, fontFamily: 'monospace', fontWeight: 800, color: '#e67e22' }}>{R(totAds)}</td>
                  <td style={S.td as any}><ROASBadge v={totAds > 0 ? totRec / totAds : 0} /></td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any, fontFamily: 'monospace', fontWeight: 800, color: totLL >= 0 ? '#22c55e' : '#ef4444' }}>{R(totLL)}</td>
                  <td style={S.td as any}><StatusBadge v={totRec > 0 ? totLL / totRec : 0} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* VISUALIZAÇÃO ROAS */}
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>⚡ ROAS por Loja</div>
          <MiniBar data={rows.map(r => ({ l: r.loja.split(' ')[0], v: r.roas }))} height={130} colorFn={i => [LOJA_COLORS[rows[i]?.loja] || '#ff6600'][0]} />
          <div style={{ marginTop: 12 }}>
            {rows.map(r => (
              <div key={r.loja} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '7px 12px', background: '#13131e', borderRadius: 6 }}>
                <span style={{ color: LOJA_COLORS[r.loja], fontWeight: 600, fontSize: 12 }}>{r.loja}</span>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ fontFamily: 'monospace' }}>{R(r.rec)}</span>
                  <span style={{ fontFamily: 'monospace', color: '#e67e22' }}>{R(r.gads)} ads</span>
                  <ROASBadge v={r.roas} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#555', borderTop: '1px solid #2a2a3a', paddingTop: 10 }}>
            🔴 ROAS &lt; 1 = prejuízo com ads · 🟡 1–2x = atenção · 🟢 &gt; 2x = campanha eficiente
          </div>
        </div>
      </div>

      {/* Ads por Dia */}
      {dayChart.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>📅 Gasto Ads por Dia</div>
          <MiniBar data={dayChart} height={100} colorFn={() => '#e67e22'} />
        </div>
      )}
    </div>
  )
}
