'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { Package, Plus, Edit3, Save, X, Download, FileText, Search, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react'

type EstoqueItem = {
  id: string
  sku_base: string
  produto: string
  estoque_atual: number
  estoque_minimo: number
  created_at: string
}

type MovItem = {
  id?: string
  data: string
  tipo: 'ENTRADA' | 'AJUSTE'
  sku_base: string
  quantidade: number
  origem: string
  observacao: string
}

export default function EstoquePage() {
  const [items, setItems] = useState<EstoqueItem[]>([])
  const [filtered, setFiltered] = useState<EstoqueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<EstoqueItem>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [showMov, setShowMov] = useState(false)
  const [newItem, setNewItem] = useState({ sku_base: '', produto: '', estoque_atual: 0, estoque_minimo: 0 })
  const [mov, setMov] = useState<MovItem>({ data: new Date().toISOString().split('T')[0], tipo: 'ENTRADA', sku_base: '', quantidade: 0, origem: '', observacao: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(items.filter(i => i.produto?.toLowerCase().includes(q) || i.sku_base?.toLowerCase().includes(q)))
  }, [search, items])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('estoque').select('*').order('produto')
    setItems(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  async function handleSave(id: string) {
    const { error } = await supabase.from('estoque').update(editValues).eq('id', id)
    if (!error) { setEditingId(null); loadData(); }
  }

  async function handleAdd() {
    const { error } = await supabase.from('estoque').insert(newItem)
    if (!error) { setShowAdd(false); setNewItem({ sku_base: '', produto: '', estoque_atual: 0, estoque_minimo: 0 }); loadData(); }
  }

  async function handleMovimentacao() {
    // Update estoque
    const item = items.find(i => i.sku_base === mov.sku_base)
    if (!item) return

    const delta = mov.tipo === 'ENTRADA' ? mov.quantidade : (mov.tipo === 'AJUSTE' ? mov.quantidade - item.estoque_atual : 0)
    const novoEstoque = mov.tipo === 'AJUSTE' ? mov.quantidade : item.estoque_atual + delta

    await supabase.from('estoque').update({ estoque_atual: novoEstoque }).eq('id', item.id)
    await supabase.from('movimentacoes').insert({
      data: mov.data,
      tipo: mov.tipo,
      sku_base: mov.sku_base,
      quantidade: Math.abs(delta),
      origem: mov.origem || 'Manual',
      observacao: mov.observacao,
    })

    setMsg('Movimentação registrada!')
    setShowMov(false)
    loadData()
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este item do estoque?')) return
    await supabase.from('estoque').delete().eq('id', id)
    loadData()
  }

  const exportExcel = () => {
    exportToExcel(filtered.map(i => ({
      'SKU Base': i.sku_base,
      'Produto': i.produto,
      'Estoque Atual': i.estoque_atual,
      'Estoque Mínimo': i.estoque_minimo,
    })), 'estoque', 'Estoque')
  }

  const exportPdf = () => {
    exportToPDF('Relatório de Estoque',
      [
        { header: 'SKU Base', dataKey: 'sku_base' },
        { header: 'Produto', dataKey: 'produto' },
        { header: 'Estoque Atual', dataKey: 'estoque_atual' },
        { header: 'Estoque Mínimo', dataKey: 'estoque_minimo' },
        { header: 'Status', dataKey: 'status' },
      ],
      filtered.map(i => ({ ...i, status: i.estoque_atual <= i.estoque_minimo ? '⚠️ BAIXO' : '✅ OK' })),
      'estoque'
    )
  }

  const totalItens = items.reduce((s, i) => s + i.estoque_atual, 0)
  const alertas = items.filter(i => i.estoque_atual <= i.estoque_minimo).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Estoque</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {items.length} produtos · {totalItens} unidades · {alertas} alertas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMov(true)} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Movimentação
          </button>
          <button onClick={exportExcel} className="btn-secondary">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPdf} className="btn-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,214,143,0.1)', color: 'var(--success)', border: '1px solid rgba(0,214,143,0.2)' }}>
          {msg}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input-field pl-10" placeholder="Buscar produto ou SKU..." />
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="grid grid-cols-5 table-header">
          <span>SKU Base</span>
          <span>Produto</span>
          <span className="text-center">Estoque Atual</span>
          <span className="text-center">Estoque Mínimo</span>
          <span className="text-center">Ações</span>
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum produto no estoque</p>
          </div>
        ) : (
          filtered.map(item => {
            const isLow = item.estoque_atual <= item.estoque_minimo
            const isEdit = editingId === item.id
            return (
              <div key={item.id} className="grid grid-cols-5 table-row items-center"
                   style={{ borderLeft: isLow ? '3px solid var(--warning)' : '3px solid transparent' }}>
                <span className="font-mono text-sm" style={{ color: 'var(--shopee-primary)' }}>{item.sku_base}</span>

                {isEdit ? (
                  <input value={editValues.produto || ''} onChange={e => setEditValues({ ...editValues, produto: e.target.value })}
                    className="input-field text-sm" />
                ) : (
                  <span className="font-medium">{item.produto}</span>
                )}

                {isEdit ? (
                  <input type="number" value={editValues.estoque_atual ?? ''} onChange={e => setEditValues({ ...editValues, estoque_atual: +e.target.value })}
                    className="input-field text-sm text-center" />
                ) : (
                  <span className="text-center">
                    <span className={isLow ? 'badge-warning' : 'badge-success'}>{item.estoque_atual} un</span>
                  </span>
                )}

                {isEdit ? (
                  <input type="number" value={editValues.estoque_minimo ?? ''} onChange={e => setEditValues({ ...editValues, estoque_minimo: +e.target.value })}
                    className="input-field text-sm text-center" />
                ) : (
                  <span className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>{item.estoque_minimo} un</span>
                )}

                <div className="flex items-center justify-center gap-2">
                  {isEdit ? (
                    <>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 rounded-lg" style={{ background: 'rgba(0,214,143,0.1)', color: 'var(--success)' }}>
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(item.id); setEditValues(item) }} className="p-1.5 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                        <Edit3 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,61,113,0.05)' }}>
                        <X className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Novo Produto no Estoque</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>SKU Base</label>
                <input value={newItem.sku_base} onChange={e => setNewItem({ ...newItem, sku_base: e.target.value })}
                  className="input-field" placeholder="Ex: FORMA" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Nome do Produto</label>
                <input value={newItem.produto} onChange={e => setNewItem({ ...newItem, produto: e.target.value })}
                  className="input-field" placeholder="Ex: Forma de Gelo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Estoque Atual</label>
                  <input type="number" value={newItem.estoque_atual} onChange={e => setNewItem({ ...newItem, estoque_atual: +e.target.value })}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Estoque Mínimo</label>
                  <input type="number" value={newItem.estoque_minimo} onChange={e => setNewItem({ ...newItem, estoque_minimo: +e.target.value })}
                    className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAdd} className="btn-primary flex-1">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Movimentacao Modal */}
      {showMov && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Registrar Movimentação</h2>
              <button onClick={() => setShowMov(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                <select value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value as 'ENTRADA' | 'AJUSTE' })} className="input-field">
                  <option value="ENTRADA">Entrada</option>
                  <option value="AJUSTE">Ajuste de Estoque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Produto (SKU Base)</label>
                <select value={mov.sku_base} onChange={e => setMov({ ...mov, sku_base: e.target.value })} className="input-field">
                  <option value="">Selecione...</option>
                  {items.map(i => <option key={i.id} value={i.sku_base}>{i.produto} ({i.sku_base})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {mov.tipo === 'AJUSTE' ? 'Novo Estoque Total' : 'Quantidade a Adicionar'}
                </label>
                <input type="number" value={mov.quantidade} onChange={e => setMov({ ...mov, quantidade: +e.target.value })}
                  className="input-field" min="0" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Observação</label>
                <input value={mov.observacao} onChange={e => setMov({ ...mov, observacao: e.target.value })}
                  className="input-field" placeholder="Ex: Compra fornecedor..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMov(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleMovimentacao} className="btn-primary flex-1">
                {mov.tipo === 'ENTRADA' ? <ArrowUp className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
