'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { GitBranch, Plus, X, Pencil, Check, AlertCircle } from 'lucide-react'

type SkuMap = {
  id: string
  sku_venda: string
  sku_base: string
  quantidade: number
}

type SkuAgrupado = {
  sku_venda: string
  composicao: { sku_base: string; quantidade: number }[]
}

const SKU_BASE_OPCOES = ['FORMA', 'SAQUINHO', 'PORTASAQUINHO', 'TAPETES']

const SKU_PRESETS: SkuAgrupado[] = [
  { sku_venda: 'FM50',      composicao: [{ sku_base: 'FORMA', quantidade: 1 }] },
  { sku_venda: 'FM100',     composicao: [{ sku_base: 'FORMA', quantidade: 2 }] },
  { sku_venda: 'FM200',     composicao: [{ sku_base: 'FORMA', quantidade: 4 }] },
  { sku_venda: 'FM300',     composicao: [{ sku_base: 'FORMA', quantidade: 6 }] },
  { sku_venda: 'KIT2TP',    composicao: [{ sku_base: 'TAPETES', quantidade: 2 }] },
  { sku_venda: 'KIT3TP',    composicao: [{ sku_base: 'TAPETES', quantidade: 3 }] },
  { sku_venda: 'KIT4TP',    composicao: [{ sku_base: 'TAPETES', quantidade: 4 }] },
  { sku_venda: 'KIT120',    composicao: [{ sku_base: 'SAQUINHO', quantidade: 6 }] },
  { sku_venda: 'KIT240',    composicao: [{ sku_base: 'SAQUINHO', quantidade: 12 }] },
  { sku_venda: 'KIT480',    composicao: [{ sku_base: 'SAQUINHO', quantidade: 24 }] },
  { sku_venda: 'KIT120B',   composicao: [{ sku_base: 'SAQUINHO', quantidade: 6 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
  { sku_venda: 'KIT240B',   composicao: [{ sku_base: 'SAQUINHO', quantidade: 12 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
  { sku_venda: 'KIT480B',   composicao: [{ sku_base: 'SAQUINHO', quantidade: 24 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
  { sku_venda: 'KITPS120B', composicao: [{ sku_base: 'SAQUINHO', quantidade: 6 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }] },
]

export default function SkuMapPage() {
  const [maps, setMaps] = useState<SkuMap[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editQtd, setEditQtd] = useState(0)
  const [newSku, setNewSku] = useState({
    sku_venda: '',
    sku_base: SKU_BASE_OPCOES[0],
    quantidade: 1,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('sku_map').select('*').order('sku_venda')
    setMaps(data || [])
    setLoading(false)
  }

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  async function handleAdd() {
    if (!newSku.sku_venda.trim()) return showMsg('Informe o SKU de venda', 'error')
    const { error } = await supabase.from('sku_map').insert({
      sku_venda: newSku.sku_venda.toUpperCase().trim(),
      sku_base: newSku.sku_base,
      quantidade: newSku.quantidade,
    })
    if (error) return showMsg('Erro ao adicionar: ' + error.message, 'error')
    showMsg('SKU adicionado com sucesso!')
    setShowAdd(false)
    setNewSku({ sku_venda: '', sku_base: SKU_BASE_OPCOES[0], quantidade: 1 })
    loadData()
  }

  async function handleEdit(id: string) {
    const { error } = await supabase.from('sku_map').update({ quantidade: editQtd }).eq('id', id)
    if (error) return showMsg('Erro ao editar', 'error')
    showMsg('Quantidade atualizada!')
    setEditId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    await supabase.from('sku_map').delete().eq('id', id)
    showMsg('Removido!')
    loadData()
  }

  async function handleCarregarPresets() {
    let count = 0
    for (const preset of SKU_PRESETS) {
      for (const comp of preset.composicao) {
        const { data: existing } = await supabase
          .from('sku_map')
          .select('id')
          .eq('sku_venda', preset.sku_venda)
          .eq('sku_base', comp.sku_base)
          .limit(1)
        if (!existing || existing.length === 0) {
          await supabase.from('sku_map').insert({
            sku_venda: preset.sku_venda,
            sku_base: comp.sku_base,
            quantidade: comp.quantidade,
          })
          count++
        }
      }
    }
    showMsg(`${count} mapeamentos carregados!`)
    loadData()
  }

  // Agrupar por SKU de venda
  const agrupados: SkuAgrupado[] = Object.values(
    maps.reduce((acc, m) => {
      if (!acc[m.sku_venda]) acc[m.sku_venda] = { sku_venda: m.sku_venda, composicao: [] }
      acc[m.sku_venda].composicao.push({ sku_base: m.sku_base, quantidade: m.quantidade })
      return acc
    }, {} as Record<string, SkuAgrupado>)
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Composição de SKUs
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {agrupados.length} SKUs de venda · {maps.length} mapeamentos
          </p>
        </div>
        <div className="flex gap-2">
          {maps.length === 0 && (
            <button onClick={handleCarregarPresets} className="btn-secondary">
              <GitBranch className="w-4 h-4" />
              Carregar Padrão
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Novo Mapeamento
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{
          background: msgType === 'success' ? 'rgba(0,214,143,0.1)' : 'rgba(255,61,113,0.1)',
          color: msgType === 'success' ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${msgType === 'success' ? 'rgba(0,214,143,0.2)' : 'rgba(255,61,113,0.2)'}`,
        }}>
          {msgType === 'error' && <AlertCircle className="w-4 h-4" />}
          {msg}
        </div>
      )}

      {/* Explicação */}
      <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(0,149,255,0.08)', border: '1px solid rgba(0,149,255,0.2)', color: 'var(--info)' }}>
        <strong>Como funciona:</strong> Cada SKU de venda (usado nos anúncios da Shopee) é mapeado para um ou mais SKUs base do estoque.
        Quando uma venda é registrada, o sistema consulta este mapa e abate automaticamente o estoque correto.
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : agrupados.length === 0 ? (
        <div className="text-center py-16">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum mapeamento cadastrado</p>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Clique em "Carregar Padrão" para carregar os SKUs do negócio</p>
          <button onClick={handleCarregarPresets} className="btn-primary">
            <GitBranch className="w-4 h-4" /> Carregar Padrão
          </button>
        </div>
      ) : (
        <div className="table-container">
          <div className="grid table-header" style={{ gridTemplateColumns: '180px 1fr 120px' }}>
            <span>SKU Venda</span>
            <span>Composição (SKUs Base)</span>
            <span className="text-right">Ações</span>
          </div>

          {agrupados.map((grupo) => {
            // Buscar os ids originais para edição/exclusão
            const rows = maps.filter(m => m.sku_venda === grupo.sku_venda)
            return (
              <div key={grupo.sku_venda} className="table-row">
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 120px', alignItems: 'start' }}>
                  {/* SKU Venda */}
                  <div className="flex items-center">
                    <span className="font-mono font-bold text-sm px-2 py-1 rounded"
                      style={{ background: 'rgba(238,44,0,0.12)', color: 'var(--shopee-primary)' }}>
                      {grupo.sku_venda}
                    </span>
                  </div>

                  {/* Composição */}
                  <div className="flex flex-wrap gap-2">
                    {rows.map((row) => (
                      <div key={row.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {row.sku_base}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×</span>
                        {editId === row.id ? (
                          <input
                            type="number"
                            value={editQtd}
                            onChange={e => setEditQtd(+e.target.value)}
                            className="input-field text-xs"
                            style={{ width: '56px', padding: '2px 6px' }}
                            min={1}
                          />
                        ) : (
                          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                            {row.quantidade}
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-1">
                          {editId === row.id ? (
                            <button onClick={() => handleEdit(row.id)}
                              className="p-0.5 rounded" style={{ color: 'var(--success)' }}>
                              <Check className="w-3 h-3" />
                            </button>
                          ) : (
                            <button onClick={() => { setEditId(row.id); setEditQtd(row.quantidade) }}
                              className="p-0.5 rounded opacity-60 hover:opacity-100" style={{ color: 'var(--text-secondary)' }}>
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(row.id)}
                            className="p-0.5 rounded opacity-60 hover:opacity-100" style={{ color: 'var(--danger)' }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ações */}
                  <div className="text-right">
                    <button
                      onClick={() => {
                        setNewSku({ sku_venda: grupo.sku_venda, sku_base: SKU_BASE_OPCOES[0], quantidade: 1 })
                        setShowAdd(true)
                      }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--info)', background: 'rgba(0,149,255,0.1)' }}>
                      + SKU Base
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Adicionar */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Novo Mapeamento</h2>
              <button onClick={() => setShowAdd(false)}>
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  SKU de Venda (Shopee)
                </label>
                <input
                  type="text"
                  value={newSku.sku_venda}
                  onChange={e => setNewSku({ ...newSku, sku_venda: e.target.value.toUpperCase() })}
                  className="input-field"
                  placeholder="Ex: FM100, KIT120B"
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  SKU Base (Estoque)
                </label>
                <select
                  value={newSku.sku_base}
                  onChange={e => setNewSku({ ...newSku, sku_base: e.target.value })}
                  className="input-field">
                  {SKU_BASE_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Quantidade Consumida
                </label>
                <input
                  type="number"
                  value={newSku.quantidade}
                  onChange={e => setNewSku({ ...newSku, quantidade: +e.target.value })}
                  className="input-field"
                  min={1}
                />
              </div>

              <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                Exemplo: FM100 → FORMA × 2 significa que cada venda de FM100 consome 2 unidades de FORMA do estoque.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAdd} className="btn-primary flex-1">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
