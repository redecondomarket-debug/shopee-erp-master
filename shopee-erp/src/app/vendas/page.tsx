'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { ShoppingCart, Upload, Plus, Download, FileText, Search, X, Loader2, Store } from 'lucide-react'
import * as XLSX from 'xlsx'

type Venda = {
  id: string
  data: string
  loja: string
  pedido: string
  sku_venda: string
  quantidade: number
  valor_venda: number
  created_at: string
}

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

// Status de pedidos que devem ser importados (ignorar cancelados)
const STATUS_VALIDOS = [
  'concluído', 'concluido', 'entregue', 'enviado',
  'order received', 'completed', 'delivered', 'shipped',
  'o comprador pode pedir uma devolução'
]

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function parseValor(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  return parseFloat(String(val).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
}

function parseData(val: unknown): string {
  if (!val) return new Date().toISOString().split('T')[0]
  const str = String(val)
  // formato: 2026-01-28 20:49
  const match = str.match(/(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  return new Date().toISOString().split('T')[0]
}

function mapearLoja(lojaRaw: unknown): string {
  if (!lojaRaw) return LOJAS[0]
  const l = String(lojaRaw).toLowerCase().trim()
  if (l.includes('kl') || l.includes('kl market')) return 'KL Market'
  if (l.includes('universo')) return 'Universo dos Achados'
  if (l.includes('mundo')) return 'Mundo dos Achados'
  return lojaRaw as string
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [filtered, setFiltered] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [newVenda, setNewVenda] = useState({
    data: new Date().toISOString().split('T')[0],
    loja: LOJAS[0],
    pedido: '',
    sku_venda: '',
    quantidade: 1,
    valor_venda: 0,
  })

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    let data = [...vendas]
    if (search) data = data.filter(v => v.pedido?.includes(search) || v.sku_venda?.toLowerCase().includes(search.toLowerCase()))
    if (lojaFilter) data = data.filter(v => v.loja === lojaFilter)
    if (dateFrom) data = data.filter(v => v.data >= dateFrom)
    if (dateTo) data = data.filter(v => v.data <= dateTo)
    setFiltered(data)
  }, [vendas, search, lojaFilter, dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('vendas').select('*').order('data', { ascending: false }).limit(500)
    setVendas(data || [])
    setLoading(false)
  }

  async function processarBaixaEstoque(skuVenda: string, quantidade: number) {
    if (!skuVenda) return
    const { data: maps } = await supabase.from('sku_map').select('*').eq('sku_venda', skuVenda)
    if (!maps || maps.length === 0) return

    for (const map of maps) {
      const { data: estoqueItem } = await supabase.from('estoque').select('*').eq('sku_base', map.sku_base).single()
      if (!estoqueItem) continue

      const qtdBaixa = map.quantidade * quantidade
      const novoEstoque = Math.max(0, estoqueItem.estoque_atual - qtdBaixa)

      await supabase.from('estoque').update({ estoque_atual: novoEstoque }).eq('id', estoqueItem.id)
      await supabase.from('movimentacoes').insert({
        data: new Date().toISOString().split('T')[0],
        tipo: 'VENDA',
        sku_base: map.sku_base,
        quantidade: qtdBaixa,
        origem: 'Importação Shopee',
        observacao: `SKU Venda: ${skuVenda}`,
      })
    }
  }

  async function handleAddVenda() {
    const { error } = await supabase.from('vendas').insert(newVenda)
    if (!error) {
      await processarBaixaEstoque(newVenda.sku_venda, newVenda.quantidade)
      setShowAdd(false)
      setMsg('Venda registrada! Estoque atualizado.')
      loadData()
      setTimeout(() => setMsg(''), 4000)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportMsg('Lendo arquivo...')

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      let inserted = 0
      let ignorados = 0
      let erros = 0

      setImportMsg(`Processando ${rows.length} linhas...`)

      for (const row of rows) {
        // Mapeamento correto das colunas do relatório Shopee Brasil
        const pedido = String(row['ID do pedido'] || '').trim()
        const status = String(row['Status do pedido'] || '').toLowerCase().trim()
        const sku = String(row['Número de referência SKU'] || row['Nº de referência do SKU principal'] || '').trim()
        const produto = String(row['Nome do Produto'] || '').trim()
        const dataStr = parseData(row['Data de criação do pedido'])
        const qty = parseInt(String(row['Quantidade'] || '1')) || 1
        const valorBruto = parseValor(row['Preço original'])
        const valorAcordado = parseValor(row['Preço acordado'])
        const totalGlobal = parseValor(row['Total global'])
        const desconto = parseValor(row['Desconto do vendedor'])
        const frete = parseValor(row['Taxa de envio pagas pelo comprador'])
        const comissao = parseValor(row['Taxa de comissão bruta'])
        const taxas = parseValor(row['Taxa de serviço líquida'])
        const lojaRaw = row['LOJA'] || row['Loja'] || row['Store Name'] || ''
        const loja = mapearLoja(lojaRaw)

        if (!pedido) continue

        // Ignorar pedidos cancelados/devolvidos
        const statusValido = STATUS_VALIDOS.some(s => status.includes(s))
        if (!statusValido) {
          ignorados++
          continue
        }

        if (!sku) {
          ignorados++
          continue
        }

        // Verificar se pedido já foi importado
        const { data: existing } = await supabase
          .from('vendas')
          .select('id')
          .eq('pedido', pedido)
          .eq('sku_venda', sku)
          .limit(1)

        if (existing && existing.length > 0) {
          ignorados++
          continue
        }

        const { error: vErr } = await supabase.from('vendas').insert({
          data: dataStr,
          loja,
          pedido,
          sku_venda: sku,
          quantidade: qty,
          valor_venda: totalGlobal || valorAcordado || valorBruto,
        })

        await supabase.from('financeiro').insert({
          pedido,
          data: dataStr,
          produto,
          sku,
          quantidade: qty,
          valor_bruto: valorBruto,
          desconto,
          frete,
          comissao_shopee: comissao,
          taxas_shopee: taxas,
          valor_liquido: totalGlobal,
          loja,
        })

        if (!vErr) {
          inserted++
          await processarBaixaEstoque(sku, qty)
        } else {
          erros++
        }
      }

      setImportMsg(`✅ ${inserted} vendas importadas! ${ignorados > 0 ? `${ignorados} ignoradas (duplicadas/canceladas).` : ''} ${erros > 0 ? `${erros} erros.` : ''}`)
      loadData()
    } catch (err) {
      setImportMsg(`❌ Erro ao importar: ${err}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const totalFaturamento = filtered.reduce((s, v) => s + (v.valor_venda || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Vendas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} pedidos · {formatCurrency(totalFaturamento)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar Shopee
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <button onClick={() => exportToExcel(filtered.map(v => ({
            'Data': v.data, 'Loja': v.loja, 'Pedido': v.pedido, 'SKU': v.sku_venda,
            'Qtd': v.quantidade, 'Valor': v.valor_venda,
          })), 'vendas')} className="btn-secondary">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => exportToPDF('Relatório de Vendas', [
            { header: 'Data', dataKey: 'data' }, { header: 'Loja', dataKey: 'loja' },
            { header: 'Pedido', dataKey: 'pedido' }, { header: 'SKU', dataKey: 'sku_venda' },
            { header: 'Qtd', dataKey: 'quantidade' }, { header: 'Valor', dataKey: 'valor_venda' },
          ], filtered, 'vendas')} className="btn-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nova Venda
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,149,255,0.1)', color: 'var(--info)', border: '1px solid rgba(0,149,255,0.2)' }}>
          {importMsg}
        </div>
      )}
      {msg && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,214,143,0.1)', color: 'var(--success)', border: '1px solid rgba(0,214,143,0.2)' }}>
          {msg}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 w-48" placeholder="Pedido ou SKU..." />
        </div>
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-40" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-40" />
        {(search || lojaFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setLojaFilter(''); setDateFrom(''); setDateTo('') }}
            className="btn-secondary"><X className="w-4 h-4" /> Limpar</button>
        )}
      </div>

      <div className="table-container">
        <div className="grid grid-cols-6 table-header">
          <span>Data</span><span>Loja</span><span>Pedido</span>
          <span>SKU Venda</span><span className="text-center">Qtd</span><span className="text-right">Valor</span>
        </div>
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma venda encontrada</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Importe o relatório da Shopee para começar</p>
          </div>
        ) : (
          filtered.map(v => (
            <div key={v.id} className="grid grid-cols-6 table-row items-center">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{v.data}</span>
              <span className="text-sm flex items-center gap-1.5">
                <Store className="w-3 h-3" style={{ color: 'var(--shopee-primary)' }} />
                {v.loja?.split(' ')[0]}
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{v.pedido?.slice(-8)}</span>
              <span className="font-mono text-sm" style={{ color: 'var(--shopee-primary)' }}>{v.sku_venda}</span>
              <span className="text-center text-sm">{v.quantidade}</span>
              <span className="text-right font-semibold text-sm">{formatCurrency(v.valor_venda)}</span>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md" style={{ padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Nova Venda Manual</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Data', key: 'data', type: 'date' },
                { label: 'Número do Pedido', key: 'pedido', type: 'text', placeholder: 'ID do pedido Shopee' },
                { label: 'SKU de Venda', key: 'sku_venda', type: 'text', placeholder: 'Ex: FM50, KIT2TP' },
                { label: 'Quantidade', key: 'quantidade', type: 'number' },
                { label: 'Valor da Venda (R$)', key: 'valor_venda', type: 'number', step: '0.01' },
              ].map(({ label, key, type, placeholder, step }) => (
                <div key={key}>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <input type={type} placeholder={placeholder} step={step}
                    value={(newVenda as Record<string, string | number>)[key]}
                    onChange={e => setNewVenda({ ...newVenda, [key]: type === 'number' ? +e.target.value : e.target.value })}
                    className="input-field" />
                </div>
              ))}
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Loja</label>
                <select value={newVenda.loja} onChange={e => setNewVenda({ ...newVenda, loja: e.target.value })} className="input-field">
                  {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleAddVenda} className="btn-primary flex-1">Registrar Venda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
