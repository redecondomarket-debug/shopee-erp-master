'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTaxRate } from '@/hooks/useTaxRate'
import * as XLSX from 'xlsx'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']

// Famílias de produto (hardcoded)
const SKU_FAMILIA: Record<string, string> = {
  FM50: 'Formas', FM100: 'Formas', FM200: 'Formas', FM300: 'Formas',
  KIT2TP: 'Tapetes', KIT3TP: 'Tapetes', KIT4TP: 'Tapetes',
  KIT120: 'Saquinhos', KIT240: 'Saquinhos', KIT480: 'Saquinhos',
  KITPS120B: 'Porta-Saquinho', KITPS240B: 'Porta-Saquinho', KITPS480B: 'Porta-Saquinho',
}
const FAMILIAS_LISTA = ['Todas', 'Formas', 'Tapetes', 'Saquinhos', 'Porta-Saquinho']
const FAMILIA_CORES: Record<string, string> = {
  'Formas': '#f59e0b', 'Tapetes': '#a855f7',
  'Saquinhos': '#0ea5e9', 'Porta-Saquinho': '#22c55e',
}
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20

const R  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P  = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const D  = (s: string) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d && m && y ? `${d}/${m}/${y}` : s }
const N  = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

const S: Record<string, React.CSSProperties> = {
  card:      { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:        { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:        { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:       { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any },
  btn:       { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:     { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnDanger: { background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  label:     { fontSize: 11, color: '#888', marginBottom: 4, display: 'block', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as any },
}

function Badge({ children, color = '#ff6600' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{children}</span>
}
function StatusBadge({ v }: { v: number }) {
  if (v >= 0.20) return <Badge color="#22c55e">▲ {P(v)}</Badge>
  if (v >= 0.10) return <Badge color="#f59e0b">● {P(v)}</Badge>
  return <Badge color="#ef4444">▼ {P(v)}</Badge>
}
function Table({ headers, rows, emptyMsg = 'Nenhum dado.' }: { headers: string[]; rows: React.ReactNode[][]; emptyMsg?: string }) {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={S.th as any}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ ...S.td, color: '#555', textAlign: 'center', padding: 32 } as any}>{emptyMsg}</td></tr>
            : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={S.td as any}>{c}</td>)}</tr>)
          }
        </tbody>
      </table>
    </div>
  )
}
function Toast({ msg, type, onClose }: { msg: string; type: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, background: type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: '0 8px 32px #0009' }}>
      {type === 'ok' ? '✅' : '❌'} {msg}
    </div>
  )
}

function calcLinha(recBruta: number, custoProd: number, imposto: number) {
  const taxaShopee = recBruta * TAXA_SHOPEE
  const imp        = recBruta * imposto
  const custoTotal = taxaShopee + custoProd + imp
  const lucroOp    = recBruta - custoTotal
  const margem     = recBruta > 0 ? lucroOp / recBruta : 0
  return { taxaShopee, imp, custoTotal, lucroOp, margem }
}

