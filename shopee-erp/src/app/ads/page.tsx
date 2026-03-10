'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel } from '@/lib/exports'
import { Megaphone, Plus, X, Download, FileText, Search, Trash2, AlertTriangle } from 'lucide-react'

type Ad = { id: string; data: string; loja: string; produto: string; investimento: number; vendas_geradas: number; roas: number }

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

export default function AdsPage() {
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showConfirmLimpar, setShowConfirmLimpar] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [msg, setMsg] = useState('')
  const [newAd, setNewAd] = useState({
    data: new Date().toISOString().split('T')[0], loja: LOJAS[0], produto: '', investimento: 0, vendas_geradas: 0,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('ads').select('*').order('data', { ascending: false })
    setAds((data || []).map(a => ({ ...a, roas: a.investimento > 0 ? a.vendas_geradas / a.investimento : 0 })))
    setLoading(false)
  }

  async function handleAdd() {
    const roas = newAd.investimento > 0 ? newAd.vendas_geradas / newAd.investimento : 0
    const { error } = await supabase.from('ads').insert({ ...newAd, roas })
    if (!error) { setShowAdd(false); loadData() }
  }

  async function handleDelete(id: string) {
    await supabase.from('ads').delete().eq('id', id)
    loadData()
  }

  async function handleLimpar() {
    setLimpando(true)
    let query = supabase.from('ads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (lojaFilter) query = (query as any).eq('loja', lojaFilter)
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    await query
    setShowConfirmLimpar(false)
    setLimpando(false)
    setMsg(`✅ Registros removidos.`)
    setTimeout(() => setMsg(''), 3500)
    loadData()
  }

  const limparFiltros = () => { setLojaFilter(''); setDateFrom(''); setDateTo(''); setSearch('') }
  const temFiltro = lojaFilter || dateFrom || dateTo || search

  const filtered = ads.filter(a => {
    if (lojaFilter && a.loja !== lojaFilter) return false
    if (dateFrom && a.data < dateFrom) return false
    if (dateTo && a.data > dateTo) return false
    if (search && !a.produto?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalInvestimento = filtered.reduce((s, a) => s + (a.investimento || 0), 0)
  const totalVendas = filtered.reduce((s, a) => s + (a.vendas_geradas || 0), 0)
  const roasGeral = totalInvestimento > 0 ? totalVendas / totalInvestimento : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Shopee Ads</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{filtered.length} registros</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowConfirmLimpar(true)} className="btn-secondary"
            style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,113,0.3)' }}>
            <Trash2 className="w-4 h-4" /> Limpar Período
          </button>
          <button onClick={() => exportToExcel(filtered.map(a => ({
            'Data': a.data, 'Loja': a.loja, 'Produto': a.produto,
            'Investimento': a.investimento, 'Vendas Geradas': a.vendas_geradas, 'ROAS': a.roas.toFixed(2),
          })), 'ads')} className="btn-secondary"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Novo Anúncio</button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,214,143,0.1)', color: 'var(--success)', border: '1px solid rgba(0,214,143,0.2)' }}>{msg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Investido</p>
          <p className="text-2xl font-bold" style={{ color: '#ff3d71', fontFamily: 'var(--font-display)' }}>{formatCurrency(totalInvestimento)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Vendas Geradas</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--success)', fontFamily: 'var(--font-display)' }}>{formatCurrency(totalVendas)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>ROAS Geral</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--info)', fontFamily: 'var(--font-display)' }}>{roasGeral.toFixed(2)}x</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 w-44" placeholder="Produto..." />
        </div>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-36" />
        <span style={{ color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-36" />
        {temFiltro && <button onClick={limparFiltros} className="btn-secondary"><X className="w-4 h-4" /> Limpar</button>}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="grid grid-cols-7 table-header">
          <span>Data</span><span>Loja</span><span>Produto</span>
          <span className="text-right">Investimento</span><span className="text-right">Vendas</span>
          <span className="text-center">ROAS</span><span className="text-center">Ação</span>
        </div>
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum anúncio registrado</p></div>
        ) : filtered.map(ad => (
          <div key={ad.id} className="grid grid-cols-7 table-row items-center">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ad.data}</span>
            <span className="text-sm">{ad.loja?.split(' ')[0]}</span>
            <span className="text-sm font-medium">{ad.produto}</span>
            <span className="text-right text-sm" style={{ color: 'var(--danger)' }}>{formatCurrency(ad.investimento)}</span>
            <span className="text-right text-sm" style={{ color: 'var(--success)' }}>{formatCurrency(ad.vendas_geradas)}</span>
            <div className="flex justify-center">
              <span className={ad.roas >= 3 ? 'badge-success' : ad.roas >= 1.5 ? 'badge-warning' : 'badge-danger'}>
                {ad.roas.toFixed(2)}x
              </span>
            </div>
            <div className="flex justify-center">
              <button onClick={() => handleDelete(ad.id)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Novo Registro de Ads</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Data</label>
                <input type="date" value={newAd.data} onChange={e => setNewAd({ ...newAd, data: e.target.value })} className="input-field" /></div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Loja</label>
                <select value={newAd.loja} onChange={e => setNewAd({ ...newAd, loja: e.target.value })} className="input-field">
                  {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
                </select></div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Produto/Campanha</label>
                <input value={newAd.produto} onChange={e => setNewAd({ ...newAd, produto: e.target.value })} className="input-field" placeholder="Nome da campanha" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Investimento (R$)</label>
                  <input type="number" step="0.01" value={newAd.investimento} onChange={e => setNewAd({ ...newAd, investimento: +e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Vendas Geradas (R$)</label>
                  <input type="number" step="0.01" value={newAd.vendas_geradas} onChange={e => setNewAd({ ...newAd, vendas_geradas: +e.target.value })} className="input-field" /></div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>ROAS: </span>
                <span className="font-bold" style={{ color: 'var(--shopee-primary)' }}>
                  {newAd.investimento > 0 ? (newAd.vendas_geradas / newAd.investimento).toFixed(2) : '0.00'}x
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAdd} className="btn-primary flex-1">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Limpar */}
      {showConfirmLimpar && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
              <h2 className="font-bold text-lg">Limpar Registros de Ads</h2>
            </div>
            <div className="p-3 rounded-lg mb-4 text-sm space-y-1" style={{ background: 'var(--bg-hover)' }}>
              {lojaFilter && <p>Loja: <strong>{lojaFilter}</strong></p>}
              {dateFrom && <p>De: <strong>{dateFrom}</strong></p>}
              {dateTo && <p>Até: <strong>{dateTo}</strong></p>}
              {!lojaFilter && !dateFrom && !dateTo && <p style={{ color: 'var(--danger)' }}>⚠️ Sem filtro — TODOS os registros serão apagados!</p>}
              <p style={{ color: 'var(--warning)' }}>Registros a remover: <strong>{filtered.length}</strong></p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmLimpar(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleLimpar} disabled={limpando} className="btn-primary flex-1" style={{ background: 'var(--danger)' }}>
                {limpando ? 'Removendo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
