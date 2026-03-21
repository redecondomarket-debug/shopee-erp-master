'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTaxRate } from '@/hooks/useTaxRate'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

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
function MiniBar({ data, height = 100, colorFn }: { data: { l: string; v: number }[]; height?: number; colorFn?: (i: number) => string }) {
  const max = Math.max(...data.map(d => d.v), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '4px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', background: colorFn ? colorFn(i) : '#ff6600', borderRadius: '3px 3px 0 0', height: `${(d.v / max) * (height - 20)}px`, minHeight: d.v > 0 ? 3 : 0, transition: 'height .4s' }} />
          <span style={{ fontSize: 9, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 50, textOverflow: 'ellipsis', textAlign: 'center' }}>{d.l}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnaliseProdutosPage() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [ads,        setAds]        = useState<any[]>([])
  const [skuMapData, setSkuMapData] = useState<any[]>([])
  const [estoque,    setEstoque]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lojaFiltro, setLojaFiltro] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [busca,      setBusca]      = useState('')
  const [ordenar,    setOrdenar]    = useState<'rec' | 'qtd' | 'lucro' | 'margem'>('rec')

  // FIX: hook centralizado — lê e salva no localStorage, mesmo valor de todas as páginas
  const { imposto, impostoInput, setImpostoInput, salvarImposto } = useTaxRate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, adsRes, mapRes, estRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000),
      supabase.from('ads').select('*'),
      supabase.from('sku_map').select('*'),
      supabase.from('estoque').select('*'),
    ])
    setFinanceiro(finRes.data || [])
    setAds(adsRes.data || [])
    setSkuMapData(mapRes.data || [])
    setEstoque(estRes.data || [])
    setLoading(false)
  }

  const finF = useMemo(() => financeiro.filter(f => {
    if (lojaFiltro !== 'Todas' && f.loja !== lojaFiltro) return false
    if (dateFrom && f.data < dateFrom) return false
    if (dateTo && f.data > dateTo) return false
    return true
  }), [financeiro, lojaFiltro, dateFrom, dateTo])

  const adsF = useMemo(() => ads.filter(a => {
    if (lojaFiltro !== 'Todas' && a.loja !== lojaFiltro) return false
    if (dateFrom && a.data < dateFrom) return false
    if (dateTo && a.data > dateTo) return false
    return true
  }), [ads, lojaFiltro, dateFrom, dateTo])

  const totalAds = adsF.reduce((s, a) => s + (a.gasto || a.investimento || 0), 0)

  const skuMap = useMemo(() => {
    const map: Record<string, any> = {}
    finF.forEach(f => {
      const sku = f.sku || 'SEM SKU'
      if (!map[sku]) map[sku] = { sku, nome: f.nome_produto || f.produto || sku, rec: 0, lucro: 0, qtd: 0, lojas: new Set<string>() }

      const rec   = f.valor_bruto || 0
      // taxa real do banco quando disponível
      const taxas = (f.comissao_shopee && f.comissao_shopee > 0)
        ? f.comissao_shopee
        : rec * TAXA_SHOPEE

      // custo produto: banco tem prioridade, senão cruza sku_map + estoque
      let cProd = (f.custo_produto && f.custo_produto > 0) ? f.custo_produto : 0
      if (!cProd) {
        const comps = skuMapData.filter(m => m.sku_venda === sku)
        cProd = comps.reduce((t, c) => {
          const prod = estoque.find(e => e.sku_base === c.sku_base)
          return t + (prod?.custo || 0) * (c.quantidade || 1) * (f.quantidade || 1)
        }, 0)
      }

      // FIX: inclui custo embalagem (estava faltando)
      const cEmb = f.custo_embalagem || 0
      // FIX: imposto do hook
      const imp   = rec * imposto
      const lucro = rec - taxas - cProd - cEmb - imp

      map[sku].rec   += rec
      map[sku].lucro += lucro
      map[sku].qtd   += f.quantidade || 1
      map[sku].lojas.add(f.loja || '')
    })
    return map
  }, [finF, imposto, skuMapData, estoque])

  const totalRec = Object.values(skuMap).reduce((s: number, r: any) => s + r.rec, 0)

  const rows = useMemo(() => {
    return Object.values(skuMap)
      .map((s: any) => ({
        ...s,
        margem:     s.rec > 0 ? s.lucro / s.rec : 0,
        adsRateado: totalRec > 0 ? (s.rec / totalRec) * totalAds : 0,
        lucroLiq:   s.lucro - (totalRec > 0 ? (s.rec / totalRec) * totalAds : 0),
      }))
      .filter(s => !busca || s.sku.toLowerCase().includes(busca.toLowerCase()) || s.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a: any, b: any) => b[ordenar] - a[ordenar])
  }, [skuMap, busca, ordenar, totalAds, totalRec])

  const top10 = rows.slice(0, 10)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ff660033', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🔍 Análise de Produtos — Desempenho por SKU</h2>
        {/* FIX: input de imposto salva no localStorage via hook */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Imposto</span>
          <input type="number" value={impostoInput} onChange={e => setImpostoInput(e.target.value)}
            style={{ ...S.inp, width: 55, textAlign: 'center' as any }} step="0.1" />
          <span style={{ fontSize: 11, color: '#888' }}>%</span>
          <button onClick={() => salvarImposto()} style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>✓</button>
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
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar SKU..." style={{ ...S.inp, width: 160 } as any} />
        {(lojaFiltro !== 'Todas' || dateFrom || dateTo || busca) && (
          <button onClick={() => { setLojaFiltro('Todas'); setDateFrom(''); setDateTo(''); setBusca('') }} style={S.btnSm as any}>✕ Limpar</button>
        )}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[['rec', '$ Receita'], ['qtd', '# Qtd'], ['lucro', '✓ Lucro'], ['margem', '% Margem']].map(([id, label]) => (
            <button key={id} onClick={() => setOrdenar(id as any)} style={{ background: ordenar === id ? '#ff660033' : 'transparent', border: `1px solid ${ordenar === id ? '#ff6600' : '#2a2a3a'}`, color: ordenar === id ? '#ff6600' : '#555', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: ordenar === id ? 700 : 400 }}>{label}</button>
          ))}
        </div>
      </div>

      {/* LEGENDA */}
      <div style={{ ...S.card, marginBottom: 12, padding: '8px 14px' }}>
        <span style={{ fontSize: 11, color: '#555' }}>
          🔴 Margem &lt; 10% — Crítico &nbsp;·&nbsp; 🟡 10–20% — Atenção &nbsp;·&nbsp; 🟢 &gt; 20% — Saudável
          &nbsp;·&nbsp; <span style={{ color: '#e67e22' }}>Ads rateados proporcionalmente ao faturamento de cada SKU</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* GRÁFICO TOP 10 */}
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>📊 Top 10 SKUs — {ordenar === 'rec' ? 'Receita' : ordenar === 'qtd' ? 'Qtd' : ordenar === 'lucro' ? 'Lucro' : 'Margem'}</div>
          <MiniBar
            data={top10.map((s: any) => ({ l: s.sku, v: ordenar === 'margem' ? s.margem * 100 : s[ordenar] }))}
            height={130}
            colorFn={i => { const m = top10[i]?.margem || 0; return m >= 0.20 ? '#22c55e' : m >= 0.10 ? '#f59e0b' : '#ef4444' }}
          />
        </div>

        {/* RESUMO */}
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>📈 Resumo Geral</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['SKUs Únicos',    String(rows.length),                                                        '#a78bfa'],
              ['Receita Total',  R(rows.reduce((s: any, r: any) => s + r.rec, 0)),                           '#ff9933'],
              ['Lucro Op Total', R(rows.reduce((s: any, r: any) => s + r.lucro, 0)),                         rows.reduce((s: any, r: any) => s + r.lucro, 0) >= 0 ? '#22c55e' : '#ef4444'],
              ['Total Ads',      R(totalAds),                                                                '#e67e22'],
              ['Lucro Líq Real', R(rows.reduce((s: any, r: any) => s + r.lucroLiq, 0)),                      rows.reduce((s: any, r: any) => s + r.lucroLiq, 0) >= 0 ? '#22c55e' : '#ef4444'],
              ['Margem Média',   P(rows.reduce((s: any, r: any) => s + r.margem, 0) / (rows.length || 1)),   '#888'],
            ].map(([l, v, c]) => (
              <div key={l as string} style={{ padding: '10px 12px', background: '#13131e', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: c as string, fontSize: 14 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABELA COMPLETA */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['#', 'SKU Venda', 'Produto', 'Qtd Vendida', 'Receita Total', 'Lucro Op', 'Ads Rateado', 'Lucro Líq', 'Margem Op', 'Lojas'].map(h => <th key={h} style={S.th as any}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((s: any, i: number) => (
                <tr key={s.sku} style={{ borderBottom: '1px solid #1e1e2a' }}>
                  <td style={S.td as any}><span style={{ color: '#555', fontFamily: 'monospace' }}>{i + 1}</span></td>
                  <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#ff6600', fontSize: 11, fontWeight: 700 }}>{s.sku}</span></td>
                  <td style={S.td as any}><span style={{ fontWeight: 600 }}>{s.nome}</span></td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace' }}>{N(s.qtd)}</span></td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace' }}>{R(s.rec)}</span></td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace', color: s.lucro >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{R(s.lucro)}</span></td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace', color: '#e67e22' }}>{R(s.adsRateado)}</span></td>
                  <td style={{ ...S.td as any, textAlign: 'right' as any }}><span style={{ fontFamily: 'monospace', color: s.lucroLiq >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{R(s.lucroLiq)}</span></td>
                  <td style={S.td as any}><StatusBadge v={s.margem} /></td>
                  <td style={S.td as any}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[...s.lojas].filter(Boolean).map((l: any) => (
                        <Badge key={l} color={LOJA_COLORS[l] || '#ff6600'}>{(l as string).split(' ')[0]}</Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ ...S.td as any, textAlign: 'center', padding: 48, color: '#555' }}>Sem dados no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
