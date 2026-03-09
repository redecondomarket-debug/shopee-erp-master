'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { ClipboardList, Download, FileText, RefreshCw } from 'lucide-react'

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
}

function formatNum(val: number) {
  return Math.ceil(val).toLocaleString('pt-BR')
}

export default function ComprasPage() {
  const [ordens, setOrdens] = useState<OrdemItem[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(30)

  useEffect(() => { loadData() }, [periodo])

  async function loadData() {
    setLoading(true)
    
    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - periodo)
    const dataInicioStr = dataInicio.toISOString().split('T')[0]

    const [estoqueRes, vendasRes, skuMapRes] = await Promise.all([
      supabase.from('estoque').select('*'),
      supabase.from('vendas').select('sku_venda, quantidade, loja, data').gte('data', dataInicioStr),
      supabase.from('sku_map').select('*'),
    ])

    const estoque = estoqueRes.data || []
    const vendas = vendasRes.data || []
    const skuMap = skuMapRes.data || []

    // Calculate consumption per sku_base from sales
    const consumo: Record<string, { total: number; kl: number; universo: number; mundo: number }> = {}
    
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
      const mediaDiaria = c.total / periodo
      const diasEstoque = mediaDiaria > 0 ? item.estoque_atual / mediaDiaria : 999
      const sugestao = Math.max(0, Math.ceil(mediaDiaria * 30) - item.estoque_atual + item.estoque_minimo)
      
      return {
        sku_base: item.sku_base,
        produto: item.produto,
        estoque_atual: item.estoque_atual,
        estoque_minimo: item.estoque_minimo,
        vendido_total: c.total,
        media_diaria: mediaDiaria,
        dias_estoque: Math.round(diasEstoque),
        sugestao_compra: sugestao,
        loja_kl: c.kl,
        loja_universo: c.universo,
        loja_mundo: c.mundo,
      }
    }).sort((a, b) => a.dias_estoque - b.dias_estoque)

    setOrdens(result)
    setLoading(false)
  }

  const urgente = ordens.filter(o => o.dias_estoque <= 7 && o.sugestao_compra > 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Ordem de Compra</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Sugestão automática baseada nas vendas dos últimos {periodo} dias
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={periodo} onChange={e => setPeriodo(+e.target.value)} className="input-field w-36">
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={60}>Últimos 60 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button onClick={loadData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => exportToExcel(ordens.map(o => ({
            'SKU Base': o.sku_base, 'Produto': o.produto, 'Estoque Atual': o.estoque_atual,
            'Vendido no Período': o.vendido_total, 'Média Diária': o.media_diaria.toFixed(2),
            'Dias de Estoque': o.dias_estoque, 'Sugestão de Compra': o.sugestao_compra,
            'KL Market': o.loja_kl, 'Universo dos Achados': o.loja_universo, 'Mundo dos Achados': o.loja_mundo,
          })), 'ordem-compra')} className="btn-secondary">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => exportToPDF('Ordem de Compra', [
            { header: 'SKU', dataKey: 'sku_base' }, { header: 'Produto', dataKey: 'produto' },
            { header: 'Estoque', dataKey: 'estoque_atual' }, { header: 'Dias', dataKey: 'dias_estoque' },
            { header: 'Sugestão', dataKey: 'sugestao_compra' },
          ], ordens, 'ordem-compra')} className="btn-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

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

      {/* Table */}
      <div className="table-container overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid table-header" style={{ gridTemplateColumns: '120px 1fr 80px 80px 80px 80px 100px' }}>
            <span>SKU Base</span><span>Produto</span><span className="text-center">Estoque</span>
            <span className="text-center">Vendido</span><span className="text-center">Dias</span>
            <span className="text-center">Sugestão</span><span className="text-center">Status</span>
          </div>
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Calculando...</div>
          ) : ordens.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum dado disponível</p>
            </div>
          ) : (
            ordens.map(item => {
              const status = item.dias_estoque <= 7 ? 'CRÍTICO' : item.dias_estoque <= 15 ? 'ATENÇÃO' : 'OK'
              const statusClass = status === 'CRÍTICO' ? 'badge-danger' : status === 'ATENÇÃO' ? 'badge-warning' : 'badge-success'
              return (
                <div key={item.sku_base} className="grid table-row items-center"
                     style={{ gridTemplateColumns: '120px 1fr 80px 80px 80px 80px 100px' }}>
                  <span className="font-mono text-sm" style={{ color: 'var(--shopee-primary)' }}>{item.sku_base}</span>
                  <span className="text-sm font-medium">{item.produto}</span>
                  <span className="text-center text-sm">{item.estoque_atual}</span>
                  <span className="text-center text-sm">{formatNum(item.vendido_total)}</span>
                  <span className="text-center text-sm">{item.dias_estoque >= 999 ? '∞' : item.dias_estoque}</span>
                  <span className="text-center font-bold text-sm" style={{ color: item.sugestao_compra > 0 ? 'var(--shopee-primary)' : 'var(--text-muted)' }}>
                    {item.sugestao_compra > 0 ? formatNum(item.sugestao_compra) : '-'}
                  </span>
                  <div className="flex justify-center">
                    <span className={statusClass}>{status}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
