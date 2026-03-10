'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { DollarSign, TrendingUp, TrendingDown, Download, FileText, Search, X, Trash2, AlertTriangle } from 'lucide-react'

type FinanceiroItem = {
  id: string
  pedido: string
  data: string
  produto: string
  sku: string
  quantidade: number
  valor_bruto: number
  desconto: number
  frete: number
  comissao_shopee: number
  taxas_shopee: number
  valor_liquido: number
  loja: string
}

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function StatCard({ title, value, sub, color, icon: Icon }: { title: string; value: string; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

export default function FinanceiroPage() {
  const [items, setItems] = useState<FinanceiroItem[]>([])
  const [filtered, setFiltered] = useState<FinanceiroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showConfirmLimpar, setShowConfirmLimpar] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    let data = [...items]
    if (search) data = data.filter(v =>
      v.pedido?.includes(search) ||
      v.sku?.toLowerCase().includes(search.toLowerCase()) ||
      v.produto?.toLowerCase().includes(search.toLowerCase()))
    if (lojaFilter) data = data.filter(v => v.loja === lojaFilter)
    if (dateFrom) data = data.filter(v => v.data >= dateFrom)
    if (dateTo) data = data.filter(v => v.data <= dateTo)
    setFiltered(data)
  }, [items, search, lojaFilter, dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(1000)
    setItems(data || [])
    setLoading(false)
  }

  async function handleLimparPeriodo() {
    if (!dateFrom && !dateTo && !lojaFilter) {
      setMsg('⚠️ Selecione um período ou loja antes de limpar.')
      setTimeout(() => setMsg(''), 4000)
      setShowConfirmLimpar(false)
      return
    }
    setLimpando(true)
    let query = supabase.from('financeiro').delete()
    if (dateFrom) query = query.gte('data', dateFrom)
    if (dateTo) query = query.lte('data', dateTo)
    if (lojaFilter) query = query.eq('loja', lojaFilter)
    await query
    setShowConfirmLimpar(false)
    setLimpando(false)
    setMsg(`✅ Dados do período removidos com sucesso.`)
    setTimeout(() => setMsg(''), 4000)
    loadData()
  }

  const limparFiltros = () => { setSearch(''); setLojaFilter(''); setDateFrom(''); setDateTo('') }

  const totalBruto = filtered.reduce((s, i) => s + (i.valor_bruto || 0), 0)
  const totalLiquido = filtered.reduce((s, i) => s + (i.valor_liquido || 0), 0)
  const totalComissao = filtered.reduce((s, i) => s + (i.comissao_shopee || 0) + (i.taxas_shopee || 0), 0)
  const totalDesconto = filtered.reduce((s, i) => s + (i.desconto || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{filtered.length} registros</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowConfirmLimpar(true)}
            className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,113,0.3)' }}>
            <Trash2 className="w-4 h-4" /> Limpar Período
          </button>
          <button onClick={() => exportToExcel(filtered.map(i => ({
            'Pedido': i.pedido, 'Data': i.data, 'Loja': i.loja, 'Produto': i.produto, 'SKU': i.sku,
            'Qtd': i.quantidade, 'Valor Bruto': i.valor_bruto, 'Desconto': i.desconto, 'Frete': i.frete,
            'Comissão Shopee': i.comissao_shopee, 'Taxas Shopee': i.taxas_shopee, 'Valor Líquido': i.valor_liquido,
          })), 'financeiro', 'Financeiro')} className="btn-secondary">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => exportToPDF('Relatório Financeiro', [
            { header: 'Data', dataKey: 'data' }, { header: 'Loja', dataKey: 'loja' },
            { header: 'SKU', dataKey: 'sku' }, { header: 'Qtd', dataKey: 'quantidade' },
            { header: 'Bruto', dataKey: 'valor_bruto' }, { header: 'Comissão', dataKey: 'comissao_shopee' },
            { header: 'Líquido', dataKey: 'valor_liquido' },
          ], filtered, 'financeiro')} className="btn-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{
          background: msg.startsWith('⚠️') ? 'rgba(255,170,0,0.1)' : 'rgba(0,214,143,0.1)',
          color: msg.startsWith('⚠️') ? 'var(--warning)' : 'var(--success)',
          border: `1px solid ${msg.startsWith('⚠️') ? 'rgba(255,170,0,0.2)' : 'rgba(0,214,143,0.2)'}`,
        }}>{msg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Faturamento Bruto" value={formatCurrency(totalBruto)} icon={DollarSign} color="#EE2C00" />
        <StatCard title="Receita Líquida" value={formatCurrency(totalLiquido)} sub="Após taxas Shopee" icon={TrendingUp} color="#00d68f" />
        <StatCard title="Taxas & Comissões" value={formatCurrency(totalComissao)} sub="Shopee fees" icon={TrendingDown} color="#ff3d71" />
        <StatCard title="Descontos" value={formatCurrency(totalDesconto)} icon={DollarSign} color="#ffaa00" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 w-48" placeholder="Pedido, SKU..." />
        </div>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-40" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-40" />
        {(search || lojaFilter || dateFrom || dateTo) && (
          <button onClick={limparFiltros} className="btn-secondary">
            <X className="w-4 h-4" /> Limpar Filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container overflow-x-auto">
        <div style={{ minWidth: '900px' }}>
          <div className="grid table-header" style={{ gridTemplateColumns: '100px 120px 1fr 60px 90px 90px 90px 90px 100px' }}>
            <span>Data</span><span>Loja</span><span>Produto/SKU</span><span>Qtd</span>
            <span className="text-right">Bruto</span><span className="text-right">Desconto</span>
            <span className="text-right">Comissão</span><span className="text-right">Frete</span>
            <span className="text-right">Líquido</span>
          </div>
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum registro financeiro</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Importe o relatório da Shopee em Vendas</p>
            </div>
          ) : filtered.map(item => (
            <div key={item.id} className="grid table-row items-center"
              style={{ gridTemplateColumns: '100px 120px 1fr 60px 90px 90px 90px 90px 100px' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.data}</span>
              <span className="text-sm">{item.loja?.split(' ')[0]}</span>
              <div>
                <p className="text-sm font-medium truncate">{item.produto || item.sku}</p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{item.sku}</p>
              </div>
              <span className="text-sm text-center">{item.quantidade}</span>
              <span className="text-right text-sm">{formatCurrency(item.valor_bruto)}</span>
              <span className="text-right text-sm" style={{ color: 'var(--warning)' }}>-{formatCurrency(item.desconto)}</span>
              <span className="text-right text-sm" style={{ color: 'var(--danger)' }}>-{formatCurrency(item.comissao_shopee)}</span>
              <span className="text-right text-sm">{formatCurrency(item.frete)}</span>
              <span className="text-right font-semibold text-sm" style={{ color: 'var(--success)' }}>{formatCurrency(item.valor_liquido)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal confirmar limpeza */}
      {showConfirmLimpar && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
              <h2 className="font-bold text-lg">Confirmar Limpeza</h2>
            </div>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Você está prestes a excluir os registros financeiros com os filtros aplicados:
            </p>
            <div className="p-3 rounded-lg mb-4 text-sm space-y-1" style={{ background: 'var(--bg-hover)' }}>
              {lojaFilter && <p>Loja: <strong>{lojaFilter}</strong></p>}
              {dateFrom && <p>De: <strong>{dateFrom}</strong></p>}
              {dateTo && <p>Até: <strong>{dateTo}</strong></p>}
              {!lojaFilter && !dateFrom && !dateTo && <p style={{ color: 'var(--danger)' }}>⚠️ Nenhum filtro — todos os registros serão apagados!</p>}
              <p style={{ color: 'var(--warning)' }}>Total a remover: <strong>{filtered.length} registros</strong></p>
            </div>
            <p className="text-xs mb-5" style={{ color: 'var(--danger)' }}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmLimpar(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleLimparPeriodo} disabled={limpando}
                className="btn-primary flex-1" style={{ background: 'var(--danger)' }}>
                {limpando ? 'Removendo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
