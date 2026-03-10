'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF, exportMultiSheetExcel } from '@/lib/exports'
import { Download, FileText, Database, Loader2, CheckCircle, Trash2, AlertTriangle, X } from 'lucide-react'

type ExportStatus = 'idle' | 'loading' | 'done'
const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

function ReportCard({ title, desc, onExcelExport, onPdfExport, status, onLimpar }: {
  title: string; desc: string; onExcelExport: () => void; onPdfExport: () => void
  status: ExportStatus; onLimpar?: () => void
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
        </div>
        {status === 'loading' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--shopee-primary)' }} />}
        {status === 'done' && <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />}
      </div>
      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={onExcelExport} disabled={status === 'loading'} className="btn-secondary flex-1 justify-center">
          <Download className="w-4 h-4" /> Excel
        </button>
        <button onClick={onPdfExport} disabled={status === 'loading'} className="btn-secondary flex-1 justify-center">
          <FileText className="w-4 h-4" /> PDF
        </button>
        {onLimpar && (
          <button onClick={onLimpar} className="btn-secondary justify-center px-3"
            style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,113,0.3)' }} title={`Limpar dados de ${title}`}>
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  const [statuses, setStatuses] = useState<Record<string, ExportStatus>>({})
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showConfirm, setShowConfirm] = useState<{ tabela: string; label: string } | null>(null)
  const [limpando, setLimpando] = useState(false)
  const [msg, setMsg] = useState('')

  const setStatus = (key: string, val: ExportStatus) => {
    setStatuses(s => ({ ...s, [key]: val }))
    if (val === 'done') setTimeout(() => setStatuses(s => ({ ...s, [key]: 'idle' })), 3000)
  }

  const limparFiltros = () => { setLojaFilter(''); setDateFrom(''); setDateTo('') }
  const temFiltro = lojaFilter || dateFrom || dateTo

  async function handleLimpar(tabela: string) {
    setLimpando(true)
    let query = supabase.from(tabela).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const hasLoja = ['vendas', 'financeiro', 'ads'].includes(tabela)
    if (hasLoja && lojaFilter) query = (query as any).eq('loja', lojaFilter)
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    await query
    setShowConfirm(null)
    setLimpando(false)
    setMsg(`✅ Dados de "${showConfirm?.label}" removidos com sucesso.`)
    setTimeout(() => setMsg(''), 4000)
  }

  async function exportVendas(format: 'excel' | 'pdf') {
    setStatus('vendas', 'loading')
    let query = supabase.from('vendas').select('*').order('data', { ascending: false })
    if (lojaFilter) query = (query as any).eq('loja', lojaFilter)
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    const { data } = await query
    if (!data) return setStatus('vendas', 'idle')
    const rows = data.map(v => ({ 'Data': v.data, 'Loja': v.loja, 'Pedido': v.pedido, 'SKU': v.sku_venda, 'Quantidade': v.quantidade, 'Valor': v.valor_venda }))
    if (format === 'excel') exportToExcel(rows, 'relatorio-vendas')
    else exportToPDF('Relatório de Vendas', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Loja', dataKey: 'Loja' }, { header: 'Pedido', dataKey: 'Pedido' },
      { header: 'SKU', dataKey: 'SKU' }, { header: 'Qtd', dataKey: 'Quantidade' }, { header: 'Valor', dataKey: 'Valor' },
    ], rows, 'relatorio-vendas')
    setStatus('vendas', 'done')
  }

  async function exportFinanceiro(format: 'excel' | 'pdf') {
    setStatus('financeiro', 'loading')
    let query = supabase.from('financeiro').select('*').order('data', { ascending: false })
    if (lojaFilter) query = (query as any).eq('loja', lojaFilter)
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    const { data } = await query
    if (!data) return setStatus('financeiro', 'idle')
    const rows = data.map(f => ({
      'Data': f.data, 'Loja': f.loja, 'Pedido': f.pedido, 'SKU': f.sku, 'Qtd': f.quantidade,
      'Bruto': f.valor_bruto, 'Desconto': f.desconto, 'Comissão': f.comissao_shopee, 'Taxas': f.taxas_shopee,
      'Frete': f.frete, 'Líquido': f.valor_liquido,
    }))
    if (format === 'excel') exportToExcel(rows, 'relatorio-financeiro')
    else exportToPDF('Relatório Financeiro', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Loja', dataKey: 'Loja' }, { header: 'SKU', dataKey: 'SKU' },
      { header: 'Bruto', dataKey: 'Bruto' }, { header: 'Comissão', dataKey: 'Comissão' }, { header: 'Líquido', dataKey: 'Líquido' },
    ], rows, 'relatorio-financeiro')
    setStatus('financeiro', 'done')
  }

  async function exportEstoque(format: 'excel' | 'pdf') {
    setStatus('estoque', 'loading')
    const { data } = await supabase.from('estoque').select('*').order('produto')
    if (!data) return setStatus('estoque', 'idle')
    const rows = data.map(i => ({ 'SKU': i.sku_base, 'Produto': i.produto, 'Atual': i.estoque_atual, 'Mínimo': i.estoque_minimo, 'Status': i.estoque_atual <= i.estoque_minimo ? 'BAIXO' : 'OK' }))
    if (format === 'excel') exportToExcel(rows, 'relatorio-estoque')
    else exportToPDF('Relatório de Estoque', [
      { header: 'SKU', dataKey: 'SKU' }, { header: 'Produto', dataKey: 'Produto' },
      { header: 'Atual', dataKey: 'Atual' }, { header: 'Mínimo', dataKey: 'Mínimo' }, { header: 'Status', dataKey: 'Status' },
    ], rows, 'relatorio-estoque')
    setStatus('estoque', 'done')
  }

  async function exportMovimentacoes(format: 'excel' | 'pdf') {
    setStatus('mov', 'loading')
    let query = supabase.from('movimentacoes').select('*').order('data', { ascending: false })
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    const { data } = await query
    if (!data) return setStatus('mov', 'idle')
    const rows = data.map(m => ({ 'Data': m.data, 'Tipo': m.tipo, 'SKU': m.sku_base, 'Quantidade': m.quantidade, 'Origem': m.origem, 'Obs': m.observacao }))
    if (format === 'excel') exportToExcel(rows, 'movimentacoes')
    else exportToPDF('Movimentações de Estoque', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Tipo', dataKey: 'Tipo' },
      { header: 'SKU', dataKey: 'SKU' }, { header: 'Quantidade', dataKey: 'Quantidade' },
    ], rows, 'movimentacoes')
    setStatus('mov', 'done')
  }

  async function exportAds(format: 'excel' | 'pdf') {
    setStatus('ads', 'loading')
    let query = supabase.from('ads').select('*').order('data', { ascending: false })
    if (lojaFilter) query = (query as any).eq('loja', lojaFilter)
    if (dateFrom) query = (query as any).gte('data', dateFrom)
    if (dateTo) query = (query as any).lte('data', dateTo)
    const { data } = await query
    if (!data) return setStatus('ads', 'idle')
    const rows = data.map(a => ({ 'Data': a.data, 'Loja': a.loja, 'Produto': a.produto, 'Investimento': a.investimento, 'Vendas': a.vendas_geradas, 'ROAS': a.roas }))
    if (format === 'excel') exportToExcel(rows, 'ads')
    else exportToPDF('Relatório de Ads', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Loja', dataKey: 'Loja' },
      { header: 'Produto', dataKey: 'Produto' }, { header: 'Investimento', dataKey: 'Investimento' },
      { header: 'Vendas', dataKey: 'Vendas' }, { header: 'ROAS', dataKey: 'ROAS' },
    ], rows, 'ads')
    setStatus('ads', 'done')
  }

  async function exportCompleto() {
    setStatus('completo', 'loading')
    const [estoqueRes, vendasRes, financeiroRes, movRes, adsRes] = await Promise.all([
      supabase.from('estoque').select('*'),
      supabase.from('vendas').select('*'),
      supabase.from('financeiro').select('*'),
      supabase.from('movimentacoes').select('*'),
      supabase.from('ads').select('*'),
    ])
    exportMultiSheetExcel([
      { name: 'Estoque', data: (estoqueRes.data || []).map(i => ({ SKU: i.sku_base, Produto: i.produto, Atual: i.estoque_atual, Mínimo: i.estoque_minimo })) },
      { name: 'Vendas', data: (vendasRes.data || []).map(v => ({ Data: v.data, Loja: v.loja, Pedido: v.pedido, SKU: v.sku_venda, Qtd: v.quantidade, Valor: v.valor_venda })) },
      { name: 'Financeiro', data: (financeiroRes.data || []).map(f => ({ Data: f.data, Loja: f.loja, SKU: f.sku, Bruto: f.valor_bruto, Líquido: f.valor_liquido })) },
      { name: 'Movimentações', data: (movRes.data || []).map(m => ({ Data: m.data, Tipo: m.tipo, SKU: m.sku_base, Qtd: m.quantidade })) },
      { name: 'Ads', data: (adsRes.data || []).map(a => ({ Data: a.data, Loja: a.loja, Produto: a.produto, Investimento: a.investimento, Vendas: a.vendas_geradas, ROAS: a.roas })) },
    ], 'backup-completo-shopee-erp')
    setStatus('completo', 'done')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Relatórios & Backup</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Exporte ou limpe dados por loja e período</p>
        </div>
      </div>

      {/* Filtros globais */}
      <div className="card" style={{ border: '1px solid rgba(0,149,255,0.2)', background: 'rgba(0,149,255,0.03)' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--info)' }}>🔍 Filtro Global (aplica em todas as exportações e limpezas)</p>
        <div className="flex gap-3 flex-wrap items-center">
          <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
            <option value="">Todas as lojas</option>
            {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-36" />
          <span style={{ color: 'var(--text-muted)' }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-36" />
          {temFiltro && <button onClick={limparFiltros} className="btn-secondary"><X className="w-4 h-4" /> Limpar Filtro</button>}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,214,143,0.1)', color: 'var(--success)', border: '1px solid rgba(0,214,143,0.2)' }}>{msg}</div>
      )}

      {/* Backup completo */}
      <div className="card" style={{ border: '1px solid var(--shopee-primary)', background: 'rgba(238,44,0,0.05)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Database className="w-5 h-5" style={{ color: 'var(--shopee-primary)' }} /> Backup Completo do Sistema
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Exporta todas as tabelas em um único Excel com múltiplas abas</p>
          </div>
          {statuses['completo'] === 'loading' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--shopee-primary)' }} />}
          {statuses['completo'] === 'done' && <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />}
        </div>
        <button onClick={exportCompleto} disabled={statuses['completo'] === 'loading'} className="btn-primary mt-4">
          <Download className="w-4 h-4" />
          {statuses['completo'] === 'loading' ? 'Exportando...' : 'Exportar Backup Completo (Excel)'}
        </button>
      </div>

      {/* Cards individuais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Vendas" desc="Pedidos, SKUs, quantidades e valores por loja"
          onExcelExport={() => exportVendas('excel')} onPdfExport={() => exportVendas('pdf')}
          status={statuses['vendas'] || 'idle'}
          onLimpar={() => setShowConfirm({ tabela: 'vendas', label: 'Vendas' })} />
        <ReportCard title="Financeiro" desc="Receitas, comissões, taxas e lucro líquido"
          onExcelExport={() => exportFinanceiro('excel')} onPdfExport={() => exportFinanceiro('pdf')}
          status={statuses['financeiro'] || 'idle'}
          onLimpar={() => setShowConfirm({ tabela: 'financeiro', label: 'Financeiro' })} />
        <ReportCard title="Ads" desc="Investimentos, vendas geradas e ROAS por loja"
          onExcelExport={() => exportAds('excel')} onPdfExport={() => exportAds('pdf')}
          status={statuses['ads'] || 'idle'}
          onLimpar={() => setShowConfirm({ tabela: 'ads', label: 'Ads' })} />
        <ReportCard title="Movimentações de Estoque" desc="Entradas, saídas e ajustes manuais"
          onExcelExport={() => exportMovimentacoes('excel')} onPdfExport={() => exportMovimentacoes('pdf')}
          status={statuses['mov'] || 'idle'}
          onLimpar={() => setShowConfirm({ tabela: 'movimentacoes', label: 'Movimentações' })} />
        <ReportCard title="Estoque Atual" desc="SKUs base, quantidades e alertas de mínimo"
          onExcelExport={() => exportEstoque('excel')} onPdfExport={() => exportEstoque('pdf')}
          status={statuses['estoque'] || 'idle'} />
      </div>

      {/* Modal confirmação de limpeza */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
              <h2 className="font-bold text-lg">Limpar: {showConfirm.label}</h2>
            </div>
            <div className="p-3 rounded-lg mb-4 text-sm space-y-1" style={{ background: 'var(--bg-hover)' }}>
              {lojaFilter && <p>Loja: <strong>{lojaFilter}</strong></p>}
              {dateFrom && <p>De: <strong>{dateFrom}</strong></p>}
              {dateTo && <p>Até: <strong>{dateTo}</strong></p>}
              {!lojaFilter && !dateFrom && !dateTo && (
                <p style={{ color: 'var(--danger)' }}>⚠️ Sem filtro — TODOS os dados de {showConfirm.label} serão apagados!</p>
              )}
            </div>
            <p className="text-xs mb-5" style={{ color: 'var(--danger)' }}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => handleLimpar(showConfirm.tabela)} disabled={limpando}
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
