'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { Megaphone, Plus, X, Download, FileText, Target } from 'lucide-react'

type Ad = {
  id: string
  data: string
  loja: string
  produto: string
  investimento: number
  vendas_geradas: number
  roas: number
}

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

export default function AdsPage() {
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newAd, setNewAd] = useState({
    data: new Date().toISOString().split('T')[0],
    loja: LOJAS[0], produto: '', investimento: 0, vendas_geradas: 0,
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

  const totalInvestimento = ads.reduce((s, a) => s + (a.investimento || 0), 0)
  const totalVendas = ads.reduce((s, a) => s + (a.vendas_geradas || 0), 0)
  const roasGeral = totalInvestimento > 0 ? totalVendas / totalInvestimento : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Shopee Ads</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Gestão de anúncios e ROAS</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(ads.map(a => ({
            'Data': a.data, 'Loja': a.loja, 'Produto': a.produto, 'Investimento': a.investimento,
            'Vendas Geradas': a.vendas_geradas, 'ROAS': a.roas.toFixed(2),
          })), 'ads')} className="btn-secondary"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => exportToPDF('Relatório de Ads', [
            { header: 'Data', dataKey: 'data' }, { header: 'Loja', dataKey: 'loja' },
            { header: 'Produto', dataKey: 'produto' }, { header: 'Investimento', dataKey: 'investimento' },
            { header: 'Vendas', dataKey: 'vendas_geradas' }, { header: 'ROAS', dataKey: 'roas' },
          ], ads, 'ads')} className="btn-secondary"><FileText className="w-4 h-4" /> PDF</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Novo Anúncio</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'Total Investido', value: formatCurrency(totalInvestimento), color: '#ff3d71' },
          { title: 'Vendas Geradas', value: formatCurrency(totalVendas), color: '#00d68f' },
          { title: 'ROAS Geral', value: `${roasGeral.toFixed(2)}x`, color: '#0095ff' },
        ].map(s => (
          <div key={s.title} className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.title}</p>
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="grid grid-cols-6 table-header">
          <span>Data</span><span>Loja</span><span>Produto</span>
          <span className="text-right">Investimento</span><span className="text-right">Vendas</span><span className="text-center">ROAS</span>
        </div>
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : ads.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum anúncio registrado</p>
          </div>
        ) : (
          ads.map(ad => (
            <div key={ad.id} className="grid grid-cols-6 table-row items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ad.data}</span>
              <span className="text-sm">{ad.loja?.split(' ')[0]}</span>
              <span className="text-sm font-medium">{ad.produto}</span>
              <span className="text-right text-sm" style={{ color: 'var(--danger)' }}>{formatCurrency(ad.investimento)}</span>
              <span className="text-right text-sm" style={{ color: 'var(--success)' }}>{formatCurrency(ad.vendas_geradas)}</span>
              <div className="flex items-center justify-center gap-2">
                <span className={ad.roas >= 3 ? 'badge-success' : ad.roas >= 1.5 ? 'badge-warning' : 'badge-danger'}>
                  {ad.roas.toFixed(2)}x
                </span>
                <button onClick={() => handleDelete(ad.id)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Novo Registro de Ads</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Data</label>
                <input type="date" value={newAd.data} onChange={e => setNewAd({ ...newAd, data: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Loja</label>
                <select value={newAd.loja} onChange={e => setNewAd({ ...newAd, loja: e.target.value })} className="input-field">
                  {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Produto/Campanha</label>
                <input value={newAd.produto} onChange={e => setNewAd({ ...newAd, produto: e.target.value })} className="input-field" placeholder="Nome do produto ou campanha" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Investimento (R$)</label>
                  <input type="number" step="0.01" value={newAd.investimento} onChange={e => setNewAd({ ...newAd, investimento: +e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Vendas Geradas (R$)</label>
                  <input type="number" step="0.01" value={newAd.vendas_geradas} onChange={e => setNewAd({ ...newAd, vendas_geradas: +e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>ROAS calculado: </span>
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
    </div>
  )
}