function parseShopeeRow(row: Record<string, any>): any | null {
  const numPedido = String(row['Order ID'] || row['ID do pedido'] || row['No. Pesanan'] || '').trim()
  const status    = String(row['Order Status'] || row['Status do pedido'] || row['Status Pesanan'] || '').trim()
  const statusUpper = status.toUpperCase()
  const statusInvalido = ['CANCELADO', 'CANCELLED', 'CANCELED']
  if (statusInvalido.some(s => statusUpper.includes(s))) return null
  if (!numPedido) return null

  const dataRaw = row['Order Creation Date'] || row['Data de criação do pedido'] || row['Tanggal Pembuatan Pesanan'] || ''
  let data = ''
  if (dataRaw) {
    const s = String(dataRaw).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { data = s.slice(0, 10) }
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d, m, y] = s.split('/'); data = `${y}-${m}-${d}` }
    else if (/^\d{2}-\d{2}-\d{4}/.test(s)) { const [d, m, y] = s.split('-'); data = `${y}-${m}-${d}` }
    else if (!isNaN(Number(s)) && Number(s) > 10000) { const dt = new Date(Math.round((Number(s) - 25569) * 86400 * 1000)); data = dt.toISOString().slice(0, 10) }
  }
  if (!data) return null

  const nomeProd  = String(row['Product Name'] || row['Nome do Produto'] || row['Nama Produk'] || '').trim()
  const skuVenda  = String(row['Seller SKU'] || row['Número de referência SKU'] || row['SKU Referensi'] || row['SKU'] || '').trim()
  const skuPrinc  = String(row['SKU Reference No.'] || row['Nº de referência do SKU principal'] || skuVenda).trim()
  const quantidade = parseInt(String(row['Quantity'] || row['Quantidade'] || row['Jumlah'] || '1')) || 1

  const num = (v: any) => parseFloat(String(v || '0').replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0
  const precoAcordado = num(row['Agreed Price']   || row['Preço acordado']  || row['Harga Kesepakatan'])
  const precoOriginal = num(row['Original Price'] || row['Preço original']  || row['Harga Asli'])
  const precoUnitario = precoAcordado > 0 ? precoAcordado : precoOriginal
  const valorBruto    = precoUnitario * quantidade

  const cupomVendedor  = Math.abs(num(row['Cupom do vendedor'] || row['Seller Voucher'] || row['Voucher Seller'] || 0))
  const comissaoShopee = Math.abs(num(row['Shopee Commission'] || row['Taxa de comissão bruta'] || row['Komisi Shopee'] || 0))
  const taxaServico    = Math.abs(num(row['Shopee Fee']        || row['Taxa de serviço bruta']  || row['Biaya Shopee'] || 0))
  const taxaShopeeTotal = cupomVendedor + comissaoShopee + taxaServico
  const valorLiquido   = num(row['Final Amount Received'] || row['Total global'] || row['Total Diterima'] || 0)

  const lojaRaw = String(row['Store Name'] || row['Loja'] || row['LOJA'] || '').trim().toUpperCase()
  const loja = LOJAS.find(l => lojaRaw.includes(l.split(' ')[0].toUpperCase())) || lojaRaw || LOJAS[0]

  return {
    pedido: numPedido, status, data, loja,
    sku: skuVenda || skuPrinc, produto: nomeProd, quantidade,
    _preco_unitario: precoUnitario, _preco_original: precoOriginal,
    valor_bruto: valorBruto, comissao_shopee: taxaShopeeTotal, valor_liquido: valorLiquido,
  }
}

