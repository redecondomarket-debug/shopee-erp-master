'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { DollarSign, TrendingUp, TrendingDown, Download, FileText, Search, X, Trash2, AlertTriangle, Settings } from 'lucide-react'

type FinanceiroItem = {
  id: string; pedido: string; data: string; produto: string; sku: string
  quantidade: number; valor_bruto: number; desconto: number; frete: number
  comissao_shopee: number; taxas_shopee: number; valor_liquido: number; loja: string
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
  // Configurações editáveis
  const [showConfig, setShowConfig] = useState(false)
  const [pctImposto, setPctImposto] = useState(0)
  const [custoEmbalagem, setCustoEmbalagem] = useState(0)

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    let data = [...items]
    if (search) data = data.filter(v => v.pedido?.includes(search) || v.sku?.toLowerCase().includes(search.toLowerCase()) || v.produto?.toLowerCase().includes(search.toLowerCase()))
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
    setLimpando(true)
    let query = supabase.from('financeiro').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    if (lojaFilter) query = (query as any).eq('loja', lojaFilter)
    await query
    setShowConfirmLimpar(false)
    setLimpando(false)
    setMsg(`✅ ${filtered.length} registros removidos.`)
    setTimeout(() => setMsg(''), 4000)
    loadData()
  }

  const limparFiltros = () => { setSearch(''); setLojaFilter(''); setDateFrom(''); setDateTo('') }
  const temFiltro = search || lojaFilter || dateFrom || dateTo

  // Cálculos com imposto e embalagem
  const totalBruto = filtered.reduce((s, i) => s + (i.valor_bruto || 0), 0)
  const totalLiquido = filtered.reduce((s, i) => s + (i.valor_liquido || 0), 0)
  const totalComissao = filtered.reduce((s, i) => s + (i.comissao_shopee || 0) + (i.taxas_shopee || 0), 0)
  const totalDesconto = filtered.reduce((s, i) => s + (i.desconto || 0), 0)
  const totalImposto = totalBruto * (pctImposto / 100)
  const totalEmbalagem = filtered.length * custoEmbalagem
  const lucroOperacional = totalLiquido - totalImposto - totalEmbalagem

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{filtered.length} registros</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowConfig(!showConfig)} className="btn-secondary">
            <Settings className="w-4 h-4" /> Configurar
          </button>
          <button onClick={() => setShowConfirmLimpar(true)} className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,113,0.3)' }}>
            <Trash2 className="w-4 h-4" /> Limpar Período
          </button>
          <button onClick={() => exportToExcel(filtered.map(i => ({
            'Pedido': i.pedido, 'Data': i.data, 'Loja': i.loja, 'Produto': i.produto, 'SKU': i.sku,
            'Qtd': i.quantidade, 'Valor Bruto': i.valor_bruto, 'Desconto': i.desconto, 'Frete': i.frete,
            'Comissão Shopee': i.comissao_shopee, 'Taxas Shopee': i.taxas_shopee, 'Valor Líquido': i.valor_liquido,
            'Imposto': (i.valor_bruto * pctImposto / 100).toFixed(2), 'Embalagem': custoEmbalagem,
            'Lucro Operacional': (i.valor_liquido - (i.valor_bruto * pctImposto / 100) - custoEmbalagem).toFixed(2),
          })), 'financeiro')} className="btn-secondary">
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

      {/* Config editável */}
      {showConfig && (
        <div className="card" style={{ border: '1px solid rgba(0,149,255,0.3)', background: 'rgba(0,149,255,0.05)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--info)' }}>⚙️ Configurações de Custo</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                Imposto (% sobre faturamento bruto)
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={100} step={0.1} value={pctImposto}
                  onChange={e => setPctImposto(+e.target.value)} className="input-field w-28" />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>% = {formatCurrency(totalImposto)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                Custo de Embalagem (R$ por pedido)
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} step={0.01} value={custoEmbalagem}
                  onChange={e => setCustoEmbalagem(+e.target.value)} className="input-field w-28" />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>= {formatCurrency(totalEmbalagem)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{
          background: 'rgba(0,214,143,0.1)', color: 'var(--success)', border: '1px solid rgba(0,214,143,0.2)'
        }}>{msg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Faturamento Bruto" value={formatCurrency(totalBruto)} icon={DollarSign} color="#EE2C00" sub={`Desconto: ${formatCurrency(totalDesconto)}`} />
        <StatCard title="Receita Líquida" value={formatCurrency(totalLiquido)} icon={TrendingUp} color="#00d68f" sub="Após taxas Shopee" />
        <StatCard title="Taxas & Comissões" value={formatCurrency(totalComissao)} icon={TrendingDown} color="#ff3d71" sub="Comissão + taxa serviço" />
        <StatCard title="Lucro Operacional" value={formatCurrency(lucroOperacional)} icon={TrendingUp} color="#0095ff"
          sub={`Imp: ${formatCurrency(totalImposto)} | Emb: ${formatCurrency(totalEmbalagem)}`} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 w-48" placeholder="Pedido, SKU..." />
        </div>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-40" />
        <span style={{ color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-40" />
        {temFiltro && (
          <button onClick={limparFiltros} className="btn-secondary"><X className="w-4 h-4" /> Limpar Filtros</button>
        )}
      </div>

      {/* Table */}
      <div className="table-container overflow-x-auto">
        <div style={{ minWidth: '1000px' }}>
          <div className="grid table-header" style={{ gridTemplateColumns: '100px 110px 1fr 50px 90px 90px 90px 80px 100px 100px' }}>
            <span>Data</span><span>Loja</span><span>Produto/SKU</span><span>Qtd</span>
            <span className="text-right">Bruto</span><span className="text-right">Desconto</span>
            <span className="text-right">Comissão</span><span className="text-right">Frete</span>
            <span className="text-right">Líquido</span><span className="text-right">Lucro Op.</span>
          </div>
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum registro financeiro</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Importe o relatório da Shopee em Vendas</p>
            </div>
          ) : filtered.map(item => {
            const imposto = item.valor_bruto * (pctImposto / 100)
            const lucroOp = item.valor_liquido - imposto - custoEmbalagem
            return (
              <div key={item.id} className="grid table-row items-center"
                style={{ gridTemplateColumns: '100px 110px 1fr 50px 90px 90px 90px 80px 100px 100px' }}>
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
                <span className="text-right font-semibold text-sm" style={{ color: lucroOp >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(lucroOp)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal limpeza */}
      {showConfirmLimpar && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
              <h2 className="font-bold text-lg">Confirmar Limpeza</h2>
            </div>
            <div className="p-3 rounded-lg mb-4 text-sm space-y-1" style={{ background: 'var(--bg-hover)' }}>
              {lojaFilter && <p>Loja: <strong>{lojaFilter}</strong></p>}
              {dateFrom && <p>De: <strong>{dateFrom}</strong></p>}
              {dateTo && <p>Até: <strong>{dateTo}</strong></p>}
              {!lojaFilter && !dateFrom && !dateTo && <p style={{ color: 'var(--danger)' }}>⚠️ Sem filtro — TODOS os registros serão apagados!</p>}
              <p style={{ color: 'var(--warning)' }}>Registros a remover: <strong>{filtered.length}</strong></p>
            </div>
            <p className="text-xs mb-5" style={{ color: 'var(--danger)' }}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmLimpar(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleLimparPeriodo} disabled={limpando} className="btn-primary flex-1" style={{ background: 'var(--danger)' }}>
                {limpando ? 'Removendo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
