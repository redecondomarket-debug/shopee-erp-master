'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF, exportMultiSheetExcel } from '@/lib/exports'
import { Download, FileText, Database, Loader2, CheckCircle } from 'lucide-react'

type ExportStatus = 'idle' | 'loading' | 'done'

function ReportCard({ title, desc, onExcelExport, onPdfExport, status }: {
  title: string; desc: string;
  onExcelExport: () => void; onPdfExport: () => void; status: ExportStatus
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
        </div>
        {status === 'loading' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--shopee-primary)' }} />}
        {status === 'done' && <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onExcelExport} disabled={status === 'loading'} className="btn-secondary flex-1 justify-center">
          <Download className="w-4 h-4" /> Excel
        </button>
        <button onClick={onPdfExport} disabled={status === 'loading'} className="btn-secondary flex-1 justify-center">
          <FileText className="w-4 h-4" /> PDF
        </button>
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  const [statuses, setStatuses] = useState<Record<string, ExportStatus>>({})

  const setStatus = (key: string, val: ExportStatus) => {
    setStatuses(s => ({ ...s, [key]: val }))
    if (val === 'done') setTimeout(() => setStatuses(s => ({ ...s, [key]: 'idle' })), 3000)
  }

  async function exportEstoque(format: 'excel' | 'pdf') {
    setStatus('estoque', 'loading')
    const { data } = await supabase.from('estoque').select('*').order('produto')
    if (!data) return setStatus('estoque', 'idle')
    const rows = data.map(i => ({ 'SKU Base': i.sku_base, 'Produto': i.produto, 'Estoque Atual': i.estoque_atual, 'Estoque Mínimo': i.estoque_minimo, 'Status': i.estoque_atual <= i.estoque_minimo ? 'BAIXO' : 'OK' }))
    if (format === 'excel') exportToExcel(rows, 'relatorio-estoque')
    else exportToPDF('Relatório de Estoque', [
      { header: 'SKU Base', dataKey: 'SKU Base' }, { header: 'Produto', dataKey: 'Produto' },
      { header: 'Estoque Atual', dataKey: 'Estoque Atual' }, { header: 'Mínimo', dataKey: 'Estoque Mínimo' },
      { header: 'Status', dataKey: 'Status' },
    ], rows, 'relatorio-estoque')
    setStatus('estoque', 'done')
  }

  async function exportVendas(format: 'excel' | 'pdf') {
    setStatus('vendas', 'loading')
    const { data } = await supabase.from('vendas').select('*').order('data', { ascending: false })
    if (!data) return setStatus('vendas', 'idle')
    const rows = data.map(v => ({ 'Data': v.data, 'Loja': v.loja, 'Pedido': v.pedido, 'SKU': v.sku_venda, 'Quantidade': v.quantidade, 'Valor': v.valor_venda }))
    if (format === 'excel') exportToExcel(rows, 'relatorio-vendas')
    else exportToPDF('Relatório de Vendas', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Loja', dataKey: 'Loja' },
      { header: 'Pedido', dataKey: 'Pedido' }, { header: 'SKU', dataKey: 'SKU' },
      { header: 'Qtd', dataKey: 'Quantidade' }, { header: 'Valor', dataKey: 'Valor' },
    ], rows, 'relatorio-vendas')
    setStatus('vendas', 'done')
  }

  async function exportFinanceiro(format: 'excel' | 'pdf') {
    setStatus('financeiro', 'loading')
    const { data } = await supabase.from('financeiro').select('*').order('data', { ascending: false })
    if (!data) return setStatus('financeiro', 'idle')
    const rows = data.map(f => ({ 'Data': f.data, 'Loja': f.loja, 'Pedido': f.pedido, 'SKU': f.sku, 'Qtd': f.quantidade, 'Bruto': f.valor_bruto, 'Desconto': f.desconto, 'Comissão': f.comissao_shopee, 'Taxas': f.taxas_shopee, 'Frete': f.frete, 'Líquido': f.valor_liquido }))
    if (format === 'excel') exportToExcel(rows, 'relatorio-financeiro')
    else exportToPDF('Relatório Financeiro', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Loja', dataKey: 'Loja' }, { header: 'SKU', dataKey: 'SKU' },
      { header: 'Bruto', dataKey: 'Bruto' }, { header: 'Comissão', dataKey: 'Comissão' }, { header: 'Líquido', dataKey: 'Líquido' },
    ], rows, 'relatorio-financeiro')
    setStatus('financeiro', 'done')
  }

  async function exportMovimentacoes(format: 'excel' | 'pdf') {
    setStatus('mov', 'loading')
    const { data } = await supabase.from('movimentacoes').select('*').order('data', { ascending: false })
    if (!data) return setStatus('mov', 'idle')
    const rows = data.map(m => ({ 'Data': m.data, 'Tipo': m.tipo, 'SKU Base': m.sku_base, 'Quantidade': m.quantidade, 'Origem': m.origem, 'Observação': m.observacao }))
    if (format === 'excel') exportToExcel(rows, 'movimentacoes')
    else exportToPDF('Movimentações de Estoque', [
      { header: 'Data', dataKey: 'Data' }, { header: 'Tipo', dataKey: 'Tipo' },
      { header: 'SKU Base', dataKey: 'SKU Base' }, { header: 'Quantidade', dataKey: 'Quantidade' },
      { header: 'Origem', dataKey: 'Origem' },
    ], rows, 'movimentacoes')
    setStatus('mov', 'done')
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
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Relatórios & Backup</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Exporte dados em Excel ou PDF</p>
      </div>

      {/* Backup completo */}
      <div className="card" style={{ border: '1px solid var(--shopee-primary)', background: 'rgba(238,44,0,0.05)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Database className="w-5 h-5" style={{ color: 'var(--shopee-primary)' }} />
              Backup Completo do Sistema
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Exporta todas as tabelas em um único arquivo Excel com múltiplas abas
            </p>
          </div>
          {statuses['completo'] === 'loading' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--shopee-primary)' }} />}
          {statuses['completo'] === 'done' && <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />}
        </div>
        <button onClick={exportCompleto} disabled={statuses['completo'] === 'loading'}
          className="btn-primary mt-4">
          <Download className="w-4 h-4" />
          {statuses['completo'] === 'loading' ? 'Exportando...' : 'Exportar Backup Completo (Excel)'}
        </button>
      </div>

      {/* Individual reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard
          title="Estoque"
          desc="SKUs base, quantidades e alertas de estoque mínimo"
          onExcelExport={() => exportEstoque('excel')}
          onPdfExport={() => exportEstoque('pdf')}
          status={statuses['estoque'] || 'idle'}
        />
        <ReportCard
          title="Vendas"
          desc="Todos os pedidos registrados com valores por loja"
          onExcelExport={() => exportVendas('excel')}
          onPdfExport={() => exportVendas('pdf')}
          status={statuses['vendas'] || 'idle'}
        />
        <ReportCard
          title="Financeiro"
          desc="Receitas, comissões Shopee, taxas e lucro líquido"
          onExcelExport={() => exportFinanceiro('excel')}
          onPdfExport={() => exportFinanceiro('pdf')}
          status={statuses['financeiro'] || 'idle'}
        />
        <ReportCard
          title="Movimentações de Estoque"
          desc="Histórico completo de entradas, saídas e ajustes"
          onExcelExport={() => exportMovimentacoes('excel')}
          onPdfExport={() => exportMovimentacoes('pdf')}
          status={statuses['mov'] || 'idle'}
        />
      </div>
    </div>
  )
}