export default function FinanceiroPage() {
  const [rows,       setRows]       = useState<any[]>([])
  const [skuMap,     setSkuMap]     = useState<any[]>([])
  const [estoque,    setEstoque]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: string } | null>(null)
  const [filterLoja, setFilterLoja] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [showCfg,    setShowCfg]    = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [periodo,    setPeriodo]    = useState('personalizado')
  const [buscaPedido,   setBuscaPedido]   = useState('')
  const [familiaFiltro, setFamiliaFiltro] = useState('Todas')
  const fileRef = useRef<HTMLInputElement>(null)

  // FIX: hook centralizado — mesmo valor do DRE e demais páginas
  const { imposto, impostoInput, setImpostoInput, salvarImposto } = useTaxRate()

  const [form, setForm] = useState({
    data: '', loja: LOJAS[0], pedido: '', sku: '', produto: '',
    quantidade: 1, preco_unitario: '', valor_bruto: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, mapRes, estRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000),
      supabase.from('sku_map').select('*'),
      supabase.from('estoque').select('*'),
    ])
    setRows(finRes.data || [])
    setSkuMap(mapRes.data || [])
    setEstoque(estRes.data || [])
    setLoading(false)
  }

  function calcCustoProduto(skuVendido: string, quantidade: number): number {
    if (!skuVendido) return 0
    const componentes = skuMap.filter(m => m.sku_venda === skuVendido)
    if (!componentes.length) return 0
    const custoProd = componentes.reduce((total, comp) => {
      const prod = estoque.find(e => e.sku_base === comp.sku_base)
      if (!prod) return total
      return total + (prod.custo || 0) * (comp.quantidade || 1) * quantidade
    }, 0)
    // custo_embalagem é cadastrado separado do custo unitário (ver aba Produtos Base)
    const primeiroComp = componentes[0]
    const prodPrincipal = estoque.find(e => e.sku_base === primeiroComp?.sku_base)
    return custoProd + (prodPrincipal?.custo_embalagem || 0)
  }

  const showToast = (msg: string, type = 'ok') => setToast({ msg, type })

  function aplicarPeriodo(p: string) {
    setPeriodo(p)
    const hoje = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    if (p === 'hoje') { setDateFrom(fmt(hoje)); setDateTo(fmt(hoje)) }
    else if (p === 'ontem') { const d = new Date(hoje); d.setDate(d.getDate() - 1); setDateFrom(fmt(d)); setDateTo(fmt(d)) }
    else if (p === 'semana') { const d = new Date(hoje); d.setDate(d.getDate() - 6); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'mes') { const d = new Date(hoje); d.setDate(d.getDate() - 29); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'tudo') { setDateFrom(''); setDateTo('') }
  }

  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array' })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: false, defval: '' })

    if (jsonRows.length > 0) {
      console.log('[DEBUG] Keys da linha 1:', Object.keys(jsonRows[0]))
    }

    const parsed = jsonRows.map(row => parseShopeeRow(row)).filter((r): r is NonNullable<typeof r> => r !== null)
    console.log('[DEBUG] Total linhas:', jsonRows.length, '| Válidas:', parsed.length)

    if (!parsed.length) { showToast('Nenhum pedido válido encontrado. Verifique o arquivo e os status.', 'err'); return }

    setSaving(true)
    const comUpsert = parsed.map(p => ({
      pedido: p.pedido, data: p.data, loja: p.loja, sku: p.sku,
      produto: p.produto, quantidade: p.quantidade, valor_bruto: p.valor_bruto,
      desconto: p.desconto || 0, frete: p.frete || 0,
      comissao_shopee: p.comissao_shopee || 0, valor_liquido: p.valor_liquido || 0,
    }))

    const { error } = await supabase.from('financeiro').upsert(comUpsert, { onConflict: 'pedido,sku' })
    setSaving(false)
    if (error) { showToast('Erro ao salvar: ' + error.message, 'err'); return }
    showToast(`✅ ${parsed.length} pedidos importados com sucesso!`)
    loadData()
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addManual() {
    if (!form.data || !form.pedido || !form.sku || !form.valor_bruto) {
      showToast('Preencha data, pedido, SKU e valor', 'err'); return
    }
    setSaving(true)
    const { error } = await supabase.from('financeiro').insert({
      pedido: form.pedido, data: form.data, loja: form.loja, sku: form.sku,
      produto: form.produto, quantidade: +form.quantidade,
      valor_bruto: +form.valor_bruto, desconto: 0, frete: 0,
      comissao_shopee: 0, taxas_shopee: 0, valor_liquido: +form.valor_bruto,
    })
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Pedido adicionado!')
    setForm(f => ({ ...f, pedido: '', sku: '', produto: '', quantidade: 1, preco_unitario: '', valor_bruto: '' }))
    loadData()
  }

  async function deletePedido(id: number) {
    await supabase.from('financeiro').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function limparPeriodo() {
    if (!dateFrom && !dateTo) { showToast('Selecione um período para limpar', 'err'); return }
    let q = supabase.from('financeiro').delete()
    if (dateFrom) q = q.gte('data', dateFrom) as any
    if (dateTo)   q = q.lte('data', dateTo)   as any
    const { error } = await q
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Período limpo!')
    setConfirmDel(false)
    loadData()
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (filterLoja !== 'Todas' && r.loja !== filterLoja) return false
    if (dateFrom && r.data < dateFrom) return false
    if (dateTo   && r.data > dateTo)   return false
    // Busca por ID do pedido ou SKU
    if (buscaPedido && !String(r.pedido || '').toLowerCase().includes(buscaPedido.toLowerCase())
                    && !String(r.sku    || '').toLowerCase().includes(buscaPedido.toLowerCase())) return false
    if (familiaFiltro !== 'Todas') {
      const familia = SKU_FAMILIA[String(r.sku || '').toUpperCase()] || 'Outros'
      if (familia !== familiaFiltro) return false
    }
    return true
  }).map(r => {
    const recBruta   = r.valor_bruto || 0
    const taxaShopee = (r.comissao_shopee && r.comissao_shopee > 0)
      ? r.comissao_shopee
      : recBruta * TAXA_SHOPEE
    const cProd      = calcCustoProduto(r.sku || '', r.quantidade || 1)
    // FIX: imposto do hook, não hardcoded
    const imp        = recBruta * imposto
    const custoTotal = taxaShopee + cProd + imp
    const lucroOp    = recBruta - custoTotal
    const margem     = recBruta > 0 ? lucroOp / recBruta : 0
    return { ...r, recBruta, taxaShopee, custoProd: cProd, imp, custoTotal, lucroOp, margem }
  }), [rows, skuMap, estoque, filterLoja, dateFrom, dateTo, imposto, buscaPedido, familiaFiltro])

  const totRec  = filtered.reduce((s, r) => s + r.recBruta, 0)
  const totLuc  = filtered.reduce((s, r) => s + r.lucroOp, 0)
  const totTaxa = filtered.reduce((s, r) => s + r.taxaShopee, 0)
  const totImp  = filtered.reduce((s, r) => s + r.imp, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>💰 Financeiro — Pedidos Shopee</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCfg(!showCfg)} style={S.btnSm as any}>⚙️ Configurar</button>
        <button onClick={() => {
          const cols = ['data', 'loja', 'pedido', 'sku', 'produto', 'quantidade', 'valor_bruto', 'comissao_shopee', 'taxas_shopee', 'valor_liquido']
          const header = cols.join(';')
          const csvRows = filtered.map((p: any) => cols.map((c: string) => `"${(p as any)[c] ?? ''}"`).join(';'))
          const csv = [header, ...csvRows].join('\n')
          const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = 'financeiro.csv'; a.click()
          URL.revokeObjectURL(url)
        }} style={S.btnSm as any}>⬇ CSV</button>
        <button onClick={() => setShowForm(!showForm)} style={S.btnSm as any}>+ Pedido Manual</button>
        <button onClick={() => fileRef.current?.click()} style={S.btn as any} disabled={saving}>
          {saving ? '⏳ Importando...' : '📊 Importar Excel Shopee'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} style={{ display: 'none' }} />
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterLoja} onChange={e => setFilterLoja(e.target.value)} style={{ ...S.inp, width: 180 } as any}>
          <option value="Todas">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* Filtro de família */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FAMILIAS_LISTA.map(f => {
            const ativo = familiaFiltro === f
            const cor   = FAMILIA_CORES[f] || '#ff6600'
            return (
              <button key={f} onClick={() => setFamiliaFiltro(f)} style={{
                background: ativo ? cor + '22' : 'transparent',
                border: `1px solid ${ativo ? cor : '#2a2a3a'}`,
                color: ativo ? cor : '#555',
                borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                fontSize: 11, fontWeight: ativo ? 700 : 400,
              }}>{f}</button>
            )
          })}
        </div>
        {(['hoje', 'ontem', 'semana', 'mes', 'tudo', 'personalizado'] as const).map(p => (
          <button key={p} onClick={() => aplicarPeriodo(p)} style={{ background: periodo === p ? '#ff6600' : '#13131e', color: periodo === p ? '#fff' : '#9090aa', border: `1px solid ${periodo === p ? '#ff6600' : '#2a2a3a'}`, borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
            {p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : p === 'semana' ? 'Última Semana' : p === 'mes' ? 'Último Mês' : p === 'tudo' ? 'Tudo' : 'Personalizado'}
          </button>
        ))}
        {periodo === 'personalizado' && <>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 150 } as any} />
          <span style={{ color: '#555', fontSize: 12 }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 150 } as any} />
        </>}
        {/* Busca por ID do pedido ou SKU */}
        <div style={{ position: 'relative' as any, display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute' as any, left: 10, fontSize: 13, color: '#55556a' }}>🔍</span>
          <input
            value={buscaPedido}
            onChange={e => setBuscaPedido(e.target.value)}
            placeholder="Buscar por ID do pedido ou SKU..."
            style={{ ...S.inp, width: 260, paddingLeft: 30 } as any}
          />
          {buscaPedido && (
            <button onClick={() => setBuscaPedido('')}
              style={{ position: 'absolute' as any, right: 8, background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
          )}
        </div>
        <button onClick={() => setConfirmDel(true)} style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 11, marginLeft: 'auto' }}>🗑️ Excluir Período</button>
      </div>

      {/* PAINEL CONFIGURAÇÕES */}
      {showCfg && (
        <div style={{ ...S.card, marginBottom: 16, background: '#0f1a0f', border: '1px solid #22c55e33' }}>
          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 12 }}>⚙️ CONFIGURAÇÕES DE CÁLCULO</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={S.label}>Imposto sobre Receita (%)</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" value={impostoInput} onChange={e => setImpostoInput(e.target.value)}
                  style={{ ...S.inp, width: 80 } as any} step="0.1" min="0" max="50" />
                <span style={{ fontSize: 12, color: '#55556a' }}>%</span>
                {/* FIX: salvarImposto do hook garante persistência e sync entre páginas */}
                <button onClick={() => { salvarImposto(); showToast('Imposto salvo: ' + impostoInput + '%') }}
                  style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                  ✓ Salvar
                </button>
              </div>
            </div>
            <div>
              <label style={S.label}>Custo Embalagem Adicional (R$/pedido)</label>
              <input type="number" value={0} disabled style={{ ...S.inp, width: 120 } as any} step="0.01" min="0" />
            </div>
            <div style={{ fontSize: 11, color: '#555', padding: '8px 12px', background: '#13131e', borderRadius: 6 }}>
              <div>Taxa Shopee: <strong style={{ color: '#ff9933' }}>20%</strong></div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>Taxa fixa inclusa na coluna Taxa Shop do Excel</div>
            </div>
          </div>
        </div>
      )}

      {/* FORM MANUAL */}
      {showForm && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 600 }}>+ ADICIONAR PEDIDO MANUALMENTE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            {([
              ['Data', 'date', 'data'], ['Nº Pedido', 'text', 'pedido'],
              ['SKU', 'text', 'sku'], ['Produto', 'text', 'produto'],
              ['Qtd', 'number', 'quantidade'], ['Valor Unit R$', 'number', 'preco_unitario'],
              ['Valor Bruto R$', 'number', 'valor_bruto'],
            ] as [string, string, string][]).map(([lbl, type, field]) => (
              <div key={field}>
                <label style={S.label}>{lbl}</label>
                <input type={type} value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={S.inp as any} step={type === 'number' ? '0.01' : undefined} />
              </div>
            ))}
            <div>
              <label style={S.label}>Loja</label>
              <select value={form.loja} onChange={e => setForm(f => ({ ...f, loja: e.target.value }))} style={S.inp as any}>
                {LOJAS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={S.btn as any} onClick={addManual} disabled={saving}>Adicionar Pedido</button>
            <button style={S.btnSm as any} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR EXCLUSÃO */}
      {confirmDel && (
        <div style={{ background: '#1a0a0a', border: '1px solid #ef444444', borderRadius: 10, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
            Excluir {filtered.length} pedido(s) do período {dateFrom ? dateFrom.split('-').reverse().join('/') : '...'} até {dateTo ? dateTo.split('-').reverse().join('/') : '...'}?
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={() => setConfirmDel(false)} style={{ background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Cancelar</button>
            <button onClick={limparPeriodo} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>✓ Confirmar Exclusão</button>
          </div>
        </div>
      )}

      {/* TOTALIZADOR */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, padding: '8px 14px', background: '#13131e', borderRadius: 8, border: '1px solid #2a2a3a', fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#555' }}>{N(filtered.length)} linhas</span>
        <span style={{ color: '#ff9933', fontFamily: 'monospace', fontWeight: 700 }}>Receita: {R(totRec)}</span>
        <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>Taxas: {R(totTaxa)}</span>
        <span style={{ color: '#888', fontFamily: 'monospace' }}>Imposto: {R(totImp)}</span>
        <span style={{ color: totLuc >= 0 ? '#22c55e' : '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>Lucro Op: {R(totLuc)}</span>
        <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>Margem: {P(totRec > 0 ? totLuc / totRec : 0)}</span>
      </div>

      {/* TABELA PRINCIPAL */}
      <div style={S.card}>
        <Table
          headers={['Data', 'Loja', 'Pedido', 'SKU', 'Produto', 'Qtd', 'Vl Unit', 'Rec Bruta', 'Taxa Shop', 'Renda Est.', 'Custo Prod', 'Imposto', 'Custo Total', 'Lucro Op', 'Margem', '']}
          rows={filtered.map(p => [
            D(p.data),
            <span style={{ color: LOJA_COLORS[p.loja] || '#ff6600', fontWeight: 600, fontSize: 11 }}>{(p.loja || '').split(' ')[0]}</span>,
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.pedido}</span>,
            <span style={{ fontFamily: 'monospace', color: '#ff6600', fontSize: 11 }}>{p.sku}</span>,
            <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{p.produto}</span>,
            N(p.quantidade),
            R(p.quantidade > 0 ? p.recBruta / p.quantidade : 0),
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{R(p.recBruta)}</span>,
            <span style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{R(p.taxaShopee)}</span>,
            <span style={{ fontFamily: 'monospace', color: '#0ea5e9', fontWeight: 600 }}>{R((p.recBruta || 0) - (p.taxaShopee || 0))}</span>,
            <span style={{ fontFamily: 'monospace' }}>{R(p.custoProd || 0)}</span>,
            <span style={{ fontFamily: 'monospace' }}>{R(p.imp)}</span>,
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{R(p.custoTotal)}</span>,
            <span style={{ fontFamily: 'monospace', color: p.lucroOp >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{R(p.lucroOp)}</span>,
            <StatusBadge v={p.margem} />,
            <button onClick={() => deletePedido(p.id)} style={S.btnDanger as any}>✕</button>,
          ])}
          emptyMsg="Nenhum pedido. Importe o Excel da Shopee ou adicione manualmente."
        />
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
