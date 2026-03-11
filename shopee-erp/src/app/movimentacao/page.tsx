'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']
const LOJA_CORES: Record<string, string> = {
  'KL Market': '#FF6600',
  'Universo dos Achados': '#0EA5E9',
  'Mundo dos Achados': '#A855F7',
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

type MovRow = {
  data: string
  loja: string
  numero_pedido: string
  sku_venda: string
  quantidade: number
  // expandido via sku_map
  componentes: { sku_base: string; produto: string; qtd_consumida: number }[]
}

type SkuMap = { sku_venda: string; sku_base: string; quantidade: number }
type Estoque = { sku_base: string; produto: string; estoque_atual: number }
type Financeiro = {
  data: string; loja: string; numero_pedido: string
  sku_vendido: string; quantidade: number
}

export default function MovimentacaoPage() {
  const [financeiro, setFinanceiro] = useState<Financeiro[]>([])
  const [skuMap, setSkuMap] = useState<SkuMap[]>([])
  const [estoque, setEstoque] = useState<Estoque[]>([])
  const [loading, setLoading] = useState(true)

  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [skuFilter, setSkuFilter] = useState('')
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, mapRes, estRes] = await Promise.all([
      supabase.from('financeiro').select('data,loja,numero_pedido,sku_vendido,quantidade').order('data', { ascending: false }).limit(2000),
      supabase.from('sku_map').select('sku_venda,sku_base,quantidade'),
      supabase.from('estoque').select('sku_base,produto,estoque_atual'),
    ])
    setFinanceiro(finRes.data || [])
    setSkuMap(mapRes.data || [])
    setEstoque(estRes.data || [])
    setLoading(false)
  }

  // Monta movimentações cruzando financeiro × sku_map
  const movimentacoes = useMemo((): MovRow[] => {
    return financeiro.map(f => {
      const skuVenda = f.sku_vendido?.toUpperCase() || ''
      const mapeamentos = skuMap.filter(m => m.sku_venda?.toUpperCase() === skuVenda)
      const componentes = mapeamentos.map(m => {
        const est = estoque.find(e => e.sku_base === m.sku_base)
        return {
          sku_base: m.sku_base,
          produto: est?.produto || m.sku_base,
          qtd_consumida: (m.quantidade || 1) * (f.quantidade || 1),
        }
      })
      // Se não há mapeamento, assume 1:1 (sku_venda = sku_base)
      if (componentes.length === 0) {
        const est = estoque.find(e => e.sku_base === skuVenda)
        componentes.push({
          sku_base: skuVenda,
          produto: est?.produto || skuVenda,
          qtd_consumida: f.quantidade || 1,
        })
      }
      return {
        data: f.data,
        loja: f.loja,
        numero_pedido: f.numero_pedido,
        sku_venda: skuVenda,
        quantidade: f.quantidade || 1,
        componentes,
      }
    })
  }, [financeiro, skuMap, estoque])

  // Filtros
  const filtradas = useMemo(() => movimentacoes.filter(m => {
    if (lojaFilter && m.loja !== lojaFilter) return false
    if (dateFrom && m.data < dateFrom) return false
    if (dateTo && m.data > dateTo) return false
    if (skuFilter && !m.sku_venda.includes(skuFilter.toUpperCase())) return false
    return true
  }), [movimentacoes, lojaFilter, dateFrom, dateTo, skuFilter])

  // Resumo por produto base
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

  const limparFiltros = () => { setLojaFilter(''); setDateFrom(''); setDateTo(''); setSkuFilter('') }
  const temFiltro = lojaFilter || dateFrom || dateTo || skuFilter

  const S = {
    page: { padding: '24px', minHeight: '100vh' } as React.CSSProperties,
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 16, marginBottom: 24 },
    title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
    sub: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 },
    filtersRow: { display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 20 },
    input: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13 },
    btnSecondary: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
    card: { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 },
    kpi: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' },
    kpiLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 4 },
    kpiValue: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
    tableHeader: { display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px 80px 32px', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
    tableRow: { display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px 80px 32px', gap: 8, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center', cursor: 'pointer' },
    badge: (cor: string) => ({ background: `${cor}20`, color: cor, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }),
    expandRow: { background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', padding: '8px 12px 12px 120px' },
    compItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🔄 Movimentação de Estoque</h1>
          <p style={S.sub}>Consumo de produtos base gerado pelos pedidos, cruzado com o mapa de SKUs</p>
        </div>
        <button onClick={loadData} style={S.btnSecondary}>↻ Atualizar</button>
      </div>

      {/* Filtros */}
      <div style={S.filtersRow}>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} style={S.input}>
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={S.input} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={S.input} />
        <input value={skuFilter} onChange={e => setSkuFilter(e.target.value)}
          placeholder="Filtrar SKU..." style={{ ...S.input, width: 140 }} />
        {temFiltro && (
          <button onClick={limparFiltros} style={S.btnSecondary}>✕ Limpar</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : (
        <>
          {/* Resumo por produto base */}
          <div style={S.card}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
              📦 Consumo Total por Produto Base
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Produto Base</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Total</th>
                    {LOJAS.map(l => (
                      <th key={l} style={{ textAlign: 'center', padding: '8px 12px', color: LOJA_CORES[l], fontWeight: 600, fontSize: 11 }}>
                        {l.split(' ')[0]}
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Estoque</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPorBase.map(r => {
                    const est = estoque.find(e => e.sku_base === r.sku_base)
                    const estoqueAtual = est?.estoque_atual || 0
                    const diasPeriodo = filtradas.length > 0 ? (() => {
                      const datas = filtradas.map(f => f.data).filter(Boolean).sort()
                      if (datas.length < 2) return 1
                      const diff = (new Date(datas[datas.length - 1]).getTime() - new Date(datas[0]).getTime()) / 86400000
                      return Math.max(diff, 1)
                    })() : 30
                    const consumoDia = r.total / diasPeriodo
                    const diasCobertura = consumoDia > 0 ? Math.floor(estoqueAtual / consumoDia) : 999
                    const corCobertura = diasCobertura >= 20 ? '#00d68f' : diasCobertura >= 10 ? '#ffaa00' : '#ff3d71'

                    return (
                      <tr key={r.sku_base} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--shopee-primary)', fontFamily: 'monospace' }}>{r.sku_base}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.produto}</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {r.total}
                        </td>
                        {LOJAS.map(l => (
                          <td key={l} style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-secondary)' }}>
                            {r.porLoja[l] || 0}
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                          <span style={S.badge(estoqueAtual > 0 ? '#0095ff' : '#ff3d71')}>{estoqueAtual} un</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                          <span style={S.badge(corCobertura)}>
                            {diasCobertura >= 999 ? '∞' : `${diasCobertura}d`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {resumoPorBase.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhuma movimentação no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de pedidos detalhada */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                📋 Pedidos — {filtradas.length} registros
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Clique na linha para expandir componentes</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {/* Header */}
              <div style={S.tableHeader}>
                <span>Data</span>
                <span>SKU Venda</span>
                <span>Loja</span>
                <span style={{ textAlign: 'center' }}>Qtd</span>
                <span style={{ textAlign: 'center' }}>Pedido</span>
                <span></span>
              </div>

              {filtradas.slice(0, 200).map((m, i) => {
                const key = `${m.numero_pedido}-${m.sku_venda}-${i}`
                const aberto = expandido[key]
                const corLoja = LOJA_CORES[m.loja] || '#888'
                return (
                  <div key={key}>
                    <div style={{ ...S.tableRow, background: aberto ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                      onClick={() => setExpandido(prev => ({ ...prev, [key]: !prev[key] }))}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.data ? m.data.slice(8,10) + '/' + m.data.slice(5,7) + '/' + m.data.slice(0,4) : ''}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shopee-primary)', fontFamily: 'monospace' }}>{m.sku_venda}</span>
                      <span style={S.badge(corLoja)}>{m.loja?.split(' ')[0]}</span>
                      <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{m.quantidade}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{m.numero_pedido?.slice(-6)}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>{aberto ? '▲' : '▼'}</span>
                    </div>

                    {aberto && (
                      <div style={S.expandRow}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
                          Componentes consumidos:
                        </div>
                        {m.componentes.map((c, ci) => {
                          const est = estoque.find(e => e.sku_base === c.sku_base)
                          return (
                            <div key={ci} style={S.compItem}>
                              <span style={{ ...S.badge('#EE2C00'), fontFamily: 'monospace' }}>{c.sku_base}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.produto}</span>
                              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#ff3d71' }}>−{c.qtd_consumida} un</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                (estoque: {est?.estoque_atual ?? '?'})
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {filtradas.length > 200 && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                  Mostrando 200 de {filtradas.length} registros. Use os filtros para refinar.
                </div>
              )}

              {filtradas.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhuma movimentação encontrada</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Importe pedidos no Financeiro para ver o consumo aqui</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
