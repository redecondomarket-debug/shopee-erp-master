'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTaxRate } from '@/hooks/useTaxRate'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600', 'UNIVERSO DOS ACHADOS': '#0ea5e9', 'MUNDO DOS ACHADOS': '#a855f7'
}
const TAXA_SHOPEE = 0.20

const CATS: Record<string, { label: string; categorias: string[] }> = {
  RECEITA_OP:      { label: 'Receitas Operacionais (manuais)', categorias: ['Vendas de Serviços a Vista','Receitas de Aluguel de Espaço','Receitas Comissões de Assessoria','Receitas de Frete','Outras Vendas a Vista'] },
  CUSTO_VAR:       { label: 'Custos Variáveis (manuais)', categorias: ['Envelope / Lacre / Etiquetas','Frete (Saída)','Fornecedor de Mercadoria','Materiais para Serviços','Difal','Outros Custos Variáveis'] },
  CUSTO_FIXO:      { label: 'Custos Fixos', categorias: ['13º Salário','Água','Alimentação / Refeição','Aluguel','Assessorias','Assinaturas','Combustível','Consultorias','Contabilidade','Cursos e Treinamentos','Despesas com Viagens','Diversos','Encargos Sociais','Energia','Férias','Horas Extras','Internet','IPTU / IPVA / Álvaras','Manutenção','Marketing','Material de Escritório','Material de Limpeza','Pró-Labore Sócios','Salários','Seguros','Serviços de Terceiros','Sistemas / Sites','Taxas e Tarifas','Telefonia','Treinamentos'] },
  RECEITA_NAOOPER: { label: 'Receitas Não Operacionais', categorias: ['Outras Receitas','Resgate Aplicação Financeira','Juros Aplicação Financeira','Entrada Empréstimos'] },
  DESP_NAOOPER:    { label: 'Despesas Não Operacionais', categorias: ['Aplicação / Investimento','Contas Atrasadas','Distribuição de Lucros','Outras Saídas','Parcela Empréstimo','Reserva de Emergência'] },
}

const TIPO_COR: Record<string, string> = {
  RECEITA_OP: '#22c55e', CUSTO_VAR: '#f59e0b', CUSTO_FIXO: '#ef4444',
  RECEITA_NAOOPER: '#0ea5e9', DESP_NAOOPER: '#a855f7',
}

const PIZZA_CORES = ['#ff6600','#0ea5e9','#a855f7','#22c55e','#f59e0b','#ef4444','#06b6d4','#84cc16','#f97316','#8b5cf6','#ec4899','#14b8a6']

