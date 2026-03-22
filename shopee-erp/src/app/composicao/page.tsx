'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// FIX: sem imports de lucide-react (não está no projeto)
// FIX: sem classes Tailwind (não existe no design system)

const S: Record<string, React.CSSProperties> = {
  page:     { padding: '20px 24px', width: '100%', boxSizing: 'border-box' },
  card:     { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:       { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:       { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:      { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any, width: '100%' },
  btn:      { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:    { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnGhost: { background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 500, fontSize: 12 },
  label:    { fontSize: 11, color: '#55556a', marginBottom: 5, display: 'block', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as any },
}

type SkuMap    = { id: string; sku_venda: string; sku_base: string; quantidade: number }
type ProdBase  = { sku_base: string; produto: string }
type Agrupado  = { sku_venda: string; composicao: { id: string; sku_base: string; quantidade: number }[] }

// FIX: presets com SKUs corretos (KITPS120B, KITPS240B, KITPS480B — não KIT120B)
const SKU_PRESETS: { sku_venda: string; composicao: { sku_base: string; quantidade: number }[] }[] = [
  { sku_venda: 'FM50',       composicao: [{ sku_base: 'FORMA',         quantidade: 1  }] },
  { sku_venda: 'FM100',      composicao: [{ sku_base: 'FORMA',         quantidade: 2  }] },
  { sku_venda: 'FM200',      composicao: [{ sku_base: 'FORMA',         quantidade: 4  }] },
  { sku_venda: 'FM300',      composicao: [{ sku_base: 'FORMA',         quantidade: 6  }] },
  { sku_venda: 'KIT2TP',     composicao: [{ sku_base: 'TAPETES',       quantidade: 2  }] },
  { sku_venda: 'KIT3TP',     composicao: [{ sku_base: 'TAPETES',       quantidade: 3  }] },
  { sku_venda: 'KIT4TP',     composicao: [{ sku_base: 'TAPETES',       quantidade: 4  }] },
  { sku_venda: 'KIT120',     composicao: [{ sku_base: 'SAQUINHO',      quantidade: 6  }] },
  { sku_venda: 'KIT240',     composicao: [{ sku_base: 'SAQUINHO',      quantidade: 12 }] },
  { sku_venda: 'KIT480',     composicao: [{ sku_base: 'SAQUINHO',      quantidade: 24 }] },
  // FIX: KITPS (com porta-saquinho) — nomes corretos
  { sku_venda: 'KITPS120B',  composicao: [{ sku_base: 'SAQUINHO', quantidade: 6  }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
  { sku_venda: 'KITPS240B',  composicao: [{ sku_base: 'SAQUINHO', quantidade: 12 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
  { sku_venda: 'KITPS480B',  composicao: [{ sku_base: 'SAQUINHO', quantidade: 24 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
]

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ ...S.card, width: '100%', maxWidth: 480, padding: '28px 32px' }}>{children}</div>
    </div>
  )
}

export default function ComposicaoPage() {
  const [maps,      setMaps]      = useState<SkuMap[]>([])
  const [produtos,  setProdutos]  = useState<ProdBase[]>([])   // FIX: lê do banco dinamicamente
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editQtd,   setEditQtd]   = useState(0)
  const [toast,     setToast]     = useState({ msg: '', type: 'ok' })
  const [newMap,    setNewMap]    = useState({ sku_venda: '', sku_base: '', quantidade: 1 })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [mapRes, prodRes] = await Promise.all([
      supabase.from('sku_map').select('*').order('sku_venda'),
      // FIX: SKU_BASE_OPCOES agora vem do banco — não hardcoded
      supabase.from('estoque').select('sku_base,produto').order('sku_base'),
    ])
    setMaps(mapRes.data || [])
    setProdutos(prodRes.data || [])
    setLoading(false)
  }

  function showToast(msg: string, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 4000)
  }

  async function handleAdd() {
    if (!newMap.sku_venda.trim()) { showToast('Informe o SKU de venda', 'err'); return }
    if (!newMap.sku_base)         { showToast('Selecione o SKU base', 'err'); return }
    if (newMap.quantidade <= 0)   { showToast('Quantidade deve ser maior que zero', 'err'); return }

    const { error } = await supabase.from('sku_map').insert({
      sku_venda:  newMap.sku_venda.toUpperCase().trim(),
      sku_base:   newMap.sku_base,
      quantidade: newMap.quantidade,
    })
    if (error) { showToast('Erro ao adicionar: ' + error.message, 'err'); return }
    showToast('Mapeamento adicionado!')
    setShowAdd(false)
    setNewMap({ sku_venda: '', sku_base: produtos[0]?.sku_base || '', quantidade: 1 })
    loadData()
  }

  async function handleEdit(id: string) {
    if (editQtd <= 0) { showToast('Quantidade deve ser maior que zero', 'err'); return }
    const { error } = await supabase.from('sku_map').update({ quantidade: editQtd }).eq('id', id)
    if (error) { showToast('Erro ao editar', 'err'); return }
    showToast('Quantidade atualizada!')
    setEditId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este mapeamento?')) return
    await supabase.from('sku_map').delete().eq('id', id)
    showToast('Removido!')
    loadData()
  }

  async function handleCarregarPresets() {
    let count = 0
    for (const preset of SKU_PRESETS) {
      for (const comp of preset.composicao) {
        // Verifica se produto base existe no cadastro
        const existeProd = produtos.find(p => p.sku_base === comp.sku_base)
        if (!existeProd) continue // pula se produto base não cadastrado

        const { data: existing } = await supabase
          .from('sku_map')
          .select('id')
          .eq('sku_venda', preset.sku_venda)
          .eq('sku_base', comp.sku_base)
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabase.from('sku_map').insert({
            sku_venda:  preset.sku_venda,
            sku_base:   comp.sku_base,
            quantidade: comp.quantidade,
          })
          count++
        }
      }
    }
    showToast(count > 0 ? `${count} mapeamentos carregados!` : 'Todos os presets já estavam cadastrados')
    loadData()
  }

  // Agrupar por SKU de venda
  const agrupados: Agrupado[] = Object.values(
    maps.reduce((acc, m) => {
      if (!acc[m.sku_venda]) acc[m.sku_venda] = { sku_venda: m.sku_venda, composicao: [] }
      acc[m.sku_venda].composicao.push({ id: m.id, sku_base: m.sku_base, quantidade: m.quantidade })
      return acc
    }, {} as Record<string, Agrupado>)
  )

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
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>🔗 Composição de SKUs</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>
            {agrupados.length} SKUs de venda · {maps.length} mapeamentos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {maps.length === 0 && (
            <button onClick={handleCarregarPresets} style={S.btnSm}>🔀 Carregar Padrão</button>
          )}
          <button onClick={() => setShowAdd(true)} style={S.btn}>+ Novo Mapeamento</button>
        </div>
      </div>

      {/* INFO */}
      <div style={{ ...S.card, marginBottom: 16, padding: '12px 16px', background: '#0a1520', border: '1px solid #0ea5e933', fontSize: 13, color: '#0ea5e9' }}>
        <strong>Como funciona:</strong> cada SKU de venda (anunciado na Shopee) é mapeado para um ou mais SKUs base do estoque.
        Quando um pedido é importado, o sistema consulta este mapa e calcula o consumo automaticamente.
      </div>

      {/* TABELA */}
      {agrupados.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#55556a' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nenhum mapeamento cadastrado</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>Clique em "Carregar Padrão" para carregar os SKUs do negócio</div>
          {produtos.length > 0 && (
            <button onClick={handleCarregarPresets} style={S.btn}>🔀 Carregar Padrão</button>
          )}
          {produtos.length === 0 && (
            <div style={{ fontSize: 12, color: '#ef4444' }}>Cadastre os produtos base primeiro na aba Produtos Base</div>
          )}
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['SKU Venda', 'Composição (SKUs Base)', 'Ação'].map(h => (
                    <th key={h} style={{ ...S.th, textAlign: h === 'Ação' ? 'center' as any : S.th.textAlign }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agrupados.map(grupo => (
                  <tr key={grupo.sku_venda} style={{ borderBottom: '1px solid #1e1e2a', verticalAlign: 'top' }}>
                    {/* SKU Venda */}
                    <td style={{ ...S.td, paddingTop: 14 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 5, padding: '3px 10px' }}>
                        {grupo.sku_venda}
                      </span>
                    </td>

                    {/* Composição */}
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {grupo.composicao.map(comp => (
                          <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#13131e', border: '1px solid #2a2a3a', borderRadius: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace' }}>{comp.sku_base}</span>
                            <span style={{ fontSize: 11, color: '#555' }}>×</span>
                            {editId === comp.id ? (
                              <input type="number" value={editQtd} onChange={e => setEditQtd(+e.target.value)}
                                style={{ ...S.inp, width: 60, padding: '3px 8px', fontSize: 12 }} min={1} />
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e2f0' }}>{comp.quantidade}</span>
                            )}
                            <div style={{ display: 'flex', gap: 4 }}>
                              {editId === comp.id ? (
                                <button onClick={() => handleEdit(comp.id)} style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓</button>
                              ) : (
                                <button onClick={() => { setEditId(comp.id); setEditQtd(comp.quantidade) }}
                                  style={{ background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✏️</button>
                              )}
                              <button onClick={() => handleDelete(comp.id)}
                                style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Ação: adicionar mais SKU base ao mesmo venda */}
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <button onClick={() => {
                        setNewMap({ sku_venda: grupo.sku_venda, sku_base: produtos[0]?.sku_base || '', quantidade: 1 })
                        setShowAdd(true)
                      }} style={{ ...S.btnSm, fontSize: 11 }}>+ SKU Base</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, background: toast.type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999 }}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Modal Adicionar */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>🔗 Novo Mapeamento</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>SKU de Venda (Shopee)</label>
              <input type="text" value={newMap.sku_venda} onChange={e => setNewMap({ ...newMap, sku_venda: e.target.value.toUpperCase() })}
                placeholder="Ex: FM100, KITPS120B" style={S.inp} />
            </div>
            <div>
              <label style={S.label}>SKU Base (Estoque)</label>
              {/* FIX: select dinâmico do banco, não hardcoded */}
              <select value={newMap.sku_base} onChange={e => setNewMap({ ...newMap, sku_base: e.target.value })} style={S.inp}>
                <option value="">Selecione...</option>
                {produtos.map(p => (
                  <option key={p.sku_base} value={p.sku_base}>{p.sku_base} — {p.produto}</option>
                ))}
              </select>
              {produtos.length === 0 && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Nenhum produto base cadastrado. Vá para Produtos Base primeiro.</div>
              )}
            </div>
            <div>
              <label style={S.label}>Quantidade Consumida por Venda</label>
              <input type="number" value={newMap.quantidade} onChange={e => setNewMap({ ...newMap, quantidade: +e.target.value })}
                style={S.inp} min={1} />
            </div>
            <div style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#55556a' }}>
              Exemplo: <strong style={{ color: '#ff6600' }}>FM100</strong> → <strong style={{ color: '#a78bfa' }}>FORMA</strong> × <strong style={{ color: '#e2e2f0' }}>2</strong> = cada venda de FM100 consome 2 formas do estoque.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={handleAdd} style={{ ...S.btn, flex: 1 }}>Salvar</button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
