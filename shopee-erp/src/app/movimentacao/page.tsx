'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_CORES: Record<string, string> = {
  'KL MARKET': '#FF6600',
  'UNIVERSO DOS ACHADOS': '#0EA5E9',
  'MUNDO DOS ACHADOS': '#A855F7',
}

const D = (s: string) => { if (!s) return ''; const [y,m,d] = String(s).slice(0,10).split('-'); return d&&m&&y?`${d}/${m}/${y}`:s }

const S: Record<string, React.CSSProperties> = {
  page:     { padding: '20px 24px', width: '100%', boxSizing: 'border-box' },
  card:     { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:       { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:       { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:      { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any },
  btnSm:    { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnGhost: { background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 500, fontSize: 12 },
}

type MovRow = {
  data: string; loja: string; pedido: string
  sku_venda: string; quantidade: number
  componentes: { sku_base: string; produto: string; qtd_consumida: number }[]
}

export default function MovimentacaoPage() {
  const [financeiro,   setFinanceiro]   = useState<any[]>([])
  const [skuMap,       setSkuMap]       = useState<any[]>([])
  const [estoque,      setEstoque]      = useState<any[]>([])
  const [movimentacoes,setMovimentacoes]= useState<any[]>([])  // FIX: carrega movimentacoes para estoqueReal
  const [loading,      setLoading]      = useState(true)
  const [lojaFilter,   setLojaFilter]   = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [skuFilter,    setSkuFilter]    = useState('')
  const [expandido,    setExpandido]    = useState<Record<string, boolean>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, mapRes, estRes, movRes] = await Promise.all([
      supabase.from('financeiro').select('data,loja,pedido,sku,quantidade').order('data', { ascending: false }).limit(2000),
      supabase.from('sku_map').select('sku_venda,sku_base,quantidade'),
      supabase.from('estoque').select('sku_base,produto,estoque_atual,estoque_minimo'),
      supabase.from('movimentacoes').select('sku_base,quantidade,tipo'),  // FIX
    ])
    setFinanceiro(finRes.data || [])
    setSkuMap(mapRes.data || [])
    setEstoque(estRes.data || [])
    setMovimentacoes(movRes.data || [])
    setLoading(false)
  }

  // FIX: historicoCompra = estoque_atual (setup) + SOMA(ENTRADAs em movimentacoes)
  const historicoCompra = useMemo(() => {
    const map: Record<string, number> = {}
    estoque.forEach(e => { map[e.sku_base] = e.estoque_atual })
    movimentacoes.filter(m => m.tipo === 'ENTRADA').forEach(m => {
      map[m.sku_base] = (map[m.sku_base] || 0) + (m.quantidade || 0)
    })
    return map
  }, [estoque, movimentacoes])

  // Consumo total histórico por produto base (todos os pedidos do financeiro)
  const consumoTotal = useMemo(() => {
    const map: Record<string, number> = {}
    financeiro.forEach(f => {
      const skuVenda = (f.sku || '').toUpperCase().trim()
      const comps = skuMap.filter(m => (m.sku_venda || '').toUpperCase().trim() === skuVenda)
      comps.forEach(c => {
        map[c.sku_base] = (map[c.sku_base] || 0) + (c.quantidade || 1) * (f.quantidade || 1)
      })
    })
    return map
  }, [financeiro, skuMap])

  // FIX: estoqueReal = historicoCompra - consumoTotal (igual ao estoque/page.tsx)
  const estoqueReal = useMemo(() => {
    const map: Record<string, number> = {}
    estoque.forEach(e => {
      map[e.sku_base] = (historicoCompra[e.sku_base] || 0) - (consumoTotal[e.sku_base] || 0)
    })
    return map
  }, [estoque, historicoCompra, consumoTotal])

  const movimentacoesFiltradas = useMemo((): MovRow[] => {
    return financeiro.map(f => {
      const skuVenda = (f.sku || '').toUpperCase().trim()
      const mapeamentos = skuMap.filter(m => (m.sku_venda || '').toUpperCase().trim() === skuVenda)
      const componentes = mapeamentos.map(m => {
        const est = estoque.find(e => e.sku_base === m.sku_base)
        return {
          sku_base: m.sku_base,
          produto: est?.produto || m.sku_base,
          qtd_consumida: (m.quantidade || 1) * (f.quantidade || 1),
        }
      })
      if (componentes.length === 0) {
        const est = estoque.find(e => e.sku_base === skuVenda)
        componentes.push({ sku_base: skuVenda, produto: est?.produto || skuVenda, qtd_consumida: f.quantidade || 1 })
      }
      return { data: f.data, loja: (f.loja || '').toUpperCase().trim(), pedido: f.pedido, sku_venda: skuVenda, quantidade: f.quantidade || 1, componentes }
    })
  }, [financeiro, skuMap, estoque])

  const filtradas = useMemo(() => movimentacoesFiltradas.filter(m => {
    if (lojaFilter && m.loja !== lojaFilter) return false
    if (dateFrom && m.data < dateFrom) return false
    if (dateTo   && m.data > dateTo)   return false
    if (skuFilter && !m.sku_venda.includes(skuFilter.toUpperCase())) return false
    return true
  }), [movimentacoesFiltradas, lojaFilter, dateFrom, dateTo, skuFilter])

  // Resumo por produto base (usando pedidos filtrados para consumo do período)
  const resumoPorBase = useMemo(() => {
    const map: Record<string, { sku_base: string; produto: string; total: number; porLoja: Record<string, number> }> = {}
    filtradas.forEach(m => {
      m.componentes.forEach(c => {
        if (!map[c.sku_base]) map[c.sku_base] = { sku_base: c.sku_base, produto: c.produto, total: 0, porLoja: {} }
        map[c.sku_base].total += c.qtd_consumida
        map[c.sku_base].porLoja[m.loja] = (map[c.sku_base].porLoja[m.loja] || 0) + c.qtd_consumida
      })
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtradas])

  const diasPeriodo = useMemo(() => {
    if (filtradas.length === 0) return 30
    const datas = filtradas.map(f => f.data).filter(Boolean).sort()
    if (datas.length < 2) return 1
    return Math.max((new Date(datas[datas.length-1]).getTime() - new Date(datas[0]).getTime()) / 86400000, 1)
  }, [filtradas])

  const temFiltro = lojaFilter || dateFrom || dateTo || skuFilter

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>🔄 Movimentação de Estoque</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>Consumo de produtos base gerado pelos pedidos, cruzado com o mapa de SKUs</p>
        </div>
        <button onClick={loadData} style={S.btnSm}>↻ Atualizar</button>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} style={{ ...S.inp, width: 'auto' } as any}>
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 148 } as any} />
        <span style={{ color: '#555', fontSize: 12 }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 148 } as any} />
        <input value={skuFilter} onChange={e => setSkuFilter(e.target.value)} placeholder="Filtrar SKU..." style={{ ...S.inp, width: 140 } as any} />
        {temFiltro && (
          <button onClick={() => { setLojaFilter(''); setDateFrom(''); setDateTo(''); setSkuFilter('') }} style={S.btnGhost}>✕ Limpar</button>
        )}
      </div>

      {/* RESUMO POR PRODUTO BASE */}
      <div style={{ ...S.card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e2c' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8' }}>📦 Consumo Total por Produto Base</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Produto Base</th>
                <th style={{ ...S.th, textAlign: 'center' as any }}>Total no período</th>
                {LOJAS.map(l => (
                  <th key={l} style={{ ...S.th, textAlign: 'center' as any, color: LOJA_CORES[l] }}>{l.split(' ')[0]}</th>
                ))}
                {/* FIX: coluna renomeada para "Estoque Real" — agora usa historicoCompra - consumo */}
                <th style={{ ...S.th, textAlign: 'center' as any }}>Estoque Real</th>
                <th style={{ ...S.th, textAlign: 'center' as any }}>Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {resumoPorBase.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as any, padding: '40px', color: '#55556a' }}>Nenhuma movimentação no período</td></tr>
              ) : resumoPorBase.map(r => {
                // FIX: usa estoqueReal calculado (historicoCompra - consumoTotal)
                // em vez de est.estoque_atual direto do banco
                const estReal      = estoqueReal[r.sku_base] ?? 0
                const consumoDia   = r.total / diasPeriodo
                // FIX: cobertura baseada no estoqueReal correto
                const diasCobertura = consumoDia > 0 ? Math.floor(estReal / consumoDia) : 999
                const cor = diasCobertura >= 20 ? '#22c55e' : diasCobertura >= 10 ? '#f59e0b' : '#ef4444'

                return (
                  <tr key={r.sku_base}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: '#ff6600', fontFamily: 'monospace', fontSize: 12 }}>{r.sku_base}</div>
                      <div style={{ fontSize: 11, color: '#55556a' }}>{r.produto}</div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' as any, fontWeight: 700, color: '#ff9933' }}>{r.total}</td>
                    {LOJAS.map(l => (
                      <td key={l} style={{ ...S.td, textAlign: 'center' as any, color: '#9090aa' }}>{r.porLoja[l] || 0}</td>
                    ))}
                    {/* FIX: mostra estoqueReal (não estoque_atual do banco) */}
                    <td style={{ ...S.td, textAlign: 'center' as any }}>
                      <span style={{ background: estReal > 0 ? '#22c55e22' : '#ef444422', color: estReal > 0 ? '#22c55e' : '#ef4444', border: `1px solid ${estReal > 0 ? '#22c55e44' : '#ef444444'}`, borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {estReal} un
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' as any }}>
                      <span style={{ background: cor + '22', color: cor, border: `1px solid ${cor}44`, borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {diasCobertura >= 999 ? '∞' : `${diasCobertura}d`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PEDIDOS DETALHADOS */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e2c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8' }}>📋 Pedidos — {filtradas.length} registros</span>
          <span style={{ fontSize: 11, color: '#55556a' }}>Clique na linha para expandir componentes</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Data', 'SKU Venda', 'Loja', 'Qtd', 'Pedido', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...S.td, textAlign: 'center' as any, padding: '60px', color: '#55556a' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                    <div>Nenhuma movimentação encontrada</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Importe pedidos no Financeiro para ver o consumo aqui</div>
                  </td>
                </tr>
              ) : filtradas.slice(0, 200).map((m, i) => {
                const key   = `${m.pedido}-${m.sku_venda}-${i}`
                const aberto = expandido[key]
                const cor   = LOJA_CORES[m.loja] || '#888'
                return (
                  <>
                    <tr key={key}
                      onClick={() => setExpandido(p => ({ ...p, [key]: !p[key] }))}
                      style={{ cursor: 'pointer', background: aberto ? '#13131e' : 'transparent' }}>
                      <td style={{ ...S.td, color: '#55556a' }}>{D(m.data)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#ff6600', fontWeight: 600 }}>{m.sku_venda}</td>
                      <td style={S.td}>
                        <span style={{ background: cor + '22', color: cor, border: `1px solid ${cor}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                          {m.loja.split(' ')[0]}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' as any, fontWeight: 700 }}>{m.quantidade}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#55556a' }}>#{m.pedido?.slice(-8)}</td>
                      <td style={{ ...S.td, textAlign: 'center' as any, color: '#55556a' }}>{aberto ? '▲' : '▼'}</td>
                    </tr>
                    {aberto && (
                      <tr key={key + '_exp'}>
                        <td colSpan={6} style={{ ...S.td, background: '#0d0d14', paddingLeft: 48 }}>
                          <div style={{ fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Componentes consumidos:</div>
                          {m.componentes.map((c, ci) => (
                            <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
                              <span style={{ background: '#ff660022', color: '#ff6600', border: '1px solid #ff660044', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{c.sku_base}</span>
                              <span style={{ color: '#9090aa', fontSize: 12 }}>{c.produto}</span>
                              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#ef4444' }}>−{c.qtd_consumida} un</span>
                              {/* FIX: mostra estoqueReal em vez de estoque_atual */}
                              <span style={{ fontSize: 11, color: '#55556a' }}>
                                (estoque real: {estoqueReal[c.sku_base] ?? '?'} un)
                              </span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filtradas.length > 200 && (
                <tr>
                  <td colSpan={6} style={{ ...S.td, textAlign: 'center' as any, color: '#55556a', fontSize: 12 }}>
                    Mostrando 200 de {filtradas.length} registros. Use os filtros para refinar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
