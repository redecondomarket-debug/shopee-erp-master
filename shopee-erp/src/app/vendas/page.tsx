'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF, parseShopeeReport } from '@/lib/exports'
import { ShoppingCart, Upload, Plus, Download, FileText, Search, X, Loader2, Store } from 'lucide-react'

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

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
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
        origem: 'Venda manual',
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
      const rows = await parseShopeeReport(file)
      let inserted = 0
      let errors = 0

      setImportMsg(`Processando ${rows.length} linhas...`)

      for (const row of rows) {
        // Map Shopee columns (flexible mapping)
        const pedido = row['Order ID'] || row['Número do pedido'] || row['order_id'] || ''
        const data = row['Order Creation Date'] || row['Data de criação do pedido'] || row['order_date'] || new Date().toISOString().split('T')[0]
        const sku = row['SKU'] || row['Seller SKU'] || row['sku'] || ''
        const produto = row['Product Name'] || row['Nome do produto'] || ''
        const qty = parseInt(row['Quantity'] || row['Quantidade'] || '1') || 1
        const valor = parseFloat((row['Original Price'] || row['Preço original'] || '0').replace(/[^0-9.]/g, '')) || 0
        const loja = row['Store Name'] || row['Nome da loja'] || LOJAS[0]
        const desconto = parseFloat((row['Discount'] || row['Desconto'] || '0').replace(/[^0-9.]/g, '')) || 0
        const frete = parseFloat((row['Shipping Fee'] || row['Frete'] || '0').replace(/[^0-9.]/g, '')) || 0
        const comissao = parseFloat((row['Shopee Commission'] || row['Comissão Shopee'] || '0').replace(/[^0-9.]/g, '')) || 0
        const taxas = parseFloat((row['Shopee Fee'] || row['Taxa Shopee'] || '0').replace(/[^0-9.]/g, '')) || 0
        const liquido = parseFloat((row['Final Amount Received'] || row['Valor recebido'] || '0').replace(/[^0-9.]/g, '')) || 0
        const status = row['Order Status'] || row['Status'] || 'Completed'

        if (!pedido) continue

        // Insert venda
        const { error: vErr } = await supabase.from('vendas').insert({
          data: data.split(' ')[0] || data,
          loja: LOJAS.find(l => l.toLowerCase().includes(loja.toLowerCase())) || LOJAS[0],
          pedido,
          sku_venda: sku,
          quantidade: qty,
          valor_venda: valor,
        })

        // Insert financeiro
        await supabase.from('financeiro').insert({
          pedido,
          data: data.split(' ')[0] || data,
          produto,
          sku,
          quantidade: qty,
          valor_bruto: valor,
          desconto,
          frete,
          comissao_shopee: comissao,
          taxas_shopee: taxas,
          valor_liquido: liquido,
          loja: LOJAS.find(l => l.toLowerCase().includes(loja.toLowerCase())) || LOJAS[0],
        })

        if (!vErr) { inserted++; await processarBaixaEstoque(sku, qty) }
        else errors++
      }

      setImportMsg(`✅ ${inserted} vendas importadas! ${errors > 0 ? `${errors} erros.` : ''}`)
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

      {/* Filters */}
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

      {/* Table */}
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

      {/* Add Modal */}
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
