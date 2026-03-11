'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20
const TAXA_FIXA   = 4.05
const DEFAULT_IMPOSTO = 0.06

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const R  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P  = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const D  = (s: string) => { if (!s) return ""; const [y,m,d] = String(s).slice(0,10).split("-"); return d && m && y ? `${d}/${m}/${y}` : s }
const N  = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
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

// ─── CÁLCULO (idêntico ao App.js calcPed) ────────────────────────────────────
function calcLinha(recBruta: number, custoProd: number, custoEmb: number, imposto: number) {
  const taxaShopee = recBruta * TAXA_SHOPEE
  const taxaFixa   = TAXA_FIXA
  const imp        = recBruta * imposto
  const custoTotal = taxaShopee + taxaFixa + custoProd + custoEmb + imp
  const lucroOp    = recBruta - custoTotal
  const margem     = recBruta > 0 ? lucroOp / recBruta : 0
  return { taxaShopee, taxaFixa, imp, custoTotal, lucroOp, margem }
}

// ─── PARSER SHOPEE — lê por NOME de coluna (não por índice) ──────────────────
// CORREÇÃO 1: sheet_to_json sem header:1 → cada linha é objeto keyed pelo cabeçalho
// CORREÇÃO 2: usa "Agreed Price" como receita real (não "Original Price")
// CORREÇÃO 3: usa taxas reais da planilha ("Shopee Commission" + "Shopee Fee")
function parseShopeeRow(row: Record<string, any>): any | null {
  // ── Pedido e status (EN + PT) ─────────────────────────────────────────────
  const numPedido = String(row['Order ID'] || row['ID do pedido'] || row['No. Pesanan'] || '').trim()
  const status    = String(row['Order Status'] || row['Status do pedido'] || row['Status Pesanan'] || '').trim()

  // Status válidos — EN, PT e variações
  const statusUpper = status.toUpperCase()
  const statusInvalido = ['CANCELADO', 'CANCELLED', 'CANCELED']
  if (statusInvalido.some(s => statusUpper.includes(s))) return null
  // Aceita qualquer status que não seja cancelado e tenha pedido
  if (!numPedido) return null

  // ── Data (EN + PT) ────────────────────────────────────────────────────────
  const dataRaw = row['Order Creation Date'] || row['Data de criação do pedido'] || row['Tanggal Pembuatan Pesanan'] || ''
  let data = ''
  if (dataRaw) {
    const s = String(dataRaw).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      data = s.slice(0, 10)
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [d, m, y] = s.split('/')
      data = `${y}-${m}-${d}`
    } else if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
      const [d, m, y] = s.split('-')
      data = `${y}-${m}-${d}`
    } else if (!isNaN(Number(s)) && Number(s) > 10000) {
      const dt = new Date(Math.round((Number(s) - 25569) * 86400 * 1000))
      data = dt.toISOString().slice(0, 10)
    }
  }
  if (!data) return null

  // ── Produto e SKU (EN + PT) ───────────────────────────────────────────────
  const nomeProd  = String(row['Product Name'] || row['Nome do Produto'] || row['Nama Produk'] || '').trim()
  const skuVenda  = String(row['Seller SKU'] || row['Número de referência SKU'] || row['SKU Referensi'] || row['SKU'] || '').trim()
  const skuPrinc  = String(row['SKU Reference No.'] || row['Nº de referência do SKU principal'] || skuVenda).trim()

  // ── Quantidade (EN + PT) ──────────────────────────────────────────────────
  const quantidade = parseInt(String(row['Quantity'] || row['Quantidade'] || row['Jumlah'] || '1')) || 1

  // ── Preços (EN + PT) ──────────────────────────────────────────────────────
  const num = (v: any) => parseFloat(String(v || '0').replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0
  const precoAcordado = num(row['Agreed Price']   || row['Preço acordado']  || row['Harga Kesepakatan'])
  const precoOriginal = num(row['Original Price'] || row['Preço original']  || row['Harga Asli'])
  const precoUnitario = precoAcordado > 0 ? precoAcordado : precoOriginal
  const valorBruto    = precoUnitario * quantidade

  // ── Taxas reais (EN + PT) ─────────────────────────────────────────────────
  const comissaoShopee = Math.abs(num(row['Shopee Commission'] || row['Taxa de comissão bruta'] || row['Komisi Shopee'] || 0))
  const taxaShopee     = Math.abs(num(row['Shopee Fee']        || row['Taxa de serviço bruta']  || row['Biaya Shopee'] || 0))
  const valorLiquido   = num(row['Final Amount Received'] || row['Total global'] || row['Total Diterima'] || 0)

  // ── Loja (EN + PT) ────────────────────────────────────────────────────────
  const lojaRaw = String(row['Store Name'] || row['Loja'] || row['LOJA'] || '').trim().toUpperCase()
  const loja = LOJAS.find(l => lojaRaw.includes(l.split(' ')[0].toUpperCase())) || lojaRaw || LOJAS[0]

  return {
    numero_pedido:   numPedido,
    status,
    data,
    loja,
    sku_vendido:     skuVenda  || skuPrinc,
    sku_principal:   skuPrinc,
    nome_produto:    nomeProd,
    quantidade,
    preco_unitario:  precoUnitario,
    preco_original:  precoOriginal,
    receita_bruta:   valorBruto,         // Agreed Price × Qtd
    taxa_shopee:     comissaoShopee,     // Shopee Commission (real)
    taxa_fixa:       taxaShopee,         // Shopee Fee (real)
    valor_liquido:   valorLiquido,       // Final Amount Received (real)
    custo_produto:   0,
    custo_embalagem: 0,
    imposto:         0,
    lucro_operacional: 0,
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
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
  const [imposto,    setImposto]    = useState(DEFAULT_IMPOSTO)
  const [custoEmb,   setCustoEmb]   = useState(0)
  const [showCfg,    setShowCfg]    = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    data: '', loja: LOJAS[0], numero_pedido: '', sku: '', nome_produto: '',
    quantidade: 1, preco_unitario: '', valor_bruto: '', custo_produto: 0, custo_embalagem: 0
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

  // ── Calcula custo do produto cruzando sku_map + estoque ──────────────────
  // custo_embalagem é FIXO por venda (não multiplica pela qtd de componentes)
  function calcCustoProduto(skuVendido: string, quantidade: number): number {
    if (!skuVendido) return 0
    const componentes = skuMap.filter(m => m.sku_venda === skuVendido)
    if (!componentes.length) return 0

    // Custo do produto = Σ (custo_unitario × qtd_componente × qtd_pedido)
    const custoProd = componentes.reduce((total, comp) => {
      const prod = estoque.find(e => e.sku_base === comp.sku_base)
      if (!prod) return total
      return total + (prod.custo || 0) * (comp.quantidade || 1) * quantidade
    }, 0)

    // Custo embalagem = fixo por venda (pega do primeiro componente, não multiplica)
    const primeiroComp = componentes[0]
    const prodPrincipal = estoque.find(e => e.sku_base === primeiroComp?.sku_base)
    const custoEmb = prodPrincipal?.custo_embalagem || 0

    return custoProd + custoEmb
  }

  const showToast = (msg: string, type = 'ok') => setToast({ msg, type })

  // Importar Excel da Shopee — CORREÇÃO 1: lê por nome de coluna
  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array' })
    const ws  = wb.Sheets[wb.SheetNames[0]]

    // sheet_to_json sem header:1 → cada linha é objeto { "Order ID": ..., "Agreed Price": ..., ... }
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: false, defval: '' })

    const parsed = jsonRows
      .map(row => parseShopeeRow(row))
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (!parsed.length) { showToast('Nenhum pedido válido encontrado. Verifique o arquivo e os status.', 'err'); return }

    setSaving(true)
    // Calcula lucro operacional com imposto configurado antes de salvar
    const comUpsert = parsed.map(p => {
      const imp        = p.receita_bruta * imposto
      const embCusto   = custoEmb || 0
      const lucroOp    = p.receita_bruta - p.taxa_shopee - p.taxa_fixa - p.custo_produto - embCusto - imp
      return {
        ...p,
        custo_embalagem:   embCusto,
        imposto:           imp,
        lucro_operacional: lucroOp,
      }
    })

    const { error } = await supabase.from('financeiro').upsert(
      comUpsert,
      { onConflict: 'numero_pedido,sku_vendido' }
    )
    setSaving(false)
    if (error) { showToast('Erro ao salvar: ' + error.message, 'err'); return }
    showToast(`✅ ${parsed.length} pedidos importados com sucesso!`)
    loadData()
    if (fileRef.current) fileRef.current.value = ''
  }

  // Adicionar manual
  async function addManual() {
    if (!form.data || !form.numero_pedido || !form.sku || !form.valor_bruto) {
      showToast('Preencha data, pedido, SKU e valor', 'err'); return
    }
    const recBruta = +form.valor_bruto
    const calc = calcLinha(recBruta, +form.custo_produto, +form.custo_embalagem, imposto)
    setSaving(true)
    const { error } = await supabase.from('financeiro').insert({
      ...form,
      quantidade: +form.quantidade,
      preco_unitario: +form.preco_unitario || recBruta,
      valor_bruto: recBruta,
      valor_liquido: calc.lucroOp,
    })
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Pedido adicionado!')
    setForm(f => ({ ...f, numero_pedido: '', sku: '', nome_produto: '', quantidade: 1, preco_unitario: '', valor_bruto: '' }))
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

  // Filtrar + calcular: usa taxas reais do banco quando disponíveis, recalcula como fallback
  const filtered = useMemo(() => rows.filter(r => {
    if (filterLoja !== 'Todas' && r.loja !== filterLoja) return false
    if (dateFrom && r.data < dateFrom) return false
    if (dateTo   && r.data > dateTo)   return false
    return true
  }).map(r => {
    const recBruta = r.receita_bruta || r.valor_bruto || 0
    const taxaShopee = (r.taxa_shopee && r.taxa_shopee > 0)
      ? r.taxa_shopee
      : recBruta * TAXA_SHOPEE
    const taxaFixa   = (r.taxa_fixa && r.taxa_fixa > 0)
      ? r.taxa_fixa
      : TAXA_FIXA
    // Custo produto: usa banco se preenchido, senão calcula via sku_map + estoque
    const skuVenda = r.sku_vendido || r.sku || ''
    const custoProdCalc = calcCustoProduto(skuVenda, r.quantidade || 1)
    const cProd      = (r.custo_produto && r.custo_produto > 0) ? r.custo_produto : custoProdCalc
    const cEmb       = (r.custo_embalagem || 0) + (custoEmb || 0)
    const imp        = recBruta * imposto
    const custoTotal = taxaShopee + taxaFixa + cProd + cEmb + imp
    const lucroOp    = recBruta - custoTotal
    const margem     = recBruta > 0 ? lucroOp / recBruta : 0
    return { ...r, recBruta, taxaShopee, taxaFixa, custoProd: cProd, imp, custoTotal, lucroOp, margem }
  }), [rows, skuMap, estoque, filterLoja, dateFrom, dateTo, imposto, custoEmb])

  const totRec  = filtered.reduce((s, r) => s + r.recBruta, 0)
  const totLuc  = filtered.reduce((s, r) => s + r.lucroOp,  0)
  const totTaxa = filtered.reduce((s, r) => s + r.taxaShopee + r.taxaFixa, 0)
  const totImp  = filtered.reduce((s, r) => s + r.imp, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: "20px 24px", width: "100%", boxSizing: "border-box" }}>
      {/* HEADER */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>💰 Financeiro — Pedidos Shopee</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCfg(!showCfg)} style={S.btnSm as any}>⚙️ Configurar</button>
        <button onClick={() => {
          const cols = ['data','loja','numero_pedido','sku_vendido','nome_produto','quantidade','preco_unitario','receita_bruta','taxa_shopee','taxa_fixa','custo_produto','custo_embalagem','imposto','lucro_operacional']
          const header = cols.join(';')
          const rows = filtered.map((p: any) => cols.map((c: string) => `"${(p as any)[c] ?? ''}"`).join(';'))
          const csv = [header, ...rows].join('\n')
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

      {/* PAINEL CONFIGURAÇÕES */}
      {showCfg && (
        <div style={{ ...S.card, marginBottom: 16, background: '#0f1a0f', border: '1px solid #22c55e33' }}>
          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 12 }}>⚙️ CONFIGURAÇÕES DE CÁLCULO</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={S.label}>Imposto sobre Receita (%)</label>
              <input type="number" value={(imposto * 100).toFixed(1)} onChange={e => setImposto(+e.target.value / 100)}
                style={{ ...S.inp, width: 100 } as any} step="0.1" min="0" max="50" />
            </div>
            <div>
              <label style={S.label}>Custo Embalagem Adicional (R$/pedido)</label>
              <input type="number" value={custoEmb} onChange={e => setCustoEmb(+e.target.value)}
                style={{ ...S.inp, width: 120 } as any} step="0.01" min="0" />
            </div>
            <div style={{ fontSize: 11, color: '#555', padding: '8px 12px', background: '#13131e', borderRadius: 6 }}>
              <div>Taxa Shopee: <strong style={{ color: '#ff9933' }}>20%</strong></div>
              <div>Taxa Fixa: <strong style={{ color: '#ff9933' }}>R$ 4,05/pedido</strong></div>
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
              ['Data', 'date', 'data'], ['Nº Pedido', 'text', 'numero_pedido'],
              ['SKU', 'text', 'sku'], ['Produto', 'text', 'nome_produto'],
              ['Qtd', 'number', 'quantidade'], ['Valor Unit R$', 'number', 'preco_unitario'],
              ['Valor Bruto R$', 'number', 'valor_bruto'], ['Custo Prod R$', 'number', 'custo_produto'],
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

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterLoja} onChange={e => setFilterLoja(e.target.value)} style={{ ...S.inp, width: 'auto', fontSize: 12 } as any}>
          <option>Todas</option>{LOJAS.map(l => <option key={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 140, padding: '5px 8px', fontSize: 12 } as any} />
        <span style={{ color: '#555', fontSize: 12 }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 140, padding: '5px 8px', fontSize: 12 } as any} />
        {(dateFrom || dateTo) && (
          confirmDel
            ? <>
                <span style={{ fontSize: 12, color: '#ef4444' }}>Confirmar limpeza?</span>
                <button onClick={limparPeriodo} style={{ ...S.btnDanger, fontSize: 12 } as any}>✓ Sim</button>
                <button onClick={() => setConfirmDel(false)} style={S.btnSm as any}>✕ Não</button>
              </>
            : <button onClick={() => setConfirmDel(true)} style={S.btnDanger as any}>🗑️ Limpar Período</button>
        )}
      </div>

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
          headers={['Data', 'Loja', 'Pedido', 'SKU', 'Produto', 'Qtd', 'Vl Unit', 'Rec Bruta', 'Taxa Shop', 'Taxa Fixa', 'Custo Prod', 'Imposto', 'Custo Total', 'Lucro Op', 'Margem', '']}
          rows={filtered.map(p => [
            D(p.data),
            <span style={{ color: LOJA_COLORS[p.loja] || '#ff6600', fontWeight: 600, fontSize: 11 }}>{(p.loja || '').split(' ')[0]}</span>,
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.numero_pedido}</span>,
            <span style={{ fontFamily: 'monospace', color: '#ff6600', fontSize: 11 }}>{p.sku_vendido || p.sku}</span>,
            <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{p.nome_produto}</span>,
            N(p.quantidade),
            R(p.preco_unitario || 0),
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{R(p.recBruta)}</span>,
            <span style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{R(p.taxaShopee)}</span>,
            <span style={{ fontFamily: 'monospace' }}>{R(p.taxaFixa)}</span>,
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
    </div>
  )
}
