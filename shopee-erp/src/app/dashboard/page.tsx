'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, ShoppingCart, Package, TrendingUp, AlertTriangle, Store, X, Target } from 'lucide-react'

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']
const LOJA_COLORS = ['#EE2C00', '#FF6535', '#FF9970']

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: string; icon: React.ElementType; color: string; subtitle?: string
}) {
  return (
    <div className="stat-card">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5"
        style={{ background: color, transform: 'translate(30%, -30%)' }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{value}</p>
          {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [vendas, setVendas] = useState<{ data: string; valor_venda: number; loja: string; sku_venda: string; quantidade: number }[]>([])
  const [estoque, setEstoque] = useState<{ sku_base: string; produto: string; estoque_atual: number; estoque_minimo: number }[]>([])
  const [financeiro, setFinanceiro] = useState<{ valor_liquido: number; valor_bruto: number; comissao_shopee: number; taxas_shopee: number; desconto: number; frete: number; loja: string; data: string }[]>([])
  const [ads, setAds] = useState<{ investimento: number; vendas_geradas: number; loja: string; data: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [vendasRes, estoqueRes, financeiroRes, adsRes] = await Promise.all([
      supabase.from('vendas').select('data, valor_venda, loja, sku_venda, quantidade').order('data', { ascending: false }).limit(2000),
      supabase.from('estoque').select('sku_base, produto, estoque_atual, estoque_minimo'),
      supabase.from('financeiro').select('valor_liquido, valor_bruto, comissao_shopee, taxas_shopee, desconto, frete, loja, data'),
      supabase.from('ads').select('investimento, vendas_geradas, loja, data'),
    ])
    setVendas(vendasRes.data || [])
    setEstoque(estoqueRes.data || [])
    setFinanceiro(financeiroRes.data || [])
    setAds(adsRes.data || [])
    setLoading(false)
  }

  const limparFiltros = () => { setLojaFilter(''); setDateFrom(''); setDateTo('') }
  const temFiltro = lojaFilter || dateFrom || dateTo

  const vendasFiltradas = vendas.filter(v => {
    if (lojaFilter && v.loja !== lojaFilter) return false
    if (dateFrom && v.data < dateFrom) return false
    if (dateTo && v.data > dateTo) return false
    return true
  })
  const financeiroFiltrado = financeiro.filter(f => {
    if (lojaFilter && f.loja !== lojaFilter) return false
    if (dateFrom && f.data < dateFrom) return false
    if (dateTo && f.data > dateTo) return false
    return true
  })
  const adsFiltrados = ads.filter(a => {
    if (lojaFilter && a.loja !== lojaFilter) return false
    if (dateFrom && a.data < dateFrom) return false
    if (dateTo && a.data > dateTo) return false
    return true
  })

  const totalBruto = financeiroFiltrado.reduce((s, f) => s + (f.valor_bruto || 0), 0)
  const totalTaxas = financeiroFiltrado.reduce((s, f) => s + (f.comissao_shopee || 0) + (f.taxas_shopee || 0), 0)
  const totalDescontos = financeiroFiltrado.reduce((s, f) => s + (f.desconto || 0), 0)
  const totalLiquido = financeiroFiltrado.reduce((s, f) => s + (f.valor_liquido || 0), 0)
  const totalAds = adsFiltrados.reduce((s, a) => s + (a.investimento || 0), 0)
  const lucroLiquido = totalLiquido - totalAds
  const totalPedidos = vendasFiltradas.length
  const ticketMedio = totalPedidos > 0 ? totalBruto / totalPedidos : 0
  const roasGeral = totalAds > 0 ? totalLiquido / totalAds : 0
  const margemLiquida = totalBruto > 0 ? (lucroLiquido / totalBruto) * 100 : 0
  const alertasEstoque = estoque.filter(e => e.estoque_atual <= e.estoque_minimo)

  const faturamentoPorLoja = LOJAS.map(loja => ({
    loja: loja.split(' ')[0],
    total: financeiroFiltrado.filter(f => f.loja === loja).reduce((s, f) => s + (f.valor_bruto || 0), 0),
    liquido: financeiroFiltrado.filter(f => f.loja === loja).reduce((s, f) => s + (f.valor_liquido || 0), 0),
  }))

  const porSku = vendasFiltradas.reduce((acc, v) => {
    if (!acc[v.sku_venda]) acc[v.sku_venda] = { sku: v.sku_venda, qtd: 0, valor: 0 }
    acc[v.sku_venda].qtd += v.quantidade || 1
    acc[v.sku_venda].valor += v.valor_venda || 0
    return acc
  }, {} as Record<string, { sku: string; qtd: number; valor: number }>)
  const topProdutos = Object.values(porSku).sort((a, b) => b.valor - a.valor).slice(0, 5)

  const chartData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    const dateStr = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const bruto = financeiroFiltrado.filter(f => f.data?.startsWith(dateStr)).reduce((s, f) => s + (f.valor_bruto || 0), 0)
    const liquido = financeiroFiltrado.filter(f => f.data?.startsWith(dateStr)).reduce((s, f) => s + (f.valor_liquido || 0), 0)
    return { label, bruto, liquido }
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto"
        style={{ borderColor: 'var(--shopee-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {lojaFilter || 'Todas as lojas'}{(dateFrom || dateTo) && ` · ${dateFrom || '...'} até ${dateTo || '...'}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-48">
            <option value="">Todas as lojas</option>
            {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-36" />
          <span style={{ color: 'var(--text-muted)' }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-36" />
          {temFiltro && <button onClick={limparFiltros} className="btn-secondary"><X className="w-4 h-4" /> Limpar</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Faturamento Bruto" value={formatCurrency(totalBruto)} icon={DollarSign} color="#EE2C00" subtitle={`Taxas Shopee: ${formatCurrency(totalTaxas)}`} />
        <StatCard title="Receita Líquida" value={formatCurrency(totalLiquido)} icon={TrendingUp} color="#00d68f" subtitle={`Descontos: ${formatCurrency(totalDescontos)}`} />
        <StatCard title="Lucro Líquido Real" value={formatCurrency(lucroLiquido)} icon={Target} color="#0095ff" subtitle={`Após Ads: -${formatCurrency(totalAds)}`} />
        <StatCard title="Margem Líquida" value={`${margemLiquida.toFixed(1)}%`} icon={TrendingUp} color="#ffaa00" subtitle="Lucro / Faturamento bruto" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Pedidos" value={totalPedidos.toString()} icon={ShoppingCart} color="#EE2C00" subtitle={`Ticket médio: ${formatCurrency(ticketMedio)}`} />
        <StatCard title="Gasto com Ads" value={formatCurrency(totalAds)} icon={Store} color="#ff3d71" subtitle="Total investido" />
        <StatCard title="ROAS Geral" value={`${roasGeral.toFixed(2)}x`} icon={TrendingUp} color="#ffaa00" subtitle="Líquido / Ads" />
        <StatCard title="Alertas Estoque" value={alertasEstoque.length.toString()} icon={AlertTriangle} color="#ff3d71" subtitle="Abaixo do mínimo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-sm mb-4">Faturamento Bruto vs Líquido — Últimos 14 dias</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gBruto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EE2C00" stopOpacity={0.3} /><stop offset="95%" stopColor="#EE2C00" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLiquido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d68f" stopOpacity={0.3} /><stop offset="95%" stopColor="#00d68f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" stroke="#555570" tick={{ fontSize: 11 }} />
              <YAxis stroke="#555570" tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
              <Tooltip contentStyle={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(val: number, name: string) => [formatCurrency(val), name === 'bruto' ? 'Bruto' : 'Líquido']} />
              <Area type="monotone" dataKey="bruto" stroke="#EE2C00" strokeWidth={2} fill="url(#gBruto)" />
              <Area type="monotone" dataKey="liquido" stroke="#00d68f" strokeWidth={2} fill="url(#gLiquido)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2 className="font-semibold text-sm mb-4">Faturamento por Loja</h2>
          <div className="space-y-4">
            {faturamentoPorLoja.map((l, i) => {
              const pct = totalBruto > 0 ? (l.total / totalBruto) * 100 : 0
              return (
                <div key={l.loja}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{l.loja}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--bg-hover)' }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: LOJA_COLORS[i] }} />
                  </div>
                  <div className="flex justify-between text-xs mt-0.5">
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(l.total)}</span>
                    <span style={{ color: 'var(--success)' }}>líq: {formatCurrency(l.liquido)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            <h2 className="font-semibold text-sm">Alertas de Estoque Baixo</h2>
          </div>
          {alertasEstoque.length === 0 ? (
            <div className="text-center py-8"><Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Estoque OK!</p></div>
          ) : alertasEstoque.map(item => (
            <div key={item.sku_base} className="flex items-center justify-between p-3 rounded-lg mb-2"
              style={{ background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.1)' }}>
              <div><p className="text-sm font-medium">{item.produto}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>SKU: {item.sku_base}</p></div>
              <div className="text-right"><span className="badge-warning">{item.estoque_atual} un</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Mín: {item.estoque_minimo}</p></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--shopee-primary)' }} />
            <h2 className="font-semibold text-sm">Top Produtos</h2>
          </div>
          {topProdutos.length === 0 ? (
            <div className="text-center py-8"><Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sem dados</p></div>
          ) : topProdutos.map((p, i) => (
            <div key={p.sku} className="flex items-center justify-between p-3 rounded-lg mb-2"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: i === 0 ? '#EE2C00' : 'var(--border)', color: i === 0 ? 'white' : 'var(--text-muted)' }}>{i + 1}</span>
                <div><p className="text-sm font-mono font-bold" style={{ color: 'var(--shopee-primary)' }}>{p.sku}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.qtd} un</p></div>
              </div>
              <p className="text-sm font-semibold">{formatCurrency(p.valor)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