const R  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const Pf = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`

const S: Record<string, React.CSSProperties> = {
  card:     { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:       { padding: '9px 12px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 0.8, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:       { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:      { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any, width: '100%' },
  btn:      { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:    { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnGhost: { background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontSize: 12 },
  label:    { fontSize: 11, color: '#55556a', marginBottom: 5, display: 'block', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as any },
}

type Lancamento = { id: string; data: string; loja: string; tipo: string; categoria: string; descricao: string; valor: number }

function Toast({ msg, type, onClose }: any) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [])
  const cor = type === 'err' ? '#ef4444' : '#22c55e'
  return <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#16161f', border: `1px solid ${cor}44`, borderRadius: 10, padding: '12px 20px', color: cor, fontWeight: 700, fontSize: 13, zIndex: 100 }}>{type === 'err' ? '❌' : '✅'} {msg}</div>
}

// ── Pizza SVG ─────────────────────────────────────────────────────────────────
function PizzaCustosFixos({ itens }: { itens: { label: string; v: number; cor: string }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = itens.reduce((s, i) => s + i.v, 0)
  if (total === 0) return <div style={{ color: '#555', textAlign: 'center', padding: 32, fontSize: 12 }}>Nenhum custo fixo lançado</div>
  const RO = 80, RI = 48, CX = 100, CY = 90
  let ang = -Math.PI / 2
  const slices = itens.map((item, idx) => {
    const pct = item.v / total
    // Quando há 1 único item (pct = 1), arc de 360° quebra — usar 99.99%
    const arcPct = pct >= 1 ? 0.9999 : pct
    const s = ang, e = ang + arcPct * 2 * Math.PI
    ang = e
    const x1 = CX + RO * Math.cos(s), y1 = CY + RO * Math.sin(s)
    const x2 = CX + RO * Math.cos(e), y2 = CY + RO * Math.sin(e)
    const ix1 = CX + RI * Math.cos(s), iy1 = CY + RI * Math.sin(s)
    const ix2 = CX + RI * Math.cos(e), iy2 = CY + RI * Math.sin(e)
    const lg = arcPct > 0.5 ? 1 : 0
    const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${RO} ${RO} 0 ${lg} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${RI} ${RI} 0 ${lg} 0 ${ix1} ${iy1} Z`
    return { ...item, pct, path, idx }
  })
  const hItem = hover !== null ? slices[hover] : null
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <svg width={200} height={180} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.cor} opacity={hover === null || hover === i ? 1 : 0.3}
            style={{ cursor: 'pointer', transition: 'opacity .15s' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        {hItem ? (
          <>
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize={9} fill="#e2e2f0" fontWeight={700}>{hItem.label.slice(0,12)}</text>
            <text x={CX} y={CY + 6} textAnchor="middle" fontSize={10} fill={hItem.cor} fontWeight={800}>{R(hItem.v)}</text>
            <text x={CX} y={CY + 20} textAnchor="middle" fontSize={9} fill="#55556a">{Pf(hItem.pct)}</text>
          </>
        ) : (
          <>
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize={9} fill="#55556a">Total fixos</text>
            <text x={CX} y={CY + 12} textAnchor="middle" fontSize={11} fill="#e2e2f0" fontWeight={700}>{R(total)}</text>
          </>
        )}
      </svg>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 180 }}>
        {slices.map((s, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 4, cursor: 'default', opacity: hover === null || hover === i ? 1 : 0.35, transition: 'opacity .15s' }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.cor, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 10, color: '#9090aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#e2e2f0', flexShrink: 0 }}>{Pf(s.pct)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Seção DRE ─────────────────────────────────────────────────────────────────
function SecaoDRE({ titulo, cor, itens, total, totalRec, totalSecao, mesAnterior }: {
  titulo: string; cor: string
  itens: { label: string; v: number; vAnt?: number }[]
  total: number; totalRec: number; totalSecao?: number; mesAnterior?: number
}) {
  const [open, setOpen] = useState(true)
  const itensFiltrados = itens.filter(i => i.v > 0)
  const maxItem = Math.max(...itensFiltrados.map(i => i.v), 1)
  const varMes = mesAnterior != null && mesAnterior > 0 ? ((total - mesAnterior) / mesAnterior) * 100 : null

  return (
    <div style={{ marginBottom: 4 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: cor + '18', borderLeft: `3px solid ${cor}`, cursor: 'pointer', borderRadius: 6, marginBottom: open ? 2 : 0 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: cor }}>{titulo}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {varMes !== null && (
            <span style={{ fontSize: 10, fontWeight: 700, color: varMes <= 0 ? '#22c55e' : '#ef4444' }}>
              {varMes > 0 ? '▲' : '▼'} {Math.abs(varMes).toFixed(1)}% vs ant.
            </span>
          )}
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: cor }}>{R(total)}</span>
          {totalRec > 0 && <span style={{ fontSize: 10, color: '#44445a' }}>{Pf(Math.abs(total) / totalRec)} receita</span>}
          <span style={{ color: '#555', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && itensFiltrados.map((item, i) => {
        const pctRec   = totalRec > 0 ? item.v / totalRec : 0
        const pctSec   = totalSecao && totalSecao > 0 ? item.v / totalSecao : 0
        const pctBarra = item.v / maxItem
        const varItem  = item.vAnt != null && item.vAnt > 0 ? ((item.v - item.vAnt) / item.vAnt) * 100 : null
        return (
          <div key={i} style={{ padding: '8px 16px 8px 24px', borderBottom: '1px solid #1a1a26' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: '#9090aa' }}>{item.label}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {varItem !== null && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: varItem <= 0 ? '#22c55e' : '#ef4444' }}>
                    {varItem > 0 ? '▲' : '▼'} {Math.abs(varItem).toFixed(1)}%
                  </span>
                )}
                {totalSecao && totalSecao > 0 && (
                  <span style={{ fontSize: 10, color: '#55556a', background: '#1a1a26', borderRadius: 3, padding: '1px 5px' }}>{Pf(pctSec)} seção</span>
                )}
                {totalRec > 0 && (
                  <span style={{ fontSize: 10, color: '#44445a' }}>{Pf(pctRec)} receita</span>
                )}
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2e2f0', minWidth: 85, textAlign: 'right' as any }}>{R(item.v)}</span>
              </div>
            </div>
            <div style={{ height: 3, background: '#1a1a26', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${pctBarra * 100}%`, background: cor, borderRadius: 2, opacity: 0.65, transition: 'width .4s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Linha resultado ───────────────────────────────────────────────────────────
function LinhaResultado({ label, v, cor, totalRec, vAnt }: { label: string; v: number; cor: string; totalRec: number; vAnt?: number }) {
  const varMes = vAnt != null && vAnt !== 0 ? ((v - vAnt) / Math.abs(vAnt)) * 100 : null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', background: cor + '12', borderLeft: `4px solid ${cor}`, borderRadius: 6, marginBottom: 6 }}>
      <span style={{ fontWeight: 800, fontSize: 14, color: cor }}>{label}</span>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {varMes !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: varMes >= 0 ? '#22c55e' : '#ef4444' }}>
            {varMes >= 0 ? '▲' : '▼'} {Math.abs(varMes).toFixed(1)}% vs ant.
          </span>
        )}
        {totalRec > 0 && <span style={{ fontSize: 11, color: '#44445a' }}>{Pf(v / totalRec)}</span>}
        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: cor }}>{R(v)}</span>
      </div>
    </div>
  )
}

function mesAnteriorRange(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) return null
  const d1 = new Date(dateFrom), d2 = new Date(dateTo)
  const dias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
  const antTo = new Date(d1); antTo.setDate(antTo.getDate() - 1)
  const antFrom = new Date(antTo); antFrom.setDate(antFrom.getDate() - dias + 1)
  return { from: antFrom.toISOString().slice(0,10), to: antTo.toISOString().slice(0,10) }
}

export default function ResultadoPage() {
  const [financeiro,  setFinanceiro]  = useState<any[]>([])
  const [ads,         setAds]         = useState<any[]>([])
  const [skuMapData,  setSkuMapData]  = useState<any[]>([])
  const [estoque,     setEstoque]     = useState<any[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [showHist, setShowHist] = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editVals, setEditVals] = useState<Partial<Lancamento>>({})
  const _hoje = new Date(), _fmt = (d: Date) => d.toISOString().slice(0,10)
  const _d29  = new Date(_hoje); _d29.setDate(_d29.getDate()-29)
  const [dateFrom, setDateFrom] = useState(_fmt(_d29))
  const [dateTo,   setDateTo]   = useState(_fmt(_hoje))
  const [periodo,  setPeriodo]  = useState('mes')
  const [lojaFilt, setLojaFilt] = useState('Todas')
  const FORM_EMPTY = { data: new Date().toISOString().slice(0,10), loja: 'GERAL', tipo: 'CUSTO_FIXO', categoria: '', categoriaCustom: '', descricao: '', valor: '' }
  const [form, setForm] = useState(FORM_EMPTY)
  const [catCustom, setCatCustom] = useState(false)
  const { imposto } = useTaxRate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [finRes, adsRes, mapRes, estRes, lancRes] = await Promise.all([
      supabase.from('financeiro').select('*').limit(10000),
      supabase.from('ads').select('*'),
      supabase.from('sku_map').select('*'),
      supabase.from('estoque').select('*'),
      supabase.from('lancamentos').select('*').order('data', { ascending: false }),
    ])
    setFinanceiro(finRes.data || [])
    setAds(adsRes.data || [])
    setSkuMapData(mapRes.data || [])
    setEstoque(estRes.data || [])
    setLancamentos(lancRes.data || [])
    setLoading(false)
  }

  function aplicarPeriodo(p: string) {
    setPeriodo(p)
    const hoje = new Date(), fmt = (d: Date) => d.toISOString().slice(0,10)
    if (p === 'hoje')        { setDateFrom(fmt(hoje)); setDateTo(fmt(hoje)) }
    else if (p === 'ontem')  { const d = new Date(hoje); d.setDate(d.getDate()-1); setDateFrom(fmt(d)); setDateTo(fmt(d)) }
    else if (p === 'semana') { const d = new Date(hoje); d.setDate(d.getDate()-6); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'mes')    { const d = new Date(hoje); d.setDate(d.getDate()-29); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'tudo')   { setDateFrom(''); setDateTo('') }
  }

  function showToastMsg(msg: string, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  function calcCustoProd(skuVendido: string, quantidade: number): number {
    if (!skuVendido) return 0
    const comps = skuMapData.filter(m => m.sku_venda === skuVendido)
    if (!comps.length) return 0
    const custoProd = comps.reduce((t, c) => {
      const prod = estoque.find(e => e.sku_base === c.sku_base)
      return t + (prod?.custo || 0) * (c.quantidade || 1) * quantidade
    }, 0)
    const prodPrincipal = estoque.find(e => e.sku_base === comps[0]?.sku_base)
    return custoProd + (prodPrincipal?.custo_embalagem || 0)
  }

  const filtrar = (arr: any[], campo: string) => arr.filter(f => {
    if (lojaFilt !== 'Todas' && f.loja !== lojaFilt) return false
    if (dateFrom && f[campo] < dateFrom) return false
    if (dateTo   && f[campo] > dateTo)   return false
    return true
  })

  const finF  = useMemo(() => filtrar(financeiro, 'data'),  [financeiro, lojaFilt, dateFrom, dateTo])
  const adsF  = useMemo(() => filtrar(ads, 'data'),         [ads, lojaFilt, dateFrom, dateTo])
  const lancF = useMemo(() => lancamentos.filter(l => {
    if (lojaFilt !== 'Todas' && l.loja !== 'GERAL' && l.loja !== lojaFilt) return false
    if (dateFrom && l.data < dateFrom) return false
    if (dateTo   && l.data > dateTo)   return false
    return true
  }), [lancamentos, lojaFilt, dateFrom, dateTo])

  const antRange = mesAnteriorRange(dateFrom, dateTo)
  const filtrarAnt = (arr: any[], campo: string) => antRange ? arr.filter(f => {
    if (lojaFilt !== 'Todas' && f.loja !== lojaFilt) return false
    return f[campo] >= antRange.from && f[campo] <= antRange.to
  }) : []
  const finAnt  = useMemo(() => filtrarAnt(financeiro, 'data'), [financeiro, lojaFilt, antRange])
  const adsAnt  = useMemo(() => filtrarAnt(ads, 'data'),        [ads, lojaFilt, antRange])
  const lancAnt = useMemo(() => antRange ? lancamentos.filter(l => {
    if (lojaFilt !== 'Todas' && l.loja !== 'GERAL' && l.loja !== lojaFilt) return false
    return l.data >= antRange.from && l.data <= antRange.to
  }) : [], [lancamentos, lojaFilt, antRange])

  // Totais Shopee
  const shopeeRec   = finF.reduce((s, f) => s + (f.valor_bruto || 0), 0)
  const shopeeTaxas = finF.reduce((s, f) => s + ((f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : (f.valor_bruto || 0) * TAXA_SHOPEE), 0)
  const shopeeCprod = finF.reduce((s, f) => s + calcCustoProd(f.sku || '', f.quantidade || 1), 0)
  const shopeeImp   = shopeeRec * imposto
  const shopeeAds   = adsF.reduce((s, a) => s + (a.investimento || 0), 0)
  const shopeeRecAnt   = finAnt.reduce((s, f) => s + (f.valor_bruto || 0), 0)
  const shopeeTaxasAnt = finAnt.reduce((s, f) => s + ((f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : (f.valor_bruto || 0) * TAXA_SHOPEE), 0)
  const shopeeCprodAnt = finAnt.reduce((s, f) => s + calcCustoProd(f.sku || '', f.quantidade || 1), 0)
  const shopeeImpAnt   = shopeeRecAnt * imposto
  const shopeeAdsAnt   = adsAnt.reduce((s, a) => s + (a.investimento || 0), 0)

  const sumTipo = (lnc: Lancamento[], tipo: string) => lnc.filter(l => l.tipo === tipo).reduce((s, l) => s + (l.valor || 0), 0)
  const sumCat  = (lnc: Lancamento[], tipo: string, cat: string) => lnc.filter(l => l.tipo === tipo && l.categoria === cat).reduce((s, l) => s + (l.valor || 0), 0)
  const customCats = (lnc: Lancamento[], tipo: string) => {
    const base = CATS[tipo]?.categorias || []
    return lnc.filter(l => l.tipo === tipo && !base.includes(l.categoria))
      .reduce((acc: {label: string; v: number}[], l) => {
        const ex = acc.find(a => a.label === l.categoria)
        if (ex) ex.v += l.valor; else acc.push({ label: l.categoria, v: l.valor })
        return acc
      }, [])
  }

  const recOp     = sumTipo(lancF, 'RECEITA_OP'),    recOpAnt     = sumTipo(lancAnt, 'RECEITA_OP')
  const custoVar  = sumTipo(lancF, 'CUSTO_VAR'),     custoVarAnt  = sumTipo(lancAnt, 'CUSTO_VAR')
  const custoFixo = sumTipo(lancF, 'CUSTO_FIXO'),    custoFixoAnt = sumTipo(lancAnt, 'CUSTO_FIXO')
  const recNaoOp  = sumTipo(lancF, 'RECEITA_NAOOPER'), recNaoOpAnt  = sumTipo(lancAnt, 'RECEITA_NAOOPER')
  const despNaoOp = sumTipo(lancF, 'DESP_NAOOPER'),  despNaoOpAnt = sumTipo(lancAnt, 'DESP_NAOOPER')

  const totalRecOp  = shopeeRec + recOp,    totalRecOpAnt  = shopeeRecAnt + recOpAnt
  const totalCusVar = shopeeTaxas + shopeeCprod + shopeeImp + shopeeAds + custoVar
  const totalCusVarAnt = shopeeTaxasAnt + shopeeCprodAnt + shopeeImpAnt + shopeeAdsAnt + custoVarAnt
  const margContrib = totalRecOp - totalCusVar, margContribAnt = totalRecOpAnt - totalCusVarAnt
  const resultOp    = margContrib - custoFixo,  resultOpAnt    = margContribAnt - custoFixoAnt
  const resultLiq   = resultOp + recNaoOp - despNaoOp, resultLiqAnt = resultOpAnt + recNaoOpAnt - despNaoOpAnt

  const pizzaFixos = useMemo(() => {
    const cats = CATS.CUSTO_FIXO.categorias.map((c, i) => ({ label: c, v: sumCat(lancF, 'CUSTO_FIXO', c), cor: PIZZA_CORES[i % PIZZA_CORES.length] })).filter(i => i.v > 0)
    const custom = customCats(lancF, 'CUSTO_FIXO').map((c, i) => ({ ...c, cor: PIZZA_CORES[(cats.length + i) % PIZZA_CORES.length] }))
    return [...cats, ...custom]
  }, [lancF])

  async function salvar() {
    const cat = catCustom ? form.categoriaCustom : form.categoria
    if (!form.data || !cat || !form.valor || +form.valor <= 0) { showToastMsg('Preencha data, categoria e valor', 'err'); return }
    setSaving(true)
    const { error } = await supabase.from('lancamentos').insert({ data: form.data, loja: form.loja, tipo: form.tipo, categoria: cat, descricao: form.descricao, valor: +form.valor })
    setSaving(false)
    if (error) { showToastMsg('Erro ao salvar', 'err'); return }
    showToastMsg('Lançamento salvo!'); setForm(FORM_EMPTY); setCatCustom(false); setShowForm(false); load()
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('lancamentos').delete().eq('id', id)
    load(); showToastMsg('Lançamento removido!')
  }

  async function salvarEdit() {
    if (!editId) return
    setSaving(true)
    await supabase.from('lancamentos').update({ data: editVals.data, loja: editVals.loja, tipo: editVals.tipo, categoria: editVals.categoria, descricao: editVals.descricao, valor: editVals.valor }).eq('id', editId)
    setSaving(false); setEditId(null); load(); showToastMsg('Atualizado!')
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div style={{ padding: '20px 24px', boxSizing: 'border-box' as any }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8' }}>📊 Resultado do Exercício</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>
            DRE completo · Shopee automático + lançamentos manuais
            {antRange && <span style={{ marginLeft: 8, color: '#33334a' }}>· comparando com {antRange.from.slice(8,10)}/{antRange.from.slice(5,7)} a {antRange.to.slice(8,10)}/{antRange.to.slice(5,7)}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowHist(true)} style={S.btnSm}>📋 Histórico</button>
          <button onClick={() => setShowForm(!showForm)} style={S.btn}>+ Novo Lançamento</button>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={lojaFilt} onChange={e => setLojaFilt(e.target.value)} style={{ ...S.inp, width: 200 } as any}>
          <option value="Todas">Todas as lojas</option>
          {LOJAS.map(l => <option key={l}>{l}</option>)}
        </select>
        {(['hoje','ontem','semana','mes','tudo','personalizado'] as const).map(p => (
          <button key={p} onClick={() => aplicarPeriodo(p)} style={{ background: periodo === p ? '#ff6600' : '#13131e', color: periodo === p ? '#fff' : '#9090aa', border: `1px solid ${periodo === p ? '#ff6600' : '#2a2a3a'}`, borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
            {p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : p === 'semana' ? 'Última Semana' : p === 'mes' ? 'Último Mês' : p === 'tudo' ? 'Tudo' : 'Personalizado'}
          </button>
        ))}
        {periodo === 'personalizado' && <>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 150 } as any} />
          <span style={{ color: '#555', fontSize: 12 }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 150 } as any} />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo('') }} style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 11 }}>✕ Limpar</button>}
        </>}
      </div>

      {/* FORM */}
      {showForm && (
        <div style={{ ...S.card, marginBottom: 20, border: '1px solid #ff660033' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff6600', marginBottom: 16 }}>+ Novo Lançamento</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            <div><label style={S.label}>Data</label><input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={S.inp as any} /></div>
            <div><label style={S.label}>Loja / Origem</label>
              <select value={form.loja} onChange={e => setForm(f => ({ ...f, loja: e.target.value }))} style={S.inp as any}>
                <option value="GERAL">Geral (todas)</option>
                {LOJAS.map(l => <option key={l} value={l}>{l === 'KL MARKET' ? 'KL Market' : l === 'UNIVERSO DOS ACHADOS' ? 'Universo' : 'Mundo'}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Tipo</label>
              <select value={form.tipo} onChange={e => { setForm(f => ({ ...f, tipo: e.target.value, categoria: '' })); setCatCustom(false) }} style={S.inp as any}>
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Categoria</label>
              {!catCustom ? (
                <select value={form.categoria} onChange={e => { if (e.target.value === '__NOVA__') { setCatCustom(true); setForm(f => ({ ...f, categoria: '' })) } else setForm(f => ({ ...f, categoria: e.target.value })) }} style={S.inp as any}>
                  <option value="">Selecione...</option>
                  {CATS[form.tipo]?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__NOVA__">+ Nova categoria...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={form.categoriaCustom} onChange={e => setForm(f => ({ ...f, categoriaCustom: e.target.value }))} placeholder="Nome da categoria..." style={{ ...S.inp, flex: 1 } as any} />
                  <button onClick={() => { setCatCustom(false); setForm(f => ({ ...f, categoriaCustom: '' })) }} style={{ ...S.btnGhost, padding: '6px 10px', flexShrink: 0 }}>✕</button>
                </div>
              )}
            </div>
            <div><label style={S.label}>Valor R$</label><input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" style={S.inp as any} /></div>
            <div><label style={S.label}>Descrição (opcional)</label><input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Observação..." style={S.inp as any} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={salvar} disabled={saving} style={S.btn as any}>{saving ? '⏳ Salvando...' : '✓ Salvar Lançamento'}</button>
            <button onClick={() => { setShowForm(false); setForm(FORM_EMPTY); setCatCustom(false) }} style={S.btnGhost as any}>Cancelar</button>
          </div>
        </div>
      )}

      {/* DRE + SIDEBAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>

        {/* DRE */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8', marginBottom: 16 }}>📋 Demonstrativo do Resultado</div>

          <SecaoDRE titulo="(+) Receitas Operacionais" cor="#22c55e" totalRec={totalRecOp} total={totalRecOp} mesAnterior={totalRecOpAnt}
            itens={[
              { label: '🛍️ Vendas Shopee (automático)', v: shopeeRec, vAnt: shopeeRecAnt },
              ...CATS.RECEITA_OP.categorias.map(c => ({ label: c, v: sumCat(lancF,'RECEITA_OP',c), vAnt: sumCat(lancAnt,'RECEITA_OP',c) })),
              ...customCats(lancF,'RECEITA_OP').map(c => ({ ...c, vAnt: sumCat(lancAnt,'RECEITA_OP',c.label) })),
            ]} />

          <div style={{ height: 8 }} />

          <SecaoDRE titulo="(-) Custos Variáveis" cor="#f59e0b" totalRec={totalRecOp} total={totalCusVar} mesAnterior={totalCusVarAnt} totalSecao={totalCusVar}
            itens={[
              { label: '🛍️ Taxas Shopee', v: shopeeTaxas, vAnt: shopeeTaxasAnt },
              { label: '🛍️ Custo Produtos', v: shopeeCprod, vAnt: shopeeCprodAnt },
              { label: '🛍️ Impostos Shopee', v: shopeeImp, vAnt: shopeeImpAnt },
              { label: '🛍️ Ads Shopee', v: shopeeAds, vAnt: shopeeAdsAnt },
              ...CATS.CUSTO_VAR.categorias.map(c => ({ label: c, v: sumCat(lancF,'CUSTO_VAR',c), vAnt: sumCat(lancAnt,'CUSTO_VAR',c) })),
              ...customCats(lancF,'CUSTO_VAR').map(c => ({ ...c, vAnt: sumCat(lancAnt,'CUSTO_VAR',c.label) })),
            ]} />

          <div style={{ height: 12 }} />
          <LinhaResultado label={margContrib >= 0 ? '(=) Margem de Contribuição' : '(=) Margem de Contribuição ⚠️'} v={margContrib} cor={margContrib >= 0 ? '#a78bfa' : '#ef4444'} totalRec={totalRecOp} vAnt={margContribAnt} />
          <div style={{ height: 8 }} />

          <SecaoDRE titulo="(-) Custos Fixos" cor="#ef4444" totalRec={totalRecOp} total={custoFixo} mesAnterior={custoFixoAnt} totalSecao={custoFixo}
            itens={[
              ...CATS.CUSTO_FIXO.categorias.map(c => ({ label: c, v: sumCat(lancF,'CUSTO_FIXO',c), vAnt: sumCat(lancAnt,'CUSTO_FIXO',c) })),
              ...customCats(lancF,'CUSTO_FIXO').map(c => ({ ...c, vAnt: sumCat(lancAnt,'CUSTO_FIXO',c.label) })),
            ]} />

          <div style={{ height: 12 }} />
          <LinhaResultado label="(=) Resultado Operacional" v={resultOp} cor={resultOp >= 0 ? '#0ea5e9' : '#ef4444'} totalRec={totalRecOp} vAnt={resultOpAnt} />

          {recNaoOp > 0 && <><div style={{ height: 8 }} /><SecaoDRE titulo="(+) Receitas Não Operacionais" cor="#0ea5e9" totalRec={totalRecOp} total={recNaoOp} mesAnterior={recNaoOpAnt} itens={CATS.RECEITA_NAOOPER.categorias.map(c => ({ label: c, v: sumCat(lancF,'RECEITA_NAOOPER',c), vAnt: sumCat(lancAnt,'RECEITA_NAOOPER',c) }))} /></>}
          {despNaoOp > 0 && <><div style={{ height: 8 }} /><SecaoDRE titulo="(-) Despesas Não Operacionais" cor="#a855f7" totalRec={totalRecOp} total={despNaoOp} mesAnterior={despNaoOpAnt} itens={CATS.DESP_NAOOPER.categorias.map(c => ({ label: c, v: sumCat(lancF,'DESP_NAOOPER',c), vAnt: sumCat(lancAnt,'DESP_NAOOPER',c) }))} /></>}

          <div style={{ height: 12 }} />
          <LinhaResultado label="(=) Resultado Líquido" v={resultLiq} cor={resultLiq >= 0 ? '#22c55e' : '#ef4444'} totalRec={totalRecOp} vAnt={resultLiqAnt} />
        </div>

        {/* SIDEBAR DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
          {[
            { label: 'Receita Operacional', v: totalRecOp,  vAnt: totalRecOpAnt,   cor: '#ff9933' },
            { label: 'Margem de Contribuição', v: margContrib, vAnt: margContribAnt, cor: margContrib >= 0 ? '#a78bfa' : '#ef4444' },
            { label: 'Custos Fixos',        v: custoFixo,   vAnt: custoFixoAnt,   cor: '#ef4444' },
            { label: 'Resultado Operacional',v: resultOp,   vAnt: resultOpAnt,    cor: resultOp >= 0 ? '#0ea5e9' : '#ef4444' },
            { label: 'Resultado Líquido',   v: resultLiq,   vAnt: resultLiqAnt,   cor: resultLiq >= 0 ? '#22c55e' : '#ef4444' },
          ].map((k, i) => {
            const varPct = k.vAnt !== 0 ? ((k.v - k.vAnt) / Math.abs(k.vAnt)) * 100 : null
            return (
              <div key={i} style={{ ...S.card, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: '#55556a', fontWeight: 600, textTransform: 'uppercase' as any, letterSpacing: 0.8, marginBottom: 4 }}>{k.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: k.cor, fontSize: 16 }}>{R(k.v)}</div>
                    {totalRecOp > 0 && <div style={{ fontSize: 10, color: '#44445a', marginTop: 2 }}>{Pf(k.v / totalRecOp)} da receita</div>}
                  </div>
                  {varPct !== null && antRange && (
                    <div style={{ textAlign: 'right' as any }}>
                      <div style={{ fontSize: 11, color: varPct >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{varPct >= 0 ? '▲' : '▼'} {Math.abs(varPct).toFixed(1)}%</div>
                      <div style={{ fontSize: 9, color: '#33334a' }}>ant. {R(k.vAnt)}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div style={{ ...S.card, minHeight: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c0c0d8', marginBottom: 12 }}>🔴 Distribuição Custos Fixos</div>
            <PizzaCustosFixos itens={pizzaFixos} />
          </div>
        </div>
      </div>

      {/* MODAL HISTÓRICO */}
      {showHist && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ ...S.card, width: '100%', maxWidth: 860, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
              <div><h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#e8e8f8' }}>📋 Histórico de Lançamentos</h3><div style={{ fontSize: 11, color: '#55556a', marginTop: 3 }}>{lancF.length} registros no período</div></div>
              <button onClick={() => { setShowHist(false); setEditId(null) }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 22 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Data','Loja','Tipo','Categoria','Descrição','Valor','Ações'].map(h => <th key={h} style={{ ...S.th, position: 'sticky' as any, top: 0, zIndex: 1 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {lancF.length === 0
                    ? <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#55556a' }}>Nenhum lançamento no período</td></tr>
                    : lancF.map(l => {
                      const isEdit = editId === l.id
                      return (
                        <tr key={l.id} style={{ background: isEdit ? '#13131e' : 'transparent' }}>
                          <td style={S.td}>{isEdit ? <input type="date" value={editVals.data||''} onChange={e => setEditVals(v => ({ ...v, data: e.target.value }))} style={{ ...S.inp, width: 130, padding: '4px 8px', fontSize: 12 }} /> : <span style={{ fontFamily: 'monospace', color: '#9090aa', fontSize: 12 }}>{l.data ? l.data.slice(8,10)+'/'+l.data.slice(5,7) : '—'}</span>}</td>
                          <td style={S.td}><span style={{ fontSize: 11, color: LOJA_COLORS[l.loja] || '#55556a' }}>{l.loja === 'GERAL' ? 'Geral' : l.loja.split(' ')[0]}</span></td>
                          <td style={S.td}><span style={{ background: (TIPO_COR[l.tipo]||'#555')+'22', color: TIPO_COR[l.tipo]||'#555', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{CATS[l.tipo]?.label.split(' ')[0]||l.tipo}</span></td>
                          <td style={S.td}>{isEdit ? <input value={editVals.categoria||''} onChange={e => setEditVals(v => ({ ...v, categoria: e.target.value }))} style={{ ...S.inp, padding: '4px 8px', fontSize: 12 }} /> : <span style={{ fontSize: 12 }}>{l.categoria}</span>}</td>
                          <td style={{ ...S.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{isEdit ? <input value={editVals.descricao||''} onChange={e => setEditVals(v => ({ ...v, descricao: e.target.value }))} style={{ ...S.inp, padding: '4px 8px', fontSize: 12 }} /> : <span style={{ fontSize: 12, color: '#55556a' }}>{l.descricao||'—'}</span>}</td>
                          <td style={{ ...S.td, textAlign: 'right' as any }}>{isEdit ? <input type="number" step="0.01" value={editVals.valor||''} onChange={e => setEditVals(v => ({ ...v, valor: +e.target.value }))} style={{ ...S.inp, width: 90, padding: '4px 8px', fontSize: 12 }} /> : <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{R(l.valor)}</span>}</td>
                          <td style={{ ...S.td, textAlign: 'center' as any }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              {isEdit
                                ? <><button onClick={salvarEdit} disabled={saving} style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>{saving ? '...' : '✓'}</button><button onClick={() => setEditId(null)} style={{ ...S.btnGhost, padding: '5px 8px' }}>✕</button></>
                                : <><button onClick={() => { setEditId(l.id); setEditVals({ data: l.data, loja: l.loja, tipo: l.tipo, categoria: l.categoria, descricao: l.descricao, valor: l.valor }) }} style={{ ...S.btnGhost, padding: '5px 8px', fontSize: 13 }}>✏️</button><button onClick={() => deletar(l.id)} style={{ background: '#ef444412', color: '#ef4444', border: '1px solid #ef444425', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 13 }}>✕</button></>
                              }
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
            <div style={{ paddingTop: 14, borderTop: '1px solid #1e1e2c', flexShrink: 0, marginTop: 8 }}>
              <button onClick={() => { setShowHist(false); setEditId(null) }} style={S.btnGhost as any}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
