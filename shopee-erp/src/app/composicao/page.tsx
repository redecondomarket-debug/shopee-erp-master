'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const S: Record<string, React.CSSProperties> = {
  card:      { background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10, padding: 16 },
  th:        { padding: '8px 12px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 0.8, textTransform: 'uppercase' as any, borderBottom: '1px solid #2a2a3a', whiteSpace: 'nowrap' as any },
  td:        { padding: '7px 12px', fontSize: 12.5, borderBottom: '1px solid #1e1e2a', whiteSpace: 'nowrap' as any },
  inp:       { background: '#0f0f13', border: '1px solid #2a2a3a', borderRadius: 6, padding: '7px 10px', color: '#e8e8f0', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' as any },
  btn:       { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:     { background: '#ff660022', color: '#ff6600', border: '1px solid #ff660044', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
  btnDanger: { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
  label:     { fontSize: 11, color: '#888', marginBottom: 4, display: 'block', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as any },
}

function Badge({ children, color = '#ff6600' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{children}</span>
}
function Toast({ msg, type, onClose }: { msg: string; type: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, background: type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: '0 8px 32px #0009' }}>
      {type === 'ok' ? '✅' : '❌'} {msg}
    </div>
  )
}

export default function ComposicaoPage() {
  const [composicao, setComposicao] = useState<any[]>([])
  const [produtos,   setProdutos]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState<{ msg: string; type: string } | null>(null)
  const [view,       setView]       = useState<'mapa' | 'editar'>('mapa')
  const [form,       setForm]       = useState({ sku_venda: '', nome_venda: '', sku_base: '', quantidade: 1 })
  const showToast = (msg: string, type = 'ok') => setToast({ msg, type })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [compRes, prodRes] = await Promise.all([
      supabase.from('sku_map').select('*').order('sku_venda'),
      supabase.from('estoque').select('*').order('sku_base'),
    ])
    setComposicao(compRes.data || [])
    setProdutos(prodRes.data || [])
    setLoading(false)
  }

  async function add() {
    if (!form.sku_venda || !form.quantidade) { showToast('SKU Venda e quantidade são obrigatórios', 'err'); return }
    const { error } = await supabase.from('sku_map').insert({
      sku_venda: form.sku_venda.toUpperCase(),
      nome_venda: form.nome_venda,
      sku_base: form.sku_base,
      quantidade: +form.quantidade,
    })
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Composição adicionada!')
    setForm(f => ({ ...f, sku_venda: '', nome_venda: '', quantidade: 1 }))
    loadData()
  }

  async function del(id: number) {
    await supabase.from('sku_map').delete().eq('id', id)
    setComposicao(prev => prev.filter(c => c.id !== id))
    showToast('Removido!')
  }

  const skusVenda = [...new Set(composicao.map(c => c.sku_venda))].sort()

  // Agrupamento por produto base (igual ao TabComposicao do App.js)
  const porBase = useMemo(() => {
    return produtos.map(pr => ({
      pr,
      skusVenda: skusVenda.filter(sku => composicao.some(c => c.sku_venda === sku && c.sku_base === pr.sku_base)),
    })).filter(g => g.skusVenda.length > 0)
  }, [produtos, composicao, skusVenda])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ff660033', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🧩 Mapa de SKUs — Dois Níveis</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[['mapa', '🗺️ Mapa de SKUs'], ['editar', '✏️ Editar Composição']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id as any)} style={{
              background: view === id ? '#ff660033' : 'transparent',
              border: `1px solid ${view === id ? '#ff6600' : '#2a2a3a'}`,
              color: view === id ? '#ff6600' : '#666',
              borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: view === id ? 700 : 400
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* EXPLICAÇÃO (igual ao App.js) */}
      <div style={{ ...S.card, marginBottom: 16, padding: '12px 16px', background: '#0f1a0f', border: '1px solid #22c55e33' }}>
        <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 6 }}>📐 ESTRUTURA DE 2 NÍVEIS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 11, color: '#888' }}>
          <div>
            <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>SKU BASE (Estoque Físico)</div>
            <div>Produto real do depósito. Ex: <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>FORMA</span>, <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>SAQUINHO</span></div>
            <div style={{ marginTop: 4 }}>Só esses SKUs controlam o estoque verdadeiro.</div>
          </div>
          <div>
            <div style={{ color: '#ff6600', fontWeight: 700, marginBottom: 4 }}>SKU DE VENDA (Anúncio Shopee)</div>
            <div>Como é vendido. Ex: <span style={{ fontFamily: 'monospace', color: '#ff6600' }}>FM50</span>, <span style={{ fontFamily: 'monospace', color: '#ff6600' }}>KIT120B</span></div>
            <div style={{ marginTop: 4 }}>Cada venda abate o SKU base correto automaticamente.</div>
          </div>
        </div>
      </div>

      {/* MODO MAPA */}
      {view === 'mapa' && (
        <>
          {porBase.map(({ pr, skusVenda: svs }) => (
            <div key={pr.sku_base} style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #2a2a3a' }}>
                <Badge color="#a78bfa">{pr.sku_base}</Badge>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{pr.produto}</span>
                <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{svs.length} SKU{svs.length !== 1 ? 's' : ''} de venda</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th as any}>SKU Venda</th>
                      <th style={S.th as any}>Nome do Anúncio</th>
                      <th style={{ ...S.th as any, textAlign: 'center' }}>Consome {pr.sku_base}</th>
                      <th style={S.th as any}>Outros Componentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {svs.map(sku => {
                      const allComps   = composicao.filter(c => c.sku_venda === sku)
                      const thisComp   = allComps.find(c => c.sku_base === pr.sku_base)
                      const outros     = allComps.filter(c => c.sku_base !== pr.sku_base)
                      return (
                        <tr key={sku} style={{ borderBottom: '1px solid #1e1e2a' }}>
                          <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 700 }}>{sku}</span></td>
                          <td style={S.td as any}>{allComps[0]?.nome_venda || '—'}</td>
                          <td style={{ ...S.td as any, textAlign: 'center' }}>
                            <span style={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 800, fontSize: 14 }}>×{thisComp?.quantidade || 0}</span>
                          </td>
                          <td style={S.td as any}>
                            {outros.length > 0
                              ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {outros.map(o => (
                                    <span key={o.id} style={{ background: '#1e1e2a', border: '1px solid #2a2a3a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', color: '#f59e0b' }}>+{o.quantidade}× {o.sku_base}</span>
                                  ))}
                                </div>
                              : <span style={{ color: '#333', fontSize: 11 }}>—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* MAPA COMPLETO */}
          <div style={S.card}>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .8 }}>📋 Mapa Completo de SKUs</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['SKU Venda', 'Nome do Anúncio', 'SKU Base 1', 'Qtd 1', 'SKU Base 2', 'Qtd 2', 'SKU Base 3', 'Qtd 3'].map(h => (
                    <th key={h} style={S.th as any}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {skusVenda.map(sku => {
                    const comps = composicao.filter(c => c.sku_venda === sku)
                    const nome  = comps[0]?.nome_venda || '—'
                    const cols: React.ReactNode[] = []
                    for (let i = 0; i < 3; i++) {
                      if (comps[i]) {
                        cols.push(<span style={{ fontFamily: 'monospace', color: '#a78bfa', fontSize: 11 }}>{comps[i].sku_base}</span>)
                        cols.push(<span style={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 700 }}>×{comps[i].quantidade}</span>)
                      } else {
                        cols.push(<span style={{ color: '#222' }}>—</span>)
                        cols.push(<span style={{ color: '#222' }}>—</span>)
                      }
                    }
                    return (
                      <tr key={sku} style={{ borderBottom: '1px solid #1e1e2a' }}>
                        <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 700 }}>{sku}</span></td>
                        <td style={S.td as any}>{nome}</td>
                        {cols.map((c, i) => <td key={i} style={S.td as any}>{c}</td>)}
                      </tr>
                    )
                  })}
                  {skusVenda.length === 0 && (
                    <tr><td colSpan={8} style={{ ...S.td as any, textAlign: 'center', padding: 32, color: '#555' }}>Nenhuma composição cadastrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODO EDITAR */}
      {view === 'editar' && (
        <>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 600 }}>+ NOVA LINHA DE COMPOSIÇÃO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 100px auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={S.label}>SKU Venda</label>
                <input value={form.sku_venda} onChange={e => setForm(f => ({ ...f, sku_venda: e.target.value.toUpperCase() }))} style={S.inp as any} placeholder="Ex: FM50" />
              </div>
              <div>
                <label style={S.label}>Nome do Anúncio</label>
                <input value={form.nome_venda} onChange={e => setForm(f => ({ ...f, nome_venda: e.target.value }))} style={S.inp as any} placeholder="Ex: Forma Air Fryer 50un" />
              </div>
              <div>
                <label style={S.label}>SKU Base (Estoque)</label>
                <select value={form.sku_base} onChange={e => setForm(f => ({ ...f, sku_base: e.target.value }))} style={S.inp as any}>
                  <option value="">Selecione...</option>
                  {produtos.map(p => <option key={p.sku_base} value={p.sku_base}>{p.sku_base} — {p.produto}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Quantidade</label>
                <input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: +e.target.value }))} style={S.inp as any} min="1" />
              </div>
              <button style={{ ...S.btn, whiteSpace: 'nowrap' } as any} onClick={add}>+ Adicionar</button>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['SKU Venda', 'Nome do Anúncio', 'SKU Base', 'Produto Base', 'Quantidade', ''].map(h => (
                    <th key={h} style={S.th as any}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {composicao.map(c => {
                    const pr = produtos.find(p => p.sku_base === c.sku_base)
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                        <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 700 }}>{c.sku_venda}</span></td>
                        <td style={S.td as any}>{c.nome_venda}</td>
                        <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#a78bfa', fontSize: 11 }}>{c.sku_base}</span></td>
                        <td style={S.td as any}>{pr?.produto || c.sku_base}</td>
                        <td style={S.td as any}><span style={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 700 }}>×{c.quantidade}</span></td>
                        <td style={S.td as any}><button onClick={() => del(c.id)} style={S.btnDanger as any}>✕</button></td>
                      </tr>
                    )
                  })}
                  {composicao.length === 0 && (
                    <tr><td colSpan={6} style={{ ...S.td as any, textAlign: 'center', padding: 32, color: '#555' }}>Nenhuma composição cadastrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
