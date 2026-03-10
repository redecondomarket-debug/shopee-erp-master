'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { ClipboardList, Download, FileText, RefreshCw, ShoppingBag } from 'lucide-react'

type ConsumoLoja = { total: number; kl: number; universo: number; mundo: number }

type OrdemItem = {
  sku_base: string
  produto: string
  estoque_atual: number
  estoque_minimo: number
  vendido_total: number
  media_diaria: number
  dias_estoque: number
  sugestao_compra: number
  loja_kl: number
  loja_universo: number
  loja_mundo: number
  pct_kl: number
  pct_universo: number
  pct_mundo: number
}

type Simulacao = {
  sku_base: string
  quantidade_compra: number
  custo_total: number
}

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

function formatNum(val: number) { return Math.ceil(val).toLocaleString('pt-BR') }
function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

export default function ComprasPage() {
  const [ordens, setOrdens] = useState<OrdemItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [periodoRapido, setPeriodoRapido] = useState('30')
  const [simulacoes, setSimulacoes] = useState<Record<string, Simulacao>>({})
  const [skuSelecionado, setSkuSelecionado] = useState<string | null>(null)

  useEffect(() => { loadData() }, [dateFrom, dateTo])

  function setPeriodoRapidoHandler(dias: string) {
    setPeriodoRapido(dias)
    if (dias !== 'custom') {
      const d = new Date()
      setDateTo(d.toISOString().split('T')[0])
      d.setDate(d.getDate() - parseInt(dias))
      setDateFrom(d.toISOString().split('T')[0])
    }
  }

  async function loadData() {
    setLoading(true)

    const [estoqueRes, vendasRes, skuMapRes] = await Promise.all([
      supabase.from('estoque').select('*'),
      supabase.from('vendas').select('sku_venda, quantidade, loja, data')
        .gte('data', dateFrom).lte('data', dateTo),
      supabase.from('sku_map').select('*'),
    ])

    const estoque = estoqueRes.data || []
    const vendas = vendasRes.data || []
    const skuMap = skuMapRes.data || []

    const dias = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000))

    const consumo: Record<string, ConsumoLoja> = {}
    for (const venda of vendas) {
      const maps = skuMap.filter(m => m.sku_venda === venda.sku_venda)
      for (const map of maps) {
        if (!consumo[map.sku_base]) consumo[map.sku_base] = { total: 0, kl: 0, universo: 0, mundo: 0 }
        const qty = map.quantidade * (venda.quantidade || 1)
        consumo[map.sku_base].total += qty
        if (venda.loja === 'KL Market') consumo[map.sku_base].kl += qty
        if (venda.loja === 'Universo dos Achados') consumo[map.sku_base].universo += qty
        if (venda.loja === 'Mundo dos Achados') consumo[map.sku_base].mundo += qty
      }
    }

    const result: OrdemItem[] = estoque.map(item => {
      const c = consumo[item.sku_base] || { total: 0, kl: 0, universo: 0, mundo: 0 }
      const mediaDiaria = c.total / dias
      const diasEstoque = mediaDiaria > 0 ? item.estoque_atual / mediaDiaria : 999
      const sugestao = Math.max(0, Math.ceil(mediaDiaria * 30) - item.estoque_atual + item.estoque_minimo)
      const pct_kl = c.total > 0 ? (c.kl / c.total) * 100 : 0
      const pct_universo = c.total > 0 ? (c.universo / c.total) * 100 : 0
      const pct_mundo = c.total > 0 ? (c.mundo / c.total) * 100 : 0

      return {
        sku_base: item.sku_base, produto: item.produto,
        estoque_atual: item.estoque_atual, estoque_minimo: item.estoque_minimo,
        vendido_total: c.total, media_diaria: mediaDiaria,
        dias_estoque: Math.round(diasEstoque), sugestao_compra: sugestao,
        loja_kl: c.kl, loja_universo: c.universo, loja_mundo: c.mundo,
        pct_kl, pct_universo, pct_mundo,
      }
    }).sort((a, b) => a.dias_estoque - b.dias_estoque)

    setOrdens(result)

    // Inicializar simulações
    const sims: Record<string, Simulacao> = {}
    result.forEach(item => {
      sims[item.sku_base] = simulacoes[item.sku_base] || {
        sku_base: item.sku_base, quantidade_compra: item.sugestao_compra, custo_total: 0
      }
    })
    setSimulacoes(sims)
    setLoading(false)
  }

  const urgente = ordens.filter(o => o.dias_estoque <= 7 && o.sugestao_compra > 0)
  const itemSelecionado = ordens.find(o => o.sku_base === skuSelecionado)
  const simSelecionada = skuSelecionado ? simulacoes[skuSelecionado] : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Ordem de Compra</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Rateio automático por loja · {dateFrom} até {dateTo}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={loadData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => exportToExcel(ordens.map(o => ({
            'SKU Base': o.sku_base, 'Produto': o.produto,
            'Estoque Atual': o.estoque_atual, 'Total Vendido': o.vendido_total,
            'KL Market': o.loja_kl, '% KL': o.pct_kl.toFixed(1) + '%',
            'Universo': o.loja_universo, '% Universo': o.pct_universo.toFixed(1) + '%',
            'Mundo': o.loja_mundo, '% Mundo': o.pct_mundo.toFixed(1) + '%',
            'Dias de Estoque': o.dias_estoque, 'Sugestão Compra': o.sugestao_compra,
          })), 'ordem-compra')} className="btn-secondary">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => exportToPDF('Ordem de Compra', [
            { header: 'SKU', dataKey: 'sku_base' }, { header: 'Produto', dataKey: 'produto' },
            { header: 'Estoque', dataKey: 'estoque_atual' }, { header: 'Vendido', dataKey: 'vendido_total' },
            { header: 'KL', dataKey: 'loja_kl' }, { header: 'Universo', dataKey: 'loja_universo' },
            { header: 'Mundo', dataKey: 'loja_mundo' }, { header: 'Dias', dataKey: 'dias_estoque' },
            { header: 'Sugestão', dataKey: 'sugestao_compra' },
          ], ordens, 'ordem-compra')} className="btn-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Filtros de período */}
      <div className="card">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Período Analisado</p>
        <div className="flex gap-2 flex-wrap items-center">
          {[
            { label: 'Semanal', value: '7' },
            { label: '15 dias', value: '15' },
            { label: 'Mensal', value: '30' },
            { label: '60 dias', value: '60' },
            { label: '90 dias', value: '90' },
            { label: 'Personalizado', value: 'custom' },
          ].map(op => (
            <button key={op.value}
              onClick={() => setPeriodoRapidoHandler(op.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: periodoRapido === op.value ? 'var(--shopee-primary)' : 'var(--bg-hover)',
                color: periodoRapido === op.value ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${periodoRapido === op.value ? 'var(--shopee-primary)' : 'var(--border)'}`,
              }}>
              {op.label}
            </button>
          ))}
          <div className="flex gap-2 items-center ml-2">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriodoRapido('custom') }}
              className="input-field w-36" />
            <span style={{ color: 'var(--text-muted)' }}>até</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriodoRapido('custom') }}
              className="input-field w-36" />
          </div>
        </div>
      </div>

      {/* Alerta urgente */}
      {urgente.length > 0 && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)' }}>
          <p className="font-semibold text-sm mb-2" style={{ color: 'var(--danger)' }}>
            ⚠️ {urgente.length} produto(s) com estoque crítico (menos de 7 dias)!
          </p>
          <div className="flex flex-wrap gap-2">
            {urgente.map(u => (
              <span key={u.sku_base} className="px-2 py-1 rounded text-xs font-mono"
                style={{ background: 'rgba(255,61,113,0.1)', color: 'var(--danger)' }}>
                {u.sku_base} ({u.dias_estoque}d)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabela principal */}
      <div className="table-container overflow-x-auto">
        <div style={{ minWidth: '900px' }}>
          <div className="grid table-header" style={{ gridTemplateColumns: '110px 1fr 70px 80px 100px 100px 100px 70px 90px 80px' }}>
            <span>SKU Base</span>
            <span>Produto</span>
            <span className="text-center">Estoque</span>
            <span className="text-center">Vendido</span>
            <span className="text-center">KL Market</span>
            <span className="text-center">Universo</span>
            <span className="text-center">Mundo</span>
            <span className="text-center">Dias</span>
            <span className="text-center">Sugestão</span>
            <span className="text-center">Status</span>
          </div>

          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Calculando...</div>
          ) : ordens.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum dado disponível</p>
            </div>
          ) : ordens.map(item => {
            const status = item.dias_estoque <= 7 ? 'CRÍTICO' : item.dias_estoque <= 15 ? 'ATENÇÃO' : 'OK'
            const statusClass = status === 'CRÍTICO' ? 'badge-danger' : status === 'ATENÇÃO' ? 'badge-warning' : 'badge-success'
            const isSelected = skuSelecionado === item.sku_base
            return (
              <div key={item.sku_base}
                className="grid table-row items-center cursor-pointer"
                style={{
                  gridTemplateColumns: '110px 1fr 70px 80px 100px 100px 100px 70px 90px 80px',
                  background: isSelected ? 'rgba(238,44,0,0.06)' : undefined,
                  borderLeft: isSelected ? '3px solid var(--shopee-primary)' : '3px solid transparent',
                }}
                onClick={() => setSkuSelecionado(isSelected ? null : item.sku_base)}>
                <span className="font-mono text-sm" style={{ color: 'var(--shopee-primary)' }}>{item.sku_base}</span>
                <span className="text-sm font-medium">{item.produto}</span>
                <span className="text-center text-sm">{item.estoque_atual}</span>
                <span className="text-center text-sm">{formatNum(item.vendido_total)}</span>
                {/* KL Market */}
                <div className="text-center">
                  <p className="text-sm">{formatNum(item.loja_kl)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.pct_kl.toFixed(0)}%</p>
                </div>
                {/* Universo */}
                <div className="text-center">
                  <p className="text-sm">{formatNum(item.loja_universo)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.pct_universo.toFixed(0)}%</p>
                </div>
                {/* Mundo */}
                <div className="text-center">
                  <p className="text-sm">{formatNum(item.loja_mundo)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.pct_mundo.toFixed(0)}%</p>
                </div>
                <span className="text-center text-sm">{item.dias_estoque >= 999 ? '∞' : item.dias_estoque}</span>
                <span className="text-center font-bold text-sm" style={{ color: item.sugestao_compra > 0 ? 'var(--shopee-primary)' : 'var(--text-muted)' }}>
                  {item.sugestao_compra > 0 ? formatNum(item.sugestao_compra) : '-'}
                </span>
                <div className="flex justify-center">
                  <span className={statusClass}>{status}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Simulação de Compra */}
      {skuSelecionado && itemSelecionado && simSelecionada && (
        <div className="card" style={{ border: '1px solid rgba(238,44,0,0.3)' }}>
          <div className="flex items-center gap-2 mb-5">
            <ShoppingBag className="w-5 h-5" style={{ color: 'var(--shopee-primary)' }} />
            <h2 className="font-bold text-base">Simulação de Compra — {skuSelecionado}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                Quantidade da Compra
              </label>
              <input type="number" min={0}
                value={simSelecionada.quantidade_compra}
                onChange={e => setSimulacoes(prev => ({
                  ...prev,
                  [skuSelecionado]: { ...prev[skuSelecionado], quantidade_compra: +e.target.value }
                }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                Custo Total da Compra (R$)
              </label>
              <input type="number" min={0} step="0.01"
                value={simSelecionada.custo_total}
                onChange={e => setSimulacoes(prev => ({
                  ...prev,
                  [skuSelecionado]: { ...prev[skuSelecionado], custo_total: +e.target.value }
                }))}
                className="input-field" placeholder="0,00" />
            </div>
          </div>

          {/* Rateio */}
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              Rateio Proporcional por Loja
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { loja: 'KL Market', vendido: itemSelecionado.loja_kl, pct: itemSelecionado.pct_kl, color: '#EE2C00' },
                { loja: 'Universo dos Achados', vendido: itemSelecionado.loja_universo, pct: itemSelecionado.pct_universo, color: '#FF6535' },
                { loja: 'Mundo dos Achados', vendido: itemSelecionado.loja_mundo, pct: itemSelecionado.pct_mundo, color: '#FF9970' },
              ].map(({ loja, vendido, pct, color }) => {
                const qtdLoja = Math.round((pct / 100) * simSelecionada.quantidade_compra)
                const valorLoja = (pct / 100) * simSelecionada.custo_total
                return (
                  <div key={loja} className="p-4 rounded-xl"
                    style={{ background: 'var(--bg-hover)', border: `1px solid ${color}30` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <p className="text-sm font-semibold">{loja.split(' ')[0]}</p>
                    </div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      Vendeu: {formatNum(vendido)} un
                    </p>
                    <p className="text-2xl font-bold mb-1" style={{ color }}>
                      {pct.toFixed(1)}%
                    </p>
                    <div className="h-1.5 rounded-full mb-3" style={{ background: 'var(--border)' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>Quantidade:</span>
                        <span className="font-bold">{formatNum(qtdLoja)} un</span>
                      </div>
                      {simSelecionada.custo_total > 0 && (
                        <div className="flex justify-between text-xs">
                          <span style={{ color: 'var(--text-muted)' }}>Valor:</span>
                          <span className="font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(valorLoja)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        💡 Clique em um produto para simular a divisão da compra entre as lojas.
      </p>
    </div>
  )
}
