'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)

const S = {
  page:     { padding: '20px 24px', width: '100%', boxSizing: 'border-box' as any },
  card:     { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:       { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:       { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:      { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any, width: '100%' },
  btn:      { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:    { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnGhost: { background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 500, fontSize: 12 },
  btnDanger:{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  label:    { fontSize: 11, color: '#55556a', marginBottom: 5, display: 'block', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as any },
}

type Item = { id: string; sku_base: string; produto: string; estoque_atual: number; estoque_minimo: number }
type Mov  = { data: string; tipo: 'ENTRADA' | 'AJUSTE'; sku_base: string; quantidade: number; observacao: string }

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ ...S.card, width: '100%', maxWidth: 480, padding: '28px 32px', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}

export default function EstoquePage() {
  const [items,    setItems]    = useState<Item[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editVals, setEditVals] = useState<Partial<Item>>({})
  const [showAdd,  setShowAdd]  = useState(false)
  const [showMov,  setShowMov]  = useState(false)
  const [showDel,  setShowDel]  = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [toast,    setToast]    = useState('')
  const [newItem,  setNewItem]  = useState({ sku_base: '', produto: '', estoque_atual: 0, estoque_minimo: 0 })
  const [mov,      setMov]      = useState<Mov>({ data: new Date().toISOString().slice(0,10), tipo: 'ENTRADA', sku_base: '', quantidade: 0, observacao: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('estoque').select('*').order('produto')
    setItems(data || [])
    setLoading(false)
  }

  function toast3(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function saveEdit(id: string) {
    await supabase.from('estoque').update(editVals).eq('id', id)
    setEditId(null); load()
  }

  async function addItem() {
    await supabase.from('estoque').insert(newItem)
    setShowAdd(false)
    setNewItem({ sku_base: '', produto: '', estoque_atual: 0, estoque_minimo: 0 })
    load()
  }

  async function doMov() {
    const item = items.find(i => i.sku_base === mov.sku_base)
    if (!item) return
    const novoEst = mov.tipo === 'AJUSTE' ? mov.quantidade : item.estoque_atual + mov.quantidade
    const delta   = Math.abs(novoEst - item.estoque_atual)
    await supabase.from('estoque').update({ estoque_atual: novoEst }).eq('id', item.id)
    await supabase.from('movimentacoes').insert({ data: mov.data, tipo: mov.tipo, sku_base: mov.sku_base, quantidade: delta, origem: 'Manual', observacao: mov.observacao })
    toast3('Movimentação registrada!')
    setShowMov(false); load()
  }

  async function delItem(id: string) {
    if (!confirm('Excluir produto?')) return
    await supabase.from('estoque').delete().eq('id', id); load()
  }

  async function limparTudo() {
    setLimpando(true)
    await supabase.from('movimentacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    for (const i of items) await supabase.from('estoque').update({ estoque_atual: 0 }).eq('id', i.id)
    setShowDel(false); setLimpando(false)
    toast3('Estoque zerado.'); load()
  }

  const lista = items.filter(i => {
    const q = search.toLowerCase()
    return i.produto?.toLowerCase().includes(q) || i.sku_base?.toLowerCase().includes(q)
  })
  const alertas = items.filter(i => i.estoque_atual <= i.estoque_minimo).length
  const total   = items.reduce((s, i) => s + i.estoque_atual, 0)

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
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>📦 Estoque</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>{items.length} produtos · {total} unidades · {alertas} {alertas === 1 ? 'alerta' : 'alertas'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowMov(true)} style={S.btnSm}>🔄 Movimentação</button>
          <button onClick={() => setShowDel(true)} style={S.btnDanger}>🗑️ Limpar Estoque</button>
          <button onClick={() => setShowAdd(true)} style={S.btn}>+ Novo Produto</button>
        </div>
      </div>

      {/* BUSCA */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar produto ou SKU..."
          style={{ ...S.inp, maxWidth: 320 }} />
      </div>

      {/* TABELA */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['SKU Base', 'Produto', 'Estoque Atual', 'Mínimo', 'Ações'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', padding: '40px', color: '#55556a' }}>Nenhum produto encontrado</td></tr>
              ) : lista.map(item => {
                const low    = item.estoque_atual <= item.estoque_minimo
                const isEdit = editId === item.id
                return (
                  <tr key={item.id} style={{ borderLeft: `3px solid ${low ? '#f59e0b' : 'transparent'}` }}>
                    <td style={S.td}><span style={{ color: '#ff6600', fontWeight: 600 }}>{item.sku_base}</span></td>
                    <td style={S.td}>
                      {isEdit
                        ? <input value={editVals.produto || ''} onChange={e => setEditVals({ ...editVals, produto: e.target.value })} style={{ ...S.inp, width: 180 }} />
                        : <span style={{ fontWeight: 500 }}>{item.produto}</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      {isEdit
                        ? <input type="number" value={editVals.estoque_atual ?? ''} onChange={e => setEditVals({ ...editVals, estoque_atual: +e.target.value })} style={{ ...S.inp, width: 80, textAlign: 'center' }} />
                        : <span style={{ background: low ? '#f59e0b22' : '#22c55e22', color: low ? '#f59e0b' : '#22c55e', border: `1px solid ${low ? '#f59e0b44' : '#22c55e44'}`, borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{item.estoque_atual} un</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#55556a' }}>
                      {isEdit
                        ? <input type="number" value={editVals.estoque_minimo ?? ''} onChange={e => setEditVals({ ...editVals, estoque_minimo: +e.target.value })} style={{ ...S.inp, width: 80, textAlign: 'center' }} />
                        : `${item.estoque_minimo} un`}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {isEdit ? (
                          <>
                            <button onClick={() => saveEdit(item.id)} style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Salvar</button>
                            <button onClick={() => setEditId(null)} style={{ ...S.btnGhost, padding: '5px 10px' }}>✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(item.id); setEditVals(item) }} style={{ ...S.btnGhost, padding: '5px 10px', fontSize: 13 }}>✏️</button>
                            <button onClick={() => delItem(item.id)} style={{ background: '#ef444412', color: '#ef4444', border: '1px solid #ef444425', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && <div style={{ position: 'fixed', bottom: 28, right: 28, background: '#16a34a', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999 }}>✅ {toast}</div>}

      {/* Modal Add */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>+ Novo Produto</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={S.label}>SKU Base</label><input value={newItem.sku_base} onChange={e => setNewItem({ ...newItem, sku_base: e.target.value })} placeholder="Ex: FORMA" style={S.inp} /></div>
            <div><label style={S.label}>Nome do Produto</label><input value={newItem.produto} onChange={e => setNewItem({ ...newItem, produto: e.target.value })} placeholder="Ex: Forma Air Fryer" style={S.inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={S.label}>Estoque Atual</label><input type="number" value={newItem.estoque_atual} onChange={e => setNewItem({ ...newItem, estoque_atual: +e.target.value })} style={S.inp} /></div>
              <div><label style={S.label}>Estoque Mínimo</label><input type="number" value={newItem.estoque_minimo} onChange={e => setNewItem({ ...newItem, estoque_minimo: +e.target.value })} style={S.inp} /></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={addItem} style={{ ...S.btn, flex: 1 }}>Adicionar</button>
          </div>
        </Modal>
      )}

      {/* Modal Movimentação */}
      {showMov && (
        <Modal onClose={() => setShowMov(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>🔄 Registrar Movimentação</h3>
            <button onClick={() => setShowMov(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={S.label}>Tipo</label>
              <select value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value as any })} style={S.inp}>
                <option value="ENTRADA">Entrada</option>
                <option value="AJUSTE">Ajuste de Estoque</option>
              </select>
            </div>
            <div><label style={S.label}>Produto</label>
              <select value={mov.sku_base} onChange={e => setMov({ ...mov, sku_base: e.target.value })} style={S.inp}>
                <option value="">Selecione...</option>
                {items.map(i => <option key={i.id} value={i.sku_base}>{i.produto} ({i.sku_base})</option>)}
              </select>
            </div>
            <div><label style={S.label}>{mov.tipo === 'AJUSTE' ? 'Novo Estoque Total' : 'Quantidade a Adicionar'}</label>
              <input type="number" value={mov.quantidade} onChange={e => setMov({ ...mov, quantidade: +e.target.value })} style={S.inp} min="0" />
            </div>
            <div><label style={S.label}>Observação</label>
              <input value={mov.observacao} onChange={e => setMov({ ...mov, observacao: e.target.value })} placeholder="Ex: Compra fornecedor..." style={S.inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowMov(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={doMov} style={{ ...S.btn, flex: 1 }}>↑ Registrar</button>
          </div>
        </Modal>
      )}

      {/* Modal Limpar */}
      {showDel && (
        <Modal onClose={() => setShowDel(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Zerar Estoque</h3>
          </div>
          <p style={{ fontSize: 13, color: '#9090aa', marginBottom: 8 }}>Isso vai <strong style={{ color: '#e2e2f0' }}>zerar</strong> o estoque atual de todos os produtos e apagar o histórico de movimentações. Os produtos não serão excluídos.</p>
          <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 20 }}>Esta ação não pode ser desfeita.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowDel(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={limparTudo} disabled={limpando} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flex: 1 }}>
              {limpando ? 'Zerando...' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
