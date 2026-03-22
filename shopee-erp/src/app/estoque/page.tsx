'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

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
type MovEntry = { sku_base: string; quantidade: number; tipo: string }

function Badge({ v, min }: { v: number; min: number }) {
  const empty = v <= 0
  const low   = v <= min
  const color = empty ? '#ef4444' : low ? '#f59e0b' : '#22c55e'
  return (
    <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
      {N(v)} un
    </span>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ ...S.card, width: '100%', maxWidth: 480, padding: '28px 32px' }}>{children}</div>
    </div>
  )
}

export default function EstoquePage() {
  const [items,      setItems]      = useState<Item[]>([])
  const [movEntries, setMovEntries] = useState<MovEntry[]>([])
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [skuMap,     setSkuMap]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [editId,     setEditId]     = useState<string | null>(null)
  const [editVals,   setEditVals]   = useState<Partial<Item>>({})
  const [showAdd,    setShowAdd]    = useState(false)
  const [showMov,    setShowMov]    = useState(false)
  const [showDel,    setShowDel]    = useState(false)
  const [limpando,   setLimpando]   = useState(false)
  const [toast,      setToast]      = useState({ msg: '', type: 'ok' })
  const [newItem,    setNewItem]    = useState({ sku_base: '', produto: '', estoque_atual: 0, estoque_minimo: 0 })
  const [mov,        setMov]        = useState({ data: new Date().toISOString().slice(0,10), tipo: 'ENTRADA', sku_base: '', quantidade: 0, observacao: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [estRes, movRes, finRes, mapRes] = await Promise.all([
      supabase.from('estoque').select('*').order('produto'),
      supabase.from('movimentacoes').select('sku_base,quantidade,tipo'),
      supabase.from('financeiro').select('sku,quantidade').limit(5000),
      supabase.from('sku_map').select('sku_venda,sku_base,quantidade'),
    ])
    setItems(estRes.data || [])
    setMovEntries(movRes.data || [])
    setFinanceiro(finRes.data || [])
    setSkuMap(mapRes.data || [])
    setLoading(false)
  }

  function showToast(msg: string, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 3000)
  }

  // Histórico de compra = estoque_atual (setup inicial) + SOMA(ENTRADAs em movimentacoes)
  // IMPORTANTE: estoque_atual NO BANCO representa o valor inicial do setup e NUNCA é alterado
  // após o setup. Todas as entradas posteriores vão APENAS para movimentacoes.
  const historicoCompra = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach(i => { map[i.sku_base] = i.estoque_atual }) // base: estoque inicial do setup
    movEntries.filter(m => m.tipo === 'ENTRADA').forEach(m => {
      map[m.sku_base] = (map[m.sku_base] || 0) + (m.quantidade || 0)
    })
    return map
  }, [items, movEntries])

  // Consumo por vendas = cruzamento financeiro × sku_map
  const consumoVendas = useMemo(() => {
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

  async function saveEdit(id: string) {
    await supabase.from('estoque').update(editVals).eq('id', id)
    setEditId(null); load()
  }

  async function addItem() {
    if (!newItem.sku_base || !newItem.produto) { showToast('Preencha SKU e produto', 'err'); return }
    await supabase.from('estoque').insert(newItem)
    setShowAdd(false)
    setNewItem({ sku_base: '', produto: '', estoque_atual: 0, estoque_minimo: 0 })
    load()
  }

  async function doMov() {
    const item = items.find(i => i.sku_base === mov.sku_base)
    if (!item) { showToast('Selecione um produto', 'err'); return }
    if (!mov.quantidade || mov.quantidade <= 0) { showToast('Informe a quantidade', 'err'); return }

    if (mov.tipo === 'AJUSTE') {
      // AJUSTE: define o novo estoque_atual (valor de setup)
      // Aqui é a ÚNICA exceção onde estoque_atual é atualizado:
      // o AJUSTE redefine a base do estoque (zera o histórico implicitamente)
      const estoqueRealAtual = (historicoCompra[item.sku_base] || 0) - (consumoVendas[item.sku_base] || 0)
      const delta = Math.abs(mov.quantidade - estoqueRealAtual)

      // Para AJUSTE: atualiza estoque_atual e zera movimentacoes de ENTRADA
      // para que a fórmula historicoCompra - consumo seja consistente
      await supabase.from('estoque').update({ estoque_atual: mov.quantidade }).eq('id', item.id)

      // Apaga ENTRADAs anteriores deste produto para evitar acúmulo incorreto
      await supabase.from('movimentacoes')
        .delete()
        .eq('sku_base', item.sku_base)
        .eq('tipo', 'ENTRADA')

      // Registra o ajuste no histórico
      await supabase.from('movimentacoes').insert({
        data:        mov.data,
        tipo:        'AJUSTE',
        sku_base:    mov.sku_base,
        quantidade:  delta,
        origem:      'Manual',
        observacao:  mov.observacao || `Ajuste para ${mov.quantidade} un`,
      })
    } else {
      // FIX: ENTRADA — NÃO atualiza estoque_atual no banco
      // Vai APENAS para movimentacoes
      // historicoCompra = estoque_atual (setup) + SOMA(ENTRADAs) → já soma automaticamente
      await supabase.from('movimentacoes').insert({
        data:        mov.data,
        tipo:        'ENTRADA',
        sku_base:    mov.sku_base,
        quantidade:  mov.quantidade,
        origem:      'Manual',
        observacao:  mov.observacao,
      })
    }

    showToast('Movimentação registrada!')
    setShowMov(false)
    setMov({ data: new Date().toISOString().slice(0,10), tipo: 'ENTRADA', sku_base: '', quantidade: 0, observacao: '' })
    load()
  }

  async function delItem(id: string) {
    if (!confirm('Excluir produto?')) return
    await supabase.from('estoque').delete().eq('id', id)
    load()
  }

  async function limparTudo() {
    setLimpando(true)
    // Zera movimentacoes e reseta estoque_atual para 0
    await supabase.from('movimentacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    for (const i of items) await supabase.from('estoque').update({ estoque_atual: 0 }).eq('id', i.id)
    setShowDel(false); setLimpando(false)
    showToast('Estoque zerado.')
    load()
  }

  const lista = items.filter(i => {
    const q = search.toLowerCase()
    return i.produto?.toLowerCase().includes(q) || i.sku_base?.toLowerCase().includes(q)
  })

  const alertas = items.filter(i => {
    const estoqueReal = (historicoCompra[i.sku_base] || 0) - (consumoVendas[i.sku_base] || 0)
    return estoqueReal <= i.estoque_minimo
  }).length

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
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>{items.length} produtos · {alertas} {alertas === 1 ? 'alerta' : 'alertas'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowMov(true)} style={S.btnSm}>🔄 Entrada de Compra</button>
          <button onClick={() => setShowDel(true)} style={S.btnDanger}>🗑️ Zerar</button>
          <button onClick={() => setShowAdd(true)} style={S.btn}>+ Novo Produto</button>
        </div>
      </div>

      {/* BUSCA */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar produto ou SKU..."
          style={{ ...S.inp, maxWidth: 320 }} />
      </div>

      {/* LEGENDA */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11, color: '#55556a', flexWrap: 'wrap' }}>
        <span>📥 <strong style={{ color: '#a78bfa' }}>Histórico de Compra</strong> = estoque inicial + entradas registradas</span>
        <span>📤 <strong style={{ color: '#f59e0b' }}>Consumo Vendas</strong> = calculado automaticamente pelas vendas importadas</span>
        <span>📦 <strong style={{ color: '#22c55e' }}>Estoque Real</strong> = Compras − Consumo</span>
      </div>

      {/* TABELA */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['SKU Base', 'Produto', 'Hist. Compra', 'Consumo Vendas', 'Estoque Real', 'Mínimo', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ ...S.th, textAlign: ['Hist. Compra','Consumo Vendas','Estoque Real','Mínimo','Status'].includes(h) ? 'center' as any : S.th.textAlign }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: '40px', color: '#55556a' }}>Nenhum produto encontrado</td></tr>
              ) : lista.map(item => {
                const histCompra  = historicoCompra[item.sku_base] || 0
                const consumo     = consumoVendas[item.sku_base] || 0
                const estoqueReal = histCompra - consumo
                const low         = estoqueReal <= item.estoque_minimo
                const empty       = estoqueReal <= 0
                const isEdit      = editId === item.id
                const corStatus   = empty ? '#ef4444' : low ? '#f59e0b' : '#22c55e'
                const labelStatus = empty ? 'SEM ESTOQUE' : low ? 'BAIXO' : 'OK'

                return (
                  <tr key={item.id} style={{ borderLeft: `3px solid ${low || empty ? corStatus : 'transparent'}` }}>
                    <td style={S.td}><span style={{ color: '#ff6600', fontWeight: 700, fontFamily: 'monospace' }}>{item.sku_base}</span></td>
                    <td style={S.td}>
                      {isEdit
                        ? <input value={editVals.produto || ''} onChange={e => setEditVals({ ...editVals, produto: e.target.value })} style={{ ...S.inp, width: 180 }} />
                        : <span style={{ fontWeight: 500 }}>{item.produto}</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{ background: '#a78bfa22', color: '#a78bfa', border: '1px solid #a78bfa44', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {N(histCompra)} un
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {N(consumo)} un
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <Badge v={estoqueReal} min={item.estoque_minimo} />
                    </td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#55556a' }}>
                      {isEdit
                        ? <input type="number" value={editVals.estoque_minimo ?? ''} onChange={e => setEditVals({ ...editVals, estoque_minimo: +e.target.value })} style={{ ...S.inp, width: 80, textAlign: 'center' }} />
                        : `${item.estoque_minimo} un`}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{ background: corStatus + '22', color: corStatus, border: `1px solid ${corStatus}44`, borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                        {labelStatus}
                      </span>
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
      {toast.msg && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, background: toast.type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999 }}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

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
              <div><label style={S.label}>Estoque Inicial</label><input type="number" value={newItem.estoque_atual} onChange={e => setNewItem({ ...newItem, estoque_atual: +e.target.value })} style={S.inp} /></div>
              <div><label style={S.label}>Estoque Mínimo</label><input type="number" value={newItem.estoque_minimo} onChange={e => setNewItem({ ...newItem, estoque_minimo: +e.target.value })} style={S.inp} /></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={addItem} style={{ ...S.btn, flex: 1 }}>Adicionar</button>
          </div>
        </Modal>
      )}

      {/* Modal Entrada de Compra */}
      {showMov && (
        <Modal onClose={() => setShowMov(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>📥 Registrar Entrada de Compra</h3>
            <button onClick={() => setShowMov(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Tipo</label>
              <select value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value })} style={S.inp}>
                <option value="ENTRADA">➕ Entrada de Compra</option>
                <option value="AJUSTE">🔧 Ajuste Manual (redefine base)</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Produto</label>
              <select value={mov.sku_base} onChange={e => setMov({ ...mov, sku_base: e.target.value })} style={S.inp}>
                <option value="">Selecione...</option>
                {items.map(i => <option key={i.id} value={i.sku_base}>{i.produto} ({i.sku_base})</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>{mov.tipo === 'AJUSTE' ? 'Novo Estoque Total (absoluto)' : 'Quantidade Comprada'}</label>
              <input type="number" value={mov.quantidade || ''} onChange={e => setMov({ ...mov, quantidade: +e.target.value })} style={S.inp} min="0" />
            </div>
            <div>
              <label style={S.label}>Observação</label>
              <input value={mov.observacao} onChange={e => setMov({ ...mov, observacao: e.target.value })} placeholder="Ex: Compra fornecedor XYZ..." style={S.inp} />
            </div>

            {/* Preview do resultado */}
            {mov.sku_base && mov.quantidade > 0 && (
              <div style={{ background: '#0f1a0f', border: '1px solid #22c55e33', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                {mov.tipo === 'ENTRADA' ? (
                  <>
                    <span style={{ color: '#55556a' }}>Novo histórico: </span>
                    <strong style={{ color: '#22c55e' }}>
                      {N((historicoCompra[mov.sku_base] || 0) + mov.quantidade)} un
                    </strong>
                    <span style={{ color: '#55556a' }}> → Estoque real: </span>
                    <strong style={{ color: '#22c55e' }}>
                      {N((historicoCompra[mov.sku_base] || 0) + mov.quantidade - (consumoVendas[mov.sku_base] || 0))} un
                    </strong>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#f59e0b' }}>⚠️ Ajuste redefine base: estoque real passará a ser </span>
                    <strong style={{ color: '#22c55e' }}>{N(mov.quantidade)} un</strong>
                    <span style={{ color: '#55556a' }}> (entradas anteriores serão removidas)</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowMov(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={doMov} style={{ ...S.btn, flex: 1 }}>↑ Registrar</button>
          </div>
        </Modal>
      )}

      {/* Modal Zerar */}
      {showDel && (
        <Modal onClose={() => setShowDel(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Zerar Estoque</h3>
          </div>
          <p style={{ fontSize: 13, color: '#9090aa', marginBottom: 8 }}>
            Isso vai <strong style={{ color: '#e2e2f0' }}>zerar</strong> o estoque atual e apagar o histórico de movimentações. Os produtos não serão excluídos.
          </p>
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
