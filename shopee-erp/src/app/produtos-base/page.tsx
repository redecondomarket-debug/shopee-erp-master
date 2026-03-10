'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

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

const FORM_VAZIO = {
  sku_base: '', produto: '', categoria: '', unidade: 'Unidade',
  custo: '', custo_embalagem: '', estoque_minimo: 10,
}

export default function ProdutosBasePage() {
  const [produtos,   setProdutos]   = useState<any[]>([])
  const [estoque,    setEstoque]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: string } | null>(null)
  const [form,       setForm]       = useState({ ...FORM_VAZIO })
  const [editando,   setEditando]   = useState<number | null>(null)
  const [formEdit,   setFormEdit]   = useState<any>({})

  const showToast = (msg: string, type = 'ok') => setToast({ msg, type })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('estoque').select('*').order('sku_base')
    setProdutos(data || [])
    setLoading(false)
  }

  // ── ADICIONAR (idêntico ao TabProdutos do App.js) ──────────────────────────
  async function add() {
    if (!form.sku_base || !form.produto || !form.custo) {
      showToast('SKU, nome e custo são obrigatórios', 'err'); return
    }
    if (produtos.find(p => p.sku_base === form.sku_base.toUpperCase())) {
      showToast('SKU já cadastrado', 'err'); return
    }
    setSaving(true)
    const { error } = await supabase.from('estoque').insert({
      sku_base:        form.sku_base.toUpperCase(),
      produto:         form.produto,
      categoria:       form.categoria || 'Outro',
      unidade:         form.unidade,
      custo:           +form.custo,
      custo_embalagem: +form.custo_embalagem || 0,
      estoque_minimo:  +form.estoque_minimo || 10,
      estoque_atual:   0,
    })
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Produto cadastrado!')
    setForm({ ...FORM_VAZIO })
    loadData()
  }

  // ── EDITAR ─────────────────────────────────────────────────────────────────
  function iniciarEdicao(p: any) {
    setEditando(p.id)
    setFormEdit({ ...p })
  }
  async function salvarEdicao(id: number) {
    setSaving(true)
    const { error } = await supabase.from('estoque').update({
      produto:         formEdit.produto,
      categoria:       formEdit.categoria,
      unidade:         formEdit.unidade,
      custo:           +formEdit.custo || 0,
      custo_embalagem: +formEdit.custo_embalagem || 0,
      estoque_minimo:  +formEdit.estoque_minimo || 0,
    }).eq('id', id)
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Produto atualizado!')
    setEditando(null)
    loadData()
  }

  // ── DELETAR ────────────────────────────────────────────────────────────────
  async function del(id: number, sku: string) {
    if (!window.confirm(`Remover ${sku}?\n\nIsso não apaga movimentações históricas.`)) return
    await supabase.from('estoque').delete().eq('id', id)
    setProdutos(prev => prev.filter(p => p.id !== id))
    showToast('Produto removido!')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ff660033', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🗂️ Produtos Base — Cadastro do Estoque Físico</h2>

      {/* CARDS VISUAIS POR PRODUTO (igual ao TabProdutos do App.js) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {produtos.map(p => {
          const cor = (p.estoque_atual || 0) <= 0 ? '#ef4444' : (p.estoque_atual || 0) < (p.estoque_minimo || 0) ? '#f59e0b' : '#22c55e'
          const pct = (p.estoque_minimo || 0) > 0
            ? Math.min((p.estoque_atual || 0) / ((p.estoque_minimo || 0) * 2), 1)
            : (p.estoque_atual || 0) > 0 ? 1 : 0
          const valorTotal = (p.estoque_atual || 0) * (p.custo || 0)
          return (
            <div key={p.id} style={{ ...S.card, flex: '1 1 200px', minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#ff6600', fontWeight: 700 }}>{p.sku_base}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{p.produto}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{p.categoria} · {p.unidade}</div>
                </div>
                {(p.estoque_atual || 0) <= 0
                  ? <Badge color="#ef4444">SEM ESTQ</Badge>
                  : (p.estoque_atual || 0) < (p.estoque_minimo || 0)
                    ? <Badge color="#f59e0b">BAIXO</Badge>
                    : <Badge color="#22c55e">OK</Badge>
                }
              </div>

              <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 800, color: cor }}>{N(p.estoque_atual || 0)}</div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>
                Mín: {N(p.estoque_minimo || 0)} · Custo: {R(p.custo || 0)}/un · Emb: {R(p.custo_embalagem || 0)}
              </div>
              <div style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'monospace', marginBottom: 6 }}>
                Valor em estoque: {R(valorTotal)}
              </div>
              <div style={{ height: 4, background: '#1e1e2a', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: cor, borderRadius: 2, transition: 'width .4s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* FORM CADASTRAR NOVO */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 600 }}>+ NOVO PRODUTO FÍSICO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
          {([
            ['SKU Base',         'text',   'sku_base',        'Ex: ROLO_SAQ'],
            ['Nome do Produto',  'text',   'produto',         'Ex: Rolo Saquinho'],
            ['Categoria',        'text',   'categoria',       'Ex: Pet'],
            ['Unidade',          'text',   'unidade',         'Rolo / Pacote / Unidade'],
            ['Custo (R$/un)',    'number', 'custo',           '0.00'],
            ['Custo Emb (R$)',   'number', 'custo_embalagem', '0.00'],
            ['Estoque Mínimo',   'number', 'estoque_minimo',  '10'],
          ] as [string, string, string, string][]).map(([lbl, type, field, ph]) => (
            <div key={field}>
              <label style={S.label}>{lbl}</label>
              <input
                type={type}
                value={(form as any)[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={ph}
                style={S.inp as any}
                step={type === 'number' ? '0.01' : undefined}
              />
            </div>
          ))}
        </div>
        <button style={{ ...S.btn, marginTop: 12 } as any} onClick={add} disabled={saving}>
          {saving ? '⏳ Salvando...' : '+ Cadastrar Produto'}
        </button>
      </div>

      {/* TABELA DE PRODUTOS */}
      <div style={S.card}>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .8 }}>
          📋 Produtos Cadastrados — {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['SKU Base', 'Nome', 'Categoria', 'Unidade', 'Custo/un', 'Custo Emb', 'Estq Mín', 'Estq Atual', 'Valor Estoque', ''].map(h => (
                  <th key={h} style={S.th as any}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                  {editando === p.id ? (
                    // LINHA DE EDIÇÃO
                    <>
                      <td style={S.td as any}>
                        <span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 700, fontSize: 11 }}>{p.sku_base}</span>
                      </td>
                      <td style={S.td as any}>
                        <input value={formEdit.produto} onChange={e => setFormEdit((f: any) => ({ ...f, produto: e.target.value }))}
                          style={{ ...S.inp, width: 160, padding: '4px 8px', fontSize: 12 } as any} />
                      </td>
                      <td style={S.td as any}>
                        <input value={formEdit.categoria} onChange={e => setFormEdit((f: any) => ({ ...f, categoria: e.target.value }))}
                          style={{ ...S.inp, width: 90, padding: '4px 8px', fontSize: 12 } as any} />
                      </td>
                      <td style={S.td as any}>
                        <input value={formEdit.unidade} onChange={e => setFormEdit((f: any) => ({ ...f, unidade: e.target.value }))}
                          style={{ ...S.inp, width: 80, padding: '4px 8px', fontSize: 12 } as any} />
                      </td>
                      <td style={S.td as any}>
                        <input type="number" value={formEdit.custo} onChange={e => setFormEdit((f: any) => ({ ...f, custo: e.target.value }))}
                          style={{ ...S.inp, width: 80, padding: '4px 8px', fontSize: 12 } as any} step="0.01" />
                      </td>
                      <td style={S.td as any}>
                        <input type="number" value={formEdit.custo_embalagem} onChange={e => setFormEdit((f: any) => ({ ...f, custo_embalagem: e.target.value }))}
                          style={{ ...S.inp, width: 80, padding: '4px 8px', fontSize: 12 } as any} step="0.01" />
                      </td>
                      <td style={S.td as any}>
                        <input type="number" value={formEdit.estoque_minimo} onChange={e => setFormEdit((f: any) => ({ ...f, estoque_minimo: e.target.value }))}
                          style={{ ...S.inp, width: 70, padding: '4px 8px', fontSize: 12 } as any} />
                      </td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace', color: (p.estoque_atual || 0) <= 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                        {N(p.estoque_atual || 0)}
                      </td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace', color: '#a78bfa' }}>
                        {R((p.estoque_atual || 0) * (+formEdit.custo || 0))}
                      </td>
                      <td style={S.td as any}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => salvarEdicao(p.id)} style={{ ...S.btn, padding: '4px 10px', fontSize: 11 } as any} disabled={saving}>✓</button>
                          <button onClick={() => setEditando(null)} style={S.btnSm as any}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // LINHA NORMAL
                    <>
                      <td style={S.td as any}>
                        <span style={{ fontFamily: 'monospace', color: '#ff6600', fontWeight: 700, fontSize: 11 }}>{p.sku_base}</span>
                      </td>
                      <td style={S.td as any}><span style={{ fontWeight: 600 }}>{p.produto}</span></td>
                      <td style={S.td as any}><Badge color="#6b7280">{p.categoria || '—'}</Badge></td>
                      <td style={S.td as any}>{p.unidade || '—'}</td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace' }}>{R(p.custo || 0)}</td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace' }}>{R(p.custo_embalagem || 0)}</td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace' }}>{N(p.estoque_minimo || 0)}</td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace', fontWeight: 700, color: (p.estoque_atual || 0) <= 0 ? '#ef4444' : (p.estoque_atual || 0) < (p.estoque_minimo || 0) ? '#f59e0b' : '#22c55e' }}>
                        {N(p.estoque_atual || 0)}
                      </td>
                      <td style={{ ...S.td as any, fontFamily: 'monospace', color: '#a78bfa' }}>
                        {R((p.estoque_atual || 0) * (p.custo || 0))}
                      </td>
                      <td style={S.td as any}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => iniciarEdicao(p)} style={S.btnSm as any}>✏️</button>
                          <button onClick={() => del(p.id, p.sku_base)} style={S.btnDanger as any}>✕</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ ...S.td as any, textAlign: 'center', padding: 48, color: '#555' }}>
                    Nenhum produto cadastrado. Adicione o primeiro produto acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
