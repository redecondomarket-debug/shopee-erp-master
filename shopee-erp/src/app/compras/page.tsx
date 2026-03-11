'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:    { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:   { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any },
  btnSm: { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  label: { fontSize: 11, color: '#888', marginBottom: 4, display: 'block', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as any },
}

export default function OrdemCompraPage() {
  const [financeiro,  setFinanceiro]  = useState<any[]>([])
  const [composicao,  setComposicao]  = useState<any[]>([])
  const [produtos,    setProdutos]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [simQtd,      setSimQtd]      = useState<Record<string, string>>({})
  const [simCusto,    setSimCusto]    = useState<Record<string, string>>({})
  const [periodo,     setPeriodo]     = useState('mensal')

  const hoje = new Date().toISOString().slice(0, 10)
  const mesInicio = hoje.slice(0, 8) + '01'
  const [dataIni, setDataIni] = useState(mesInicio)
  const [dataFim, setDataFim] = useState(hoje)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, compRes, prodRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(10000),
      supabase.from('sku_map').select('*'),
      supabase.from('estoque').select('*'),
    ])
    setFinanceiro(finRes.data || [])
    setComposicao(compRes.data || [])
    setProdutos(prodRes.data || [])
    setLoading(false)
  }

  function aplicarPeriodo(p: string) {
    const d   = new Date()
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
    if (p === 'diario')  { setDataIni(fmt(d)); setDataFim(fmt(d)) }
    if (p === 'semanal') { const d2 = new Date(); d2.setDate(d.getDate()-6); setDataIni(fmt(d2)); setDataFim(fmt(d)) }
    if (p === 'mensal')  { const d2 = new Date(d.getFullYear(), d.getMonth(), 1); setDataIni(fmt(d2)); setDataFim(fmt(d)) }
    setPeriodo(p)
  }

  const pedFiltrados = useMemo(() =>
    financeiro.filter(f => f.data >= dataIni && f.data <= dataFim),
    [financeiro, dataIni, dataFim]
  )

  const diffDias = Math.max(1, (new Date(dataFim).getTime() - new Date(dataIni).getTime()) / 86400000 + 1)

  // Análise por produto físico (idêntico ao TabOrdemCompra do App.js)
  const analise = useMemo(() => {
    return produtos.map(pr => {
      const consumoPorLoja: Record<string, number> = {}
      LOJAS.forEach(l => { consumoPorLoja[l] = 0 })

      pedFiltrados.forEach(ped => {
        const comps = composicao.filter(c => c.sku_venda === ped.sku && c.sku_base === pr.sku_base)
        comps.forEach(c => {
          consumoPorLoja[ped.loja] = (consumoPorLoja[ped.loja] || 0) + c.quantidade * (ped.quantidade || 1)
        })
      })

      const totalConsumido = Object.values(consumoPorLoja).reduce((s, v) => s + v, 0)
      const participacao: Record<string, number> = {}
      LOJAS.forEach(l => {
        participacao[l] = totalConsumido > 0 ? consumoPorLoja[l] / totalConsumido : 1 / LOJAS.length
      })

      const consumoDiario  = totalConsumido / diffDias
      const estoqueAtual   = pr.estoque_atual || 0
      const diasCobertura  = consumoDiario > 0 ? Math.floor(estoqueAtual / consumoDiario) : 999
      const sugestaoCompra = consumoDiario > 0 ? Math.ceil(consumoDiario * 30) : 0

      const qtdSim   = +(simQtd[pr.sku_base]   || 0)
      const custoSim = +(simCusto[pr.sku_base] || 0)
      const rateio   = LOJAS.map(l => ({
        loja: l,
        pct: participacao[l],
        qtd: Math.round(qtdSim * participacao[l]),
        valor: custoSim * participacao[l],
      }))

      return { pr, consumoPorLoja, totalConsumido, participacao, diasCobertura, consumoDiario, sugestaoCompra, estoqueAtual, rateio, qtdSim, custoSim }
    }).filter(a => a.totalConsumido > 0 || a.estoqueAtual >= 0)
  }, [pedFiltrados, composicao, produtos, simQtd, simCusto, diffDias])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>🛒 Ordem de Compra — Rateio de Reposição por Loja</h2>

      {/* FILTRO DE PERÍODO */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 }}>Período:</span>
          {[['diario','Hoje'],['semanal','7 dias'],['mensal','Este mês'],['personalizado','Personalizado']].map(([id, label]) => (
            <button key={id} onClick={() => aplicarPeriodo(id)} style={{
              background: periodo === id ? '#ff660033' : 'transparent',
              border: `1px solid ${periodo === id ? '#ff6600' : '#2a2a3a'}`,
              color: periodo === id ? '#ff6600' : '#666',
              borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: periodo === id ? 700 : 400
            }}>{label}</button>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
            <label style={{ ...S.label, margin: 0 }}>De</label>
            <input type="date" value={dataIni} onChange={e => { setDataIni(e.target.value); setPeriodo('personalizado') }}
              style={{ ...S.inp, width: 140, padding: '5px 8px', fontSize: 12 } as any} />
            <label style={{ ...S.label, margin: 0 }}>Até</label>
            <input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPeriodo('personalizado') }}
              style={{ ...S.inp, width: 140, padding: '5px 8px', fontSize: 12 } as any} />
          </div>
          <span style={{ fontSize: 11, color: '#555' }}>{diffDias} dia{diffDias !== 1 ? 's' : ''} analisado{diffDias !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {analise.map(({ pr, consumoPorLoja, totalConsumido, participacao, diasCobertura, consumoDiario, sugestaoCompra, estoqueAtual, rateio, qtdSim, custoSim }) => {
        const corDias = diasCobertura >= 20 ? '#22c55e' : diasCobertura >= 10 ? '#f59e0b' : '#ef4444'
        const temSim  = qtdSim > 0

        return (
          <div key={pr.sku_base} style={{ ...S.card, marginBottom: 20 }}>
            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #2a2a3a', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 800, fontSize: 13 }}>{pr.sku_base}</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{pr.produto}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {[
                  ['Estoque Atual',    N(estoqueAtual), corDias],
                  ['Dias de Cobertura', diasCobertura >= 999 ? '∞' : String(diasCobertura), corDias],
                  ['Consumo/Dia',       consumoDiario.toFixed(1), '#ff9933'],
                  ['Sugestão Compra',   N(sugestaoCompra), '#a78bfa'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* VENDAS POR LOJA */}
              <div>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>📊 Vendas no período</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th as any}>Loja</th>
                      <th style={{ ...S.th as any, textAlign: 'right' }}>Qtd Vendida</th>
                      <th style={{ ...S.th as any, textAlign: 'right' }}>% Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LOJAS.map(loja => (
                      <tr key={loja} style={{ borderBottom: '1px solid #1e1e2a' }}>
                        <td style={S.td as any}><span style={{ color: LOJA_COLORS[loja], fontWeight: 600, fontSize: 12 }}>{loja}</span></td>
                        <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{N(consumoPorLoja[loja] || 0)}</td>
                        <td style={{ ...S.td as any, textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <div style={{ width: 60, height: 6, background: '#1e1e2a', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(participacao[loja] || 0) * 100}%`, background: LOJA_COLORS[loja], borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: 'monospace', color: LOJA_COLORS[loja], fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                              {((participacao[loja] || 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #2a2a3a' }}>
                      <td style={{ ...S.td as any, fontWeight: 700 }}>TOTAL</td>
                      <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ff9933' }}>{N(totalConsumido)}</td>
                      <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SIMULAÇÃO DE COMPRA */}
              <div>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>💡 Simulação de Compra</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Qtd a comprar</label>
                    <input type="number" value={simQtd[pr.sku_base] || ''} onChange={e => setSimQtd(s => ({ ...s, [pr.sku_base]: e.target.value }))}
                      placeholder={`Sugestão: ${sugestaoCompra}`} style={S.inp as any} min="0" />
                  </div>
                  <div>
                    <label style={S.label}>Custo total (R$)</label>
                    <input type="number" value={simCusto[pr.sku_base] || ''} onChange={e => setSimCusto(s => ({ ...s, [pr.sku_base]: e.target.value }))}
                      placeholder={`Ex: ${(sugestaoCompra * (pr.custo || 0)).toFixed(2)}`} style={S.inp as any} min="0" step="0.01" />
                  </div>
                </div>

                {temSim ? (
                  <>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 6 }}>🧾 Rateio por Loja</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={S.th as any}>Loja</th>
                          <th style={{ ...S.th as any, textAlign: 'right' }}>% Part.</th>
                          <th style={{ ...S.th as any, textAlign: 'right' }}>Qtd</th>
                          <th style={{ ...S.th as any, textAlign: 'right' }}>Valor a Pagar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateio.map(r => (
                          <tr key={r.loja} style={{ borderBottom: '1px solid #1e1e2a' }}>
                            <td style={S.td as any}><span style={{ color: LOJA_COLORS[r.loja], fontWeight: 600, fontSize: 12 }}>{r.loja}</span></td>
                            <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace' }}>{(r.pct * 100).toFixed(1)}%</td>
                            <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{N(r.qtd)}</td>
                            <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: LOJA_COLORS[r.loja] }}>{R(r.valor)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid #2a2a3a' }}>
                          <td style={{ ...S.td as any, fontWeight: 700 }}>TOTAL</td>
                          <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace' }}>100%</td>
                          <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ff9933' }}>{N(qtdSim)}</td>
                          <td style={{ ...S.td as any, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#22c55e' }}>{R(custoSim)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#444', fontSize: 12 }}>
                    ⬆️ Preencha qtd e custo para ver o rateio automático
                    {sugestaoCompra > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => {
                          setSimQtd(s => ({ ...s, [pr.sku_base]: String(sugestaoCompra) }))
                          setSimCusto(s => ({ ...s, [pr.sku_base]: (sugestaoCompra * (pr.custo || 0)).toFixed(2) }))
                        }} style={S.btnSm as any}>
                          ✨ Usar sugestão automática ({N(sugestaoCompra)} un)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BARRA DE COBERTURA */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2a3a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#555' }}>Cobertura de estoque atual</span>
                <span style={{ fontFamily: 'monospace', color: corDias, fontWeight: 700 }}>
                  {diasCobertura >= 999 ? 'Sem consumo registrado' : `${diasCobertura} dias restantes`}
                </span>
              </div>
              <div style={{ height: 6, background: '#1e1e2a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((diasCobertura / 30) * 100, 100)}%`, background: corDias, borderRadius: 3, transition: 'width .4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#333', marginTop: 3 }}>
                <span>0 dias</span>
                <span style={{ color: '#f59e0b' }}>10 dias</span>
                <span style={{ color: '#22c55e' }}>30 dias+</span>
              </div>
            </div>
          </div>
        )
      })}

      {analise.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#444' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma venda encontrada no período</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Ajuste o filtro de datas ou importe pedidos na aba Financeiro</div>
        </div>
      )}
    </div>
  )
}
