'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600', 'UNIVERSO DOS ACHADOS': '#0ea5e9', 'MUNDO DOS ACHADOS': '#a855f7'
}
const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

const CLASS_COLOR = { A: '#22c55e', B: '#f59e0b', C: '#ef4444' }
const CLASS_BG    = { A: '#22c55e22', B: '#f59e0b22', C: '#ef444422' }
const CLASS_LABEL = { A: 'Classe A — 80% do faturamento', B: 'Classe B — 15% do faturamento', C: 'Classe C — 5% do faturamento' }

const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:    { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:   { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any },
  btnSm: { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
}

type CurvaItem = {
  sku: string; produto: string; unidades: number; faturamento: number
  participacao: number; acumulado: number; classe: 'A' | 'B' | 'C'
}

export default function CurvaABCPage() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lojaFiltro, setLojaFiltro] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [periodo,    setPeriodo]    = useState('personalizado')
  const [classFiltro,setClassFiltro]= useState<'all' | 'A' | 'B' | 'C'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('financeiro').select('sku,produto,quantidade,valor_bruto,loja,data').limit(5000)
    setFinanceiro(data || [])
    setLoading(false)
  }

  function aplicarPeriodo(p: string) {
    setPeriodo(p)
    const hoje = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0,10)
    if (p === 'hoje')    { setDateFrom(fmt(hoje)); setDateTo(fmt(hoje)) }
    else if (p === 'ontem') { const d = new Date(hoje); d.setDate(d.getDate()-1); setDateFrom(fmt(d)); setDateTo(fmt(d)) }
    else if (p === 'semana'){ const d = new Date(hoje); d.setDate(d.getDate()-6); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'mes')   { const d = new Date(hoje); d.setDate(d.getDate()-29); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'tudo')  { setDateFrom(''); setDateTo('') }
  }

  const curva: CurvaItem[] = useMemo(() => {
    const filtrado = financeiro.filter(f => {
      if (lojaFiltro !== 'Todas' && f.loja !== lojaFiltro) return false
      if (dateFrom && f.data < dateFrom) return false
      if (dateTo   && f.data > dateTo)   return false
      return true
    })
    if (!filtrado.length) return []

    const map: Record<string, { produto: string; unidades: number; faturamento: number }> = {}
    filtrado.forEach(f => {
      const sku = f.sku || 'SEM SKU'
      if (!map[sku]) map[sku] = { produto: f.produto || sku, unidades: 0, faturamento: 0 }
      map[sku].unidades   += f.quantidade   || 1
      map[sku].faturamento += f.valor_bruto || 0
    })

    const total  = Object.values(map).reduce((s, i) => s + i.faturamento, 0)
    const sorted = Object.entries(map).sort((a, b) => b[1].faturamento - a[1].faturamento)

    let acum = 0
    return sorted.map(([sku, val]) => {
      const part = total > 0 ? (val.faturamento / total) * 100 : 0
      acum += part
      const classe: 'A' | 'B' | 'C' = acum <= 80 ? 'A' : acum <= 95 ? 'B' : 'C'
      return { sku, produto: val.produto, unidades: val.unidades, faturamento: val.faturamento, participacao: part, acumulado: acum, classe }
    })
  }, [financeiro, lojaFiltro, dateFrom, dateTo])

  const filtered = classFiltro === 'all' ? curva : curva.filter(c => c.classe === classFiltro)
  const totA = curva.filter(c => c.classe === 'A').length
  const totB = curva.filter(c => c.classe === 'B').length
  const totC = curva.filter(c => c.classe === 'C').length
  const totalFat = curva.reduce((s, c) => s + c.faturamento, 0)
  const maxFat   = curva.length > 0 ? curva[0].faturamento : 1

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>📊 Curva ABC</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>{curva.length} SKUs analisados · {R(totalFat)} faturamento total</p>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={lojaFiltro} onChange={e => setLojaFiltro(e.target.value)} style={{ ...S.inp, width: 200 } as any}>
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

      {/* CARDS A/B/C */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {(['A','B','C'] as const).map(cls => (
          <div key={cls} onClick={() => setClassFiltro(classFiltro === cls ? 'all' : cls)}
            style={{ ...S.card, cursor: 'pointer', border: `1px solid ${classFiltro === cls ? CLASS_COLOR[cls] : '#222232'}`, transition: 'all .15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: CLASS_BG[cls], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: CLASS_COLOR[cls], flexShrink: 0 }}>{cls}</div>
              <div>
                <div style={{ fontSize: 10, color: '#55556a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{CLASS_LABEL[cls]}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: CLASS_COLOR[cls], marginTop: 2 }}>
                  {cls === 'A' ? totA : cls === 'B' ? totB : totC} SKUs
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GRÁFICO DE BARRAS */}
      {curva.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8', marginBottom: 14 }}>🏆 Top 10 SKUs por Faturamento</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '4px 0' }}>
            {curva.slice(0, 10).map((item, i) => {
              const h = Math.max((item.faturamento / maxFat) * 110, 4)
              return (
                <div key={item.sku} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: '#55556a', fontFamily: 'monospace' }}>{R(item.faturamento).replace('R$\u00a0','R$')}</div>
                  <div style={{ width: '100%', height: h, background: CLASS_COLOR[item.classe], borderRadius: '3px 3px 0 0', transition: 'height .3s', opacity: 0.85 }} />
                  <div style={{ fontSize: 9, color: '#9090aa', fontFamily: 'monospace', textAlign: 'center', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            {(['A','B','C'] as const).map(cls => (
              <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9090aa' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: CLASS_COLOR[cls] }} />
                Classe {cls}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELA */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Rank', 'SKU', 'Produto', 'Unidades', 'Faturamento', '% Part.', '% Acum.', 'Classe'].map(h => (
                  <th key={h} style={{ ...S.th, textAlign: ['Unidades','Faturamento','% Part.','% Acum.'].includes(h) ? 'center' as any : S.th.textAlign }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: 48, color: '#55556a' }}>Sem dados no período</td></tr>
              ) : filtered.map((item, i) => (
                <tr key={item.sku} style={{ borderLeft: `3px solid ${CLASS_COLOR[item.classe]}` }}>
                  <td style={S.td}><span style={{ color: '#55556a', fontFamily: 'monospace', fontSize: 11 }}>#{curva.indexOf(item) + 1}</span></td>
                  <td style={S.td}><span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 700 }}>{item.sku}</span></td>
                  <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.produto}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontFamily: 'monospace' }}>{N(item.unidades)}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{R(item.faturamento)}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontFamily: 'monospace' }}>{item.participacao.toFixed(1)}%</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <div style={{ height: 4, background: '#1e1e2a', borderRadius: 2, width: 80, margin: '0 auto' }}>
                      <div style={{ height: '100%', width: `${Math.min(item.acumulado, 100)}%`, background: CLASS_COLOR[item.classe], borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#9090aa', marginTop: 2 }}>{item.acumulado.toFixed(1)}%</div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' as any }}>
                    <span style={{ background: CLASS_BG[item.classe], color: CLASS_COLOR[item.classe], border: `1px solid ${CLASS_COLOR[item.classe]}44`, borderRadius: 5, padding: '3px 12px', fontSize: 12, fontWeight: 800 }}>
                      {item.classe}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
