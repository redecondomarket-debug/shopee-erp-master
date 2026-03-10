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
const N  = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  card:      { background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10, padding: 16 },
  th:        { padding: '8px 12px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 0.8, textTransform: 'uppercase' as any, borderBottom: '1px solid #2a2a3a', whiteSpace: 'nowrap' as any },
  td:        { padding: '7px 12px', fontSize: 12.5, borderBottom: '1px solid #1e1e2a', whiteSpace: 'nowrap' as any },
  inp:       { background: '#0f0f13', border: '1px solid #2a2a3a', borderRadius: 6, padding: '7px 10px', color: '#e8e8f0', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' as any },
  btn:       { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:     { background: '#ff660022', color: '#ff6600', border: '1px solid #ff660044', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
  btnDanger: { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
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
    <div style={{ overflowX: 'auto' }}>
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

// ─── COLUNAS EXCEL SHOPEE (índices confirmados pelo usuário) ──────────────────
// Col 1  (0) = ID do pedido
// Col 2  (1) = Status do pedido
// Col 11 (10)= Data de criação do pedido
// Col 13 (12)= Nº de referência do SKU principal
// Col 14 (13)= Nome do Produto
// Col 15 (14)= Número de referência SKU  ← SKU de venda
// Col 17 (16)= Preço original
// Col 18 (17)= Preço acordado
// Col 19 (18)= Quantidade
// Col 38 (37)= Valor Total
// Col 43 (42)= Taxa de comissão bruta
// Col 46 (45)= Taxa de serviço líquida
// Col 47 (46)= Total global  ← valor líquido
// Col 63 (62)= LOJA  ← adicionada manualmente
function parseExcelShopee(rows: any[][]): any[] {
  return rows.map(r => {
    const numPedido  = String(r[0]  || '')
    const status     = String(r[1]  || '')
    const dataRaw    = r[10] || ''
    const skuPrinc   = String(r[12] || '')
    const nomeProd   = String(r[13] || '')
    const sku        = String(r[14] || r[12] || '').trim()
    const precoOrig  = parseFloat(String(r[16] || '0').replace(',', '.')) || 0
    const precoAcord = parseFloat(String(r[17] || '0').replace(',', '.')) || 0
    const quantidade = parseInt(String(r[18] || '1')) || 1
    const valorTotal = parseFloat(String(r[37] || '0').replace(',', '.')) || 0
    const taxaComiss = parseFloat(String(r[42] || '0').replace(',', '.')) || 0
    const taxaServLiq= parseFloat(String(r[45] || '0').replace(',', '.')) || 0
    const totalGlobal= parseFloat(String(r[46] || '0').replace(',', '.')) || 0
    const loja       = String(r[62] || '').trim().toUpperCase() || LOJAS[0]

    // Converter data para YYYY-MM-DD
    let data = ''
    if (dataRaw) {
      const s = String(dataRaw)
      // formato DD/MM/YYYY ou YYYY-MM-DD ou Excel serial
      if (/\d{4}-\d{2}-\d{2}/.test(s)) {
        data = s.slice(0, 10)
      } else if (/\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [d, m, y] = s.split('/')
        data = `${y}-${m}-${d}`
      } else if (!isNaN(Number(s))) {
        // Excel serial date
        const dt = new Date(Math.round((Number(s) - 25569) * 86400 * 1000))
        data = dt.toISOString().slice(0, 10)
      }
    }

    const recBruta = precoAcord > 0 ? precoAcord * quantidade : valorTotal

    return {
      numero_pedido: numPedido,
      status,
      data,
      loja: LOJAS.find(l => loja.includes(l.split(' ')[0])) || loja || LOJAS[0],
      sku,
      sku_principal: skuPrinc,
      nome_produto: nomeProd,
      quantidade,
      preco_unitario: precoAcord || precoOrig,
      valor_bruto: recBruta,
      valor_liquido: totalGlobal || (recBruta - taxaComiss - Math.abs(taxaServLiq)),
      taxa_shopee: taxaComiss,
      taxa_servico: taxaServLiq,
      custo_produto: 0,
      custo_embalagem: 0,
    }
  }).filter(r => r.numero_pedido && r.data)
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [rows,       setRows]       = useState<any[]>([])
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
    const { data } = await supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000)
    setRows(data || [])
    setLoading(false)
  }

  const showToast = (msg: string, type = 'ok') => setToast({ msg, type })

  // Importar Excel da Shopee
  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false })
    // Pular cabeçalho (linha 0)
    const linhas = (data as any[][]).slice(1).filter(r => r[0])
    const parsed = parseExcelShopee(linhas)
    if (!parsed.length) { showToast('Nenhum pedido válido encontrado', 'err'); return }

    setSaving(true)
    // Upsert por numero_pedido + sku para evitar duplicatas
    const { error } = await supabase.from('financeiro').upsert(
      parsed.map(p => ({
        ...p,
        valor_liquido: p.valor_liquido || (p.valor_bruto * (1 - TAXA_SHOPEE) - TAXA_FIXA),
      })),
      { onConflict: 'numero_pedido,sku' }
    )
    setSaving(false)
    if (error) { showToast('Erro ao salvar: ' + error.message, 'err'); return }
    showToast(`${parsed.length} pedidos importados!`)
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

  // Filtrar + calcular com lógica App.js
  const filtered = useMemo(() => rows.filter(r => {
    if (filterLoja !== 'Todas' && r.loja !== filterLoja) return false
    if (dateFrom && r.data < dateFrom) return false
    if (dateTo   && r.data > dateTo)   return false
    return true
  }).map(r => {
    const recBruta = r.valor_bruto || 0
    const cProd    = r.custo_produto    || 0
    const cEmb     = (r.custo_embalagem || 0) + custoEmb
    const calc     = calcLinha(recBruta, cProd, cEmb, imposto)
    return { ...r, ...calc, recBruta }
  }), [rows, filterLoja, dateFrom, dateTo, imposto, custoEmb])

  const totRec  = filtered.reduce((s, r) => s + r.recBruta, 0)
  const totLuc  = filtered.reduce((s, r) => s + r.lucroOp,  0)
  const totTaxa = filtered.reduce((s, r) => s + r.taxaShopee + r.taxaFixa, 0)
  const totImp  = filtered.reduce((s, r) => s + r.imp, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #ff660033', borderTop: '3px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>💰 Financeiro — Pedidos Shopee</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCfg(!showCfg)} style={S.btnSm as any}>⚙️ Configurar</button>
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
        <div style={{ ...S.card, marginBottom: 16 }}>
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
            p.data,
            <span style={{ color: LOJA_COLORS[p.loja] || '#ff6600', fontWeight: 600, fontSize: 11 }}>{(p.loja || '').split(' ')[0]}</span>,
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.numero_pedido}</span>,
            <span style={{ fontFamily: 'monospace', color: '#ff6600', fontSize: 11 }}>{p.sku}</span>,
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
