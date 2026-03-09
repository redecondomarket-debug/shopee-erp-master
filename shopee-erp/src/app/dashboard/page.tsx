'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { DollarSign, ShoppingCart, Package, TrendingUp, AlertTriangle, Store, Target } from 'lucide-react'

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']
const LOJA_COLORS = ['#EE2C00', '#FF6535', '#FF9970']

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
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
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [vendas, setVendas] = useState<{ data: string; valor_venda: number; loja: string }[]>([])
  const [estoque, setEstoque] = useState<{ sku_base: string; produto: string; estoque_atual: number; estoque_minimo: number }[]>([])
  const [financeiro, setFinanceiro] = useState<{ valor_liquido: number; comissao_shopee: number; loja: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [vendasRes, estoqueRes, financeiroRes] = await Promise.all([
        supabase.from('vendas').select('data, valor_venda, loja').order('data', { ascending: false }).limit(200),
        supabase.from('estoque').select('sku_base, produto, estoque_atual, estoque_minimo'),
        supabase.from('financeiro').select('valor_liquido, comissao_shopee, loja'),
      ])
      setVendas(vendasRes.data || [])
      setEstoque(estoqueRes.data || [])
      setFinanceiro(financeiroRes.data || [])
      setLoading(false)
    }
    loadData()
  }, [])

  const totalFaturamento = vendas.reduce((s, v) => s + (v.valor_venda || 0), 0)
  const totalLiquido = financeiro.reduce((s, f) => s + (f.valor_liquido || 0), 0)
  const totalPedidos = vendas.length
  const alertasEstoque = estoque.filter(e => e.estoque_atual <= e.estoque_minimo)

  const faturamentoPorLoja = LOJAS.map(loja => ({
    loja: loja.split(' ')[0],
    total: vendas.filter(v => v.loja === loja).reduce((s, v) => s + v.valor_venda, 0)
  }))

  // Chart data - last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const total = vendas.filter(v => v.data?.startsWith(dateStr)).reduce((s, v) => s + v.valor_venda, 0)
    return { label, total }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
               style={{ borderColor: 'var(--shopee-primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Visão geral de todas as lojas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Faturamento Total" value={formatCurrency(totalFaturamento)}
          icon={DollarSign} color="#EE2C00" subtitle="Todas as lojas" />
        <StatCard title="Lucro Líquido" value={formatCurrency(totalLiquido)}
          icon={TrendingUp} color="#00d68f" subtitle="Após taxas Shopee" />
        <StatCard title="Total de Pedidos" value={totalPedidos.toString()}
          icon={ShoppingCart} color="#0095ff" subtitle="Registrados no sistema" />
        <StatCard title="Alertas de Estoque" value={alertasEstoque.length.toString()}
          icon={AlertTriangle} color="#ffaa00" subtitle="Produtos abaixo do mínimo" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Faturamento — Últimos 7 dias</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EE2C00" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EE2C00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" stroke="#555570" tick={{ fontSize: 11 }} />
              <YAxis stroke="#555570" tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(val: number) => [formatCurrency(val), 'Faturamento']}
              />
              <Area type="monotone" dataKey="total" stroke="#EE2C00" strokeWidth={2}
                    fill="url(#colorTotal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Faturamento por loja */}
        <div className="card">
          <h2 className="font-semibold text-sm mb-4">Faturamento por Loja</h2>
          <div className="space-y-3">
            {faturamentoPorLoja.map((l, i) => {
              const pct = totalFaturamento > 0 ? (l.total / totalFaturamento) * 100 : 0
              return (
                <div key={l.loja}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{l.loja}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--bg-hover)' }}>
                    <div className="h-2 rounded-full transition-all"
                         style={{ width: `${pct}%`, background: LOJA_COLORS[i] }} />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {formatCurrency(l.total)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Stock alerts and recent sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock alerts */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            <h2 className="font-semibold text-sm">Alertas de Estoque Baixo</h2>
          </div>
          {alertasEstoque.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Estoque OK! Nenhum alerta.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertasEstoque.map(item => (
                <div key={item.sku_base} className="flex items-center justify-between p-3 rounded-lg"
                     style={{ background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.1)' }}>
                  <div>
                    <p className="text-sm font-medium">{item.produto}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>SKU: {item.sku_base}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge-warning">{item.estoque_atual} un</span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Mín: {item.estoque_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lojas status */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-4 h-4" style={{ color: 'var(--shopee-primary)' }} />
            <h2 className="font-semibold text-sm">Status das Lojas</h2>
          </div>
          <div className="space-y-3">
            {LOJAS.map((loja, i) => {
              const lojaVendas = vendas.filter(v => v.loja === loja)
              const lojaTotal = lojaVendas.reduce((s, v) => s + v.valor_venda, 0)
              return (
                <div key={loja} className="p-3 rounded-lg flex items-center justify-between"
                     style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: LOJA_COLORS[i] }} />
                    <div>
                      <p className="text-sm font-medium">{loja}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lojaVendas.length} pedidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(lojaTotal)}</p>
                    <span className="badge-success">Ativa</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
