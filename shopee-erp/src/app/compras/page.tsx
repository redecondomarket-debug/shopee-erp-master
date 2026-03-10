'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel } from '@/lib/exports'
import { ShoppingBag, Download, X, Settings, RefreshCw } from 'lucide-react'

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']
const LOJA_SHORT = { 'KL Market': 'KL', 'Universo dos Achados': 'Universo', 'Mundo dos Achados': 'Mundo' }

// Custo de compra por unidade de cada SKU base (editável)
const CUSTOS_PADRAO: Record<string, number> = {
  FORMA: 8.50,
  SAQUINHO: 0.45,
  TAPETES: 12.00,
  PORTASAQUINHO: 3.50,
}

// Mapa de composição SKU venda → SKU base
const SKU_MAP: Record<string, { sku_base: string; quantidade: number }[]> = {
  FM50:       [{ sku_base: 'FORMA', quantidade: 1 }],
  FM100:      [{ sku_base: 'FORMA', quantidade: 2 }],
  FM200:      [{ sku_base: 'FORMA', quantidade: 4 }],
  FM300:      [{ sku_base: 'FORMA', quantidade: 6 }],
  'KIT2TP':   [{ sku_base: 'TAPETES', quantidade: 2 }],
  'KIT3TP':   [{ sku_base: 'TAPETES', quantidade: 3 }],
  'KIT4TP':   [{ sku_base: 'TAPETES', quantidade: 4 }],
  'KIT120':   [{ sku_base: 'SAQUINHO', quantidade: 6 }],
  'KIT240':   [{ sku_base: 'SAQUINHO', quantidade: 12 }],
  'KIT480':   [{ sku_base: 'SAQUINHO', quantidade: 24 }],
  'KIT120B':  [{ sku_base: 'SAQUINHO', quantidade: 6 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }],
  'KIT240B':  [{ sku_base: 'SAQUINHO', quantidade: 12 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }],
  'KIT480B':  [{ sku_base: 'SAQUINHO', quantidade: 24 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }],
  'KITPS120B':[{ sku_base: 'SAQUINHO', quantidade: 6 }, { sku_base: 'PORTASAQUINHO', quantidade: 1 }],
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

type VendaItem = { sku_venda: string; quantidade: number; loja: string; data: string }

export default function ComprasPage() {
  const [vendas, setVendas] = useState<VendaItem[]>([])
  const [estoque, setEstoque] = useState<{ sku_base: string; estoque_atual: number; estoque_minimo: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [custos, setCustos] = useState<Record<string, number>>(CUSTOS_PADRAO)
  const [multiplicador, setMultiplicador] = useState(1)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [vendasRes, estoqueRes] = await Promise.all([
      supabase.from('vendas').select('sku_venda, quantidade, loja, data').limit(5000),
      supabase.from('estoque').select('sku_base, estoque_atual, estoque_minimo'),
    ])
    setVendas(vendasRes.data || [])
    setEstoque(estoqueRes.data || [])
    setLoading(false)
  }

  const limparFiltros = () => { setLojaFilter(''); setDateFrom(''); setDateTo('') }
  const temFiltro = lojaFilter || dateFrom || dateTo

  // Vendas filtradas
  const vendasFiltradas = vendas.filter(v => {
    if (lojaFilter && v.loja !== lojaFilter) return false
    if (dateFrom && v.data < dateFrom) return false
    if (dateTo && v.data > dateTo) return false
    return true
  })

  // Calcular consumo de SKU base por loja
  type ConsumoLoja = Record<string, number>
  const consumoPorSkuBase: Record<string, { total: number; porLoja: ConsumoLoja }> = {}

  for (const venda of vendasFiltradas) {
    const composicao = SKU_MAP[venda.sku_venda]
    if (!composicao) continue
    for (const comp of composicao) {
      if (!consumoPorSkuBase[comp.sku_base]) {
        consumoPorSkuBase[comp.sku_base] = { total: 0, porLoja: {} }
      }
      const qtdConsumida = (venda.quantidade || 1) * comp.quantidade
      consumoPorSkuBase[comp.sku_base].total += qtdConsumida
      const loja = venda.loja || 'Sem loja'
      consumoPorSkuBase[comp.sku_base].porLoja[loja] = (consumoPorSkuBase[comp.sku_base].porLoja[loja] || 0) + qtdConsumida
    }
  }

  // Montar tabela de necessidade de compra
  const itensCompra = Object.entries(consumoPorSkuBase).map(([sku_base, consumo]) => {
    const estoqueItem = estoque.find(e => e.sku_base === sku_base)
    const estoqueAtual = estoqueItem?.estoque_atual || 0
    const estoqueMinimo = estoqueItem?.estoque_minimo || 0
    const sugestaoBase = Math.max(0, consumo.total * multiplicador - estoqueAtual + estoqueMinimo)
    const custo = custos[sku_base] || 0
    const custoTotal = sugestaoBase * custo

    // Rateio por loja: proporção das vendas no período
    const rateioPorLoja: Record<string, { unidades: number; valor: number; pct: number }> = {}
    for (const loja of LOJAS) {
      const qtdLoja = consumo.porLoja[loja] || 0
      const pct = consumo.total > 0 ? qtdLoja / consumo.total : 0
      const unidadesLoja = Math.round(sugestaoBase * pct)
      rateioPorLoja[loja] = {
        unidades: unidadesLoja,
        valor: unidadesLoja * custo,
        pct: pct * 100,
      }
    }

    return { sku_base, consumo: consumo.total, estoqueAtual, estoqueMinimo, sugestao: Math.ceil(sugestaoBase), custo, custoTotal, porLoja: consumo.porLoja, rateioPorLoja }
  }).sort((a, b) => b.custoTotal - a.custoTotal)

  const totalCompra = itensCompra.reduce((s, i) => s + i.custoTotal, 0)
  const rateioPorLoja = LOJAS.map(loja => ({
    loja,
    lojaShort: LOJA_SHORT[loja as keyof typeof LOJA_SHORT],
    total: itensCompra.reduce((s, i) => s + (i.rateioPorLoja[loja]?.valor || 0), 0),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Ordem de Compra</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Sugestão automática baseada nas vendas do período
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowConfig(!showConfig)} className="btn-secondary">
            <Settings className="w-4 h-4" /> Custos
          </button>
          <button onClick={loadData} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button onClick={() => exportToExcel(itensCompra.map(i => ({
            'SKU Base': i.sku_base,
            'Consumo no Período': i.consumo,
            'Estoque Atual': i.estoqueAtual,
            'Sugestão Compra': i.sugestao,
            'Custo Unit. (R$)': i.custo,
            'Total (R$)': i.custoTotal.toFixed(2),
            'KL Market (R$)': i.rateioPorLoja['KL Market']?.valor.toFixed(2) || '0.00',
            'Universo (R$)': i.rateioPorLoja['Universo dos Achados']?.valor.toFixed(2) || '0.00',
            'Mundo (R$)': i.rateioPorLoja['Mundo dos Achados']?.valor.toFixed(2) || '0.00',
          })), 'ordem-de-compra')} className="btn-secondary">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Configuração de custos */}
      {showConfig && (
        <div className="card" style={{ border: '1px solid rgba(0,149,255,0.3)', background: 'rgba(0,149,255,0.05)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--info)' }}>⚙️ Custo de Compra por Unidade (R$)</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {Object.keys(custos).map(sku => (
              <div key={sku}>
                <label className="block text-xs mb-1 font-mono font-bold" style={{ color: 'var(--shopee-primary)' }}>{sku}</label>
                <input type="number" min={0} step={0.01} value={custos[sku]}
                  onChange={e => setCustos({ ...custos, [sku]: +e.target.value })}
                  className="input-field" placeholder="R$ 0,00" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              Multiplicador de segurança (1x = comprar exato consumido, 1.5x = +50% de reserva)
            </label>
            <div className="flex items-center gap-3">
              <input type="number" min={1} max={3} step={0.1} value={multiplicador}
                onChange={e => setMultiplicador(+e.target.value)} className="input-field w-24" />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Fator: <strong style={{ color: 'var(--warning)' }}>{multiplicador}x</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-36" />
        <span style={{ color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-36" />
        {temFiltro && (
          <button onClick={limparFiltros} className="btn-secondary"><X className="w-4 h-4" /> Limpar</button>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {vendasFiltradas.length} vendas no período
        </span>
      </div>

      {/* Resumo total + rateio por loja */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="stat-card" style={{ border: '1px solid rgba(238,44,0,0.3)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total da Compra</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--shopee-primary)', fontFamily: 'var(--font-display)' }}>
            {formatCurrency(totalCompra)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{itensCompra.length} produtos</p>
        </div>
        {rateioPorLoja.map((r, i) => (
          <div key={r.loja} className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              {r.lojaShort}
            </p>
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: ['#EE2C00', '#FF6535', '#FF9970'][i] }}>
              {formatCurrency(r.total)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {totalCompra > 0 ? ((r.total / totalCompra) * 100).toFixed(1) : 0}% do total
            </p>
          </div>
        ))}
      </div>

      {/* Tabela de itens */}
      <div className="table-container overflow-x-auto">
        <div style={{ minWidth: '900px' }}>
          <div className="grid table-header" style={{ gridTemplateColumns: '120px 90px 90px 80px 90px 100px 110px 110px 110px' }}>
            <span>SKU Base</span>
            <span className="text-center">Consumido</span>
            <span className="text-center">Estoque</span>
            <span className="text-center">Comprar</span>
            <span className="text-right">Custo/Un</span>
            <span className="text-right">Total</span>
            <span className="text-right">KL (R$)</span>
            <span className="text-right">Universo (R$)</span>
            <span className="text-right">Mundo (R$)</span>
          </div>

          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Calculando...</div>
          ) : itensCompra.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma venda no período selecionado</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Importe vendas ou ajuste o período</p>
            </div>
          ) : (
            itensCompra.map(item => {
              const precisaComprar = item.sugestao > 0
              return (
                <div key={item.sku_base} className="grid table-row items-center"
                  style={{
                    gridTemplateColumns: '120px 90px 90px 80px 90px 100px 110px 110px 110px',
                    borderLeft: precisaComprar ? '3px solid var(--warning)' : '3px solid var(--success)',
                  }}>
                  <span className="font-mono text-sm font-bold" style={{ color: 'var(--shopee-primary)' }}>{item.sku_base}</span>
                  <span className="text-center text-sm">{item.consumo.toLocaleString('pt-BR')}</span>
                  <span className="text-center">
                    <span className={item.estoqueAtual <= item.estoqueMinimo ? 'badge-warning' : 'badge-success'}>
                      {item.estoqueAtual}
                    </span>
                  </span>
                  <span className="text-center">
                    {precisaComprar ? (
                      <span className="font-bold text-sm" style={{ color: 'var(--warning)' }}>{item.sugestao}</span>
                    ) : (
                      <span className="badge-success">OK</span>
                    )}
                  </span>
                  <span className="text-right text-sm">{formatCurrency(item.custo)}</span>
                  <span className="text-right font-bold text-sm" style={{ color: precisaComprar ? 'var(--shopee-primary)' : 'var(--text-muted)' }}>
                    {formatCurrency(item.custoTotal)}
                  </span>
                  <span className="text-right text-sm" style={{ color: '#EE2C00' }}>
                    {formatCurrency(item.rateioPorLoja['KL Market']?.valor || 0)}
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.rateioPorLoja['KL Market']?.pct.toFixed(0) || 0}%
                    </span>
                  </span>
                  <span className="text-right text-sm" style={{ color: '#FF6535' }}>
                    {formatCurrency(item.rateioPorLoja['Universo dos Achados']?.valor || 0)}
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.rateioPorLoja['Universo dos Achados']?.pct.toFixed(0) || 0}%
                    </span>
                  </span>
                  <span className="text-right text-sm" style={{ color: '#FF9970' }}>
                    {formatCurrency(item.rateioPorLoja['Mundo dos Achados']?.valor || 0)}
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.rateioPorLoja['Mundo dos Achados']?.pct.toFixed(0) || 0}%
                    </span>
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Resumo detalhado por loja */}
      {itensCompra.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {LOJAS.map((loja, i) => (
            <div key={loja} className="card">
              <h3 className="font-semibold text-sm mb-3" style={{ color: ['#EE2C00', '#FF6535', '#FF9970'][i] }}>
                📦 {LOJA_SHORT[loja as keyof typeof LOJA_SHORT]}
              </h3>
              <div className="space-y-2">
                {itensCompra.filter(i => (i.rateioPorLoja[loja]?.unidades || 0) > 0).map(item => (
                  <div key={item.sku_base} className="flex justify-between text-sm">
                    <span className="font-mono" style={{ color: 'var(--shopee-primary)' }}>{item.sku_base}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.rateioPorLoja[loja]?.unidades || 0} un</span>
                    <span className="font-semibold">{formatCurrency(item.rateioPorLoja[loja]?.valor || 0)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold text-sm" style={{ borderColor: 'var(--border)' }}>
                  <span>Total</span>
                  <span style={{ color: ['#EE2C00', '#FF6535', '#FF9970'][i] }}>
                    {formatCurrency(rateioPorLoja[i].total)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
