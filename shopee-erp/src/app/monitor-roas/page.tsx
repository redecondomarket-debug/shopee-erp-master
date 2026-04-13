'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ProdutoBase = { sku_base: string; custo: number; custo_embalagem: number }
type SkuMap      = { sku_venda: string; sku_base: string; quantidade: number }
type FinRow      = { sku: string; quantidade: number; valor_bruto: number; data: string; loja?: string }
type Intervalo   = {
  id?: number
  sku_familia: string
  loja: string
  mes_referencia: string
  numero_intervalo: number
  periodo_label: string
  vendas: number
  pedidos: number
  gasto_ads: number
  cpa_real: number
  meta_roas: number
  orcamento_diario: number
  novo_meta_roas: number
  novo_orcamento_diario: number
  created_at?: string
}
type HistoricoRow = {
  id?: number
  sku_familia: string
  loja: string
  mes_referencia: string
  faturamento: number
  gasto_ads: number
  margem_pct: number
  ajuste_manual: boolean
  created_at?: string
}

// ── Constantes ────────────────────────────────────────────────────────────────
const LOJAS = ['Todas', 'KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COR: Record<string, string> = {
  'KL MARKET': '#ff6600', 'UNIVERSO DOS ACHADOS': '#0ea5e9', 'MUNDO DOS ACHADOS': '#a855f7'
}
const SKU_FAMILIA: Record<string, string> = {
  FM50: 'Formas', FM100: 'Formas', FM200: 'Formas', FM300: 'Formas',
  KIT2TP: 'Tapetes', KIT3TP: 'Tapetes', KIT4TP: 'Tapetes',
  KIT120: 'Saquinhos', KIT240: 'Saquinhos', KIT480: 'Saquinhos',
  KITPS120B: 'Porta-Saquinho', KITPS240B: 'Porta-Saquinho', KITPS480B: 'Porta-Saquinho',
}
const FAMILIAS = ['Formas', 'Tapetes', 'Saquinhos', 'Porta-Saquinho']
const FAMILIA_COR: Record<string, string> = {
  'Formas': '#f59e0b', 'Tapetes': '#a855f7', 'Saquinhos': '#0ea5e9', 'Porta-Saquinho': '#22c55e',
}
const IMPOSTO_PADRAO: Record<string, number> = {
  'KL MARKET': 4, 'UNIVERSO DOS ACHADOS': 4, 'MUNDO DOS ACHADOS': 4, 'Todas': 4,
}
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const INTERVAL_LABELS = ['1º (Dias 1-5)','2º (Dias 6-10)','3º (Dias 11-15)','4º (Dias 16-20)','5º (Dias 21-25)','6º (Dias 26-30)']

// ── Helpers ───────────────────────────────────────────────────────────────────
const R   = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const Pct = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const fmt = (d: Date)   => d.toISOString().slice(0, 10)
const diffPct = (v: number, base: number) => base > 0 ? ((v - base) / base) * 100 : 0

function mesAtual()    { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` }
function mesAnterior() { const n = new Date(); n.setMonth(n.getMonth()-1); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` }
function labelMes(ym: string) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${MESES_PT[parseInt(m)-1]} ${y}`
}
function inicioFimMes(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return { from: fmt(new Date(y, m-1, 1)), to: fmt(new Date(y, m, 0)) }
}
function lojaShort(l: string) {
  if (l === 'KL MARKET') return 'KL'
  if (l === 'UNIVERSO DOS ACHADOS') return 'UNI'
  if (l === 'MUNDO DOS ACHADOS') return 'MUNDO'
  return l
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  inp:   { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 11px', color: '#e2e2f0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as any },
  label: { fontSize: 10, color: '#55556a', marginBottom: 4, display: 'block', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' as any },
  th:    { padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#55556a', letterSpacing: 0.8, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', background: '#13131e', whiteSpace: 'nowrap' as any },
  td:    { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any },
}

function CenarioBadge({ label }: { label: string }) {
  const c = label.includes('✅') ? '#22c55e' : label.includes('⚠️') ? '#f59e0b' : label.includes('💡') ? '#0ea5e9' : '#ef4444'
  return <span style={{ background: c+'18', color: c, border: `1px solid ${c}33`, borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{label}</span>
}

function DiffBadge({ value, base, invertido = false }: { value: number; base: number; invertido?: boolean }) {
  if (!base || !value) return <span style={{ color: '#44445a' }}>—</span>
  const d = diffPct(value, base)
  const ok = invertido ? d <= 0 : d >= 0
  const color = ok ? '#22c55e' : '#ef4444'
  return (
    <span style={{ background: color+'18', color, border: `1px solid ${color}33`, borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
      {d >= 0 ? '+' : ''}{d.toFixed(1)}%
    </span>
  )
}

function Toast({ msg, type, onClose }: { msg: string; type: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, background: type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999, boxShadow: '0 8px 32px #0009' }}>
      {type === 'ok' ? '✅' : '❌'} {msg}
    </div>
  )
}

// ── Componente Principal ──────────────────────────────────────────────────────
export default function MonitorRoasPage() {
  const [familia,      setFamilia]      = useState('Tapetes')
  const [loja,         setLoja]         = useState('Todas')
  const [mesRef,       setMesRef]       = useState(mesAtual())
  const [imposto,      setImposto]      = useState(4)     // % manual por loja
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; type: string } | null>(null)
  const [activeTab,    setActiveTab]    = useState<'calibracao'|'intervalos'|'historico'>('calibracao')

  const [estoque,      setEstoque]      = useState<ProdutoBase[]>([])
  const [skuMapData,   setSkuMapData]   = useState<SkuMap[]>([])
  const [intervalos,   setIntervalos]   = useState<Intervalo[]>([])
  const [historico,    setHistorico]    = useState<HistoricoRow[]>([])

  // Calibração
  const [custoMedio,   setCustoMedio]   = useState(0)
  const [custoInfo,    setCustoInfo]    = useState('')
  const [loadingCusto, setLoadingCusto] = useState(false)
  const [ticketMedio,  setTicketMedio]  = useState(0)
  const [totalVendas,  setTotalVendas]  = useState(0)
  const [totalPedidos, setTotalPedidos] = useState(0)

  // Form intervalo
  const [formInt, setFormInt] = useState<Partial<Intervalo>>({
    numero_intervalo: 1, periodo_label: '', vendas: 0, pedidos: 0,
    gasto_ads: 0, cpa_real: 0, meta_roas: 10, orcamento_diario: 30, novo_meta_roas: 0, novo_orcamento_diario: 0,
    loja: 'KL MARKET',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editHist, setEditHist] = useState<Record<string, Partial<HistoricoRow>>>({})

  const showToast = (msg: string, type = 'ok') => setToast({ msg, type })

  // Quando troca loja, atualiza imposto padrão
  useEffect(() => {
    if (loja !== 'Todas') setImposto(IMPOSTO_PADRAO[loja] ?? 4)
  }, [loja])

  // ── Load base ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from('estoque').select('sku_base,custo,custo_embalagem'),
      supabase.from('sku_map').select('sku_venda,sku_base,quantidade'),
    ]).then(([e, s]) => {
      setEstoque(e.data || [])
      setSkuMapData(s.data || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading) { loadIntervalos(); loadHistorico(); calcCalibracao() }
  }, [familia, loja, mesRef, loading])

  // ── Queries ───────────────────────────────────────────────────────────────
  async function loadIntervalos() {
    let q = supabase.from('monitor_roas_intervalos').select('*')
      .eq('sku_familia', familia).eq('mes_referencia', mesRef).order('numero_intervalo')
    if (loja !== 'Todas') q = q.eq('loja', loja) as any
    const { data } = await q
    setIntervalos(data || [])
  }

  async function loadHistorico() {
    let q = supabase.from('monitor_roas_historico').select('*')
      .eq('sku_familia', familia).order('mes_referencia', { ascending: false }).limit(12)
    // Quando filtro = 'Todas', buscar só registros loja='TODAS' (consolidado)
    // Quando filtro = loja específica, buscar só aquela loja
    const lojaFiltro = loja === 'Todas' ? 'TODAS' : loja
    q = q.eq('loja', lojaFiltro) as any
    const { data } = await q
    setHistorico(data || [])
  }

  // ── Calibração ────────────────────────────────────────────────────────────
  const calcCalibracao = useCallback(async () => {
    setLoadingCusto(true)
    const { from, to } = inicioFimMes(mesRef)
    const skusDaFamilia = Object.entries(SKU_FAMILIA).filter(([,f]) => f === familia).map(([s]) => s)

    let q = supabase.from('financeiro').select('sku,quantidade,valor_bruto,data,loja').gte('data', from).lte('data', to)
    const { data: finRows } = await q

    let rows = ((finRows || []) as FinRow[]).filter(r =>
      skusDaFamilia.includes(String(r.sku || '').toUpperCase())
    )
    if (loja !== 'Todas') rows = rows.filter(r => (r.loja || '').toUpperCase() === loja)

    if (rows.length === 0) {
      setCustoMedio(0); setCustoInfo('Sem vendas no período'); setTicketMedio(0)
      setTotalVendas(0); setTotalPedidos(0); setLoadingCusto(false); return
    }

    function getCustoUnit(sku: string): number {
      const comps = skuMapData.filter(m => m.sku_venda === sku)
      if (!comps.length) return 0
      const c = comps.reduce((t, comp) => {
        const p = estoque.find(e => e.sku_base === comp.sku_base)
        return t + (p?.custo || 0) * (comp.quantidade || 1)
      }, 0)
      const princ = estoque.find(e => e.sku_base === comps[0]?.sku_base)
      return c + (princ?.custo_embalagem || 0)
    }

    let somaCusto = 0, somaQtd = 0, somaVendas = 0
    const breakdown: Record<string, { qtd: number; custo: number }> = {}
    for (const r of rows) {
      const sku = String(r.sku || '').toUpperCase()
      const qtd = r.quantidade || 1
      const custo = getCustoUnit(sku)
      somaCusto += custo * qtd; somaQtd += qtd; somaVendas += r.valor_bruto || 0
      if (!breakdown[sku]) breakdown[sku] = { qtd: 0, custo }
      breakdown[sku].qtd += qtd
    }

    setCustoMedio(somaQtd > 0 ? somaCusto / somaQtd : 0)
    setTicketMedio(somaQtd > 0 ? somaVendas / somaQtd : 0)
    setTotalVendas(somaVendas); setTotalPedidos(rows.length)
    setCustoInfo(`${somaQtd} vendas — ${Object.entries(breakdown).map(([s,{qtd,custo}]) => `${s}: ${qtd}× ${R(custo)}`).join(' | ')}`)
    setLoadingCusto(false)
  }, [familia, loja, mesRef, skuMapData, estoque])

  // ── Refs ROAS/CPA ─────────────────────────────────────────────────────────
  const refs = useMemo(() => {
    const p = ticketMedio, cp = custoMedio
    if (p <= 0 || cp <= 0) return null
    const taxaVal    = p * 0.20 + 4
    const impostoVal = p * (imposto / 100)
    const margem     = p - taxaVal - cp - impostoVal
    const margemPct  = margem / p
    const roasEmpate = margemPct > 0 ? 1 / margemPct : 0
    const margemAlvo = margem - p * 0.15
    const roasIdeal  = margemAlvo > 0 ? p / margemAlvo : 0
    const cpaMax     = margem > 0 ? margem : 0
    const cpaIdeal   = margemAlvo > 0 ? margemAlvo : 0
    return { p, cp, taxaVal, impostoVal, margem, margemPct, roasEmpate, roasIdeal, cpaMax, cpaIdeal }
  }, [ticketMedio, custoMedio, imposto])

  // ── Cenário dos 4 casos ───────────────────────────────────────────────────
  function getCenario(int: Intervalo) {
    if (!int.vendas || !int.gasto_ads) return null
    const roasInt  = int.vendas / int.gasto_ads
    const consome  = int.gasto_ads >= (int.orcamento_diario * 5 * 0.85)
    const empate   = refs?.roasEmpate || (int.meta_roas || 8)
    const bateRoas = roasInt >= empate
    if (!consome && !bateRoas) return { label: '🔴 Cenário 1 — Revisar',      acao: 'Baixar meta ROAS e baixar orçamento', cor: '#ef4444' }
    if (consome  && !bateRoas) return { label: '⚠️ Cenário 2 — Subir meta',   acao: 'Subir meta ROAS, manter orçamento',   cor: '#f59e0b' }
    if (consome  && bateRoas)  return { label: '✅ Cenário 3 — Escalar',       acao: 'Subir meta ROAS e subir orçamento',   cor: '#22c55e' }
    return                            { label: '💡 Cenário 4 — Melhor caso',   acao: 'Pode baixar ROAS para tracionar + baixar orçamento', cor: '#0ea5e9' }
  }

  // ── Decisão 2 últimos intervalos ──────────────────────────────────────────
  const decisao = useMemo(() => {
    const sorted   = [...intervalos].sort((a,b) => a.numero_intervalo - b.numero_intervalo)
    const comDados = sorted.filter(i => i.vendas > 0 && i.gasto_ads > 0)
    if (!comDados.length) return null
    const ultimo    = comDados[comDados.length - 1]
    const penultimo = comDados.length >= 2 ? comDados[comDados.length - 2] : null
    const roasUltimo = ultimo.vendas / (ultimo.gasto_ads || 1)
    if (roasUltimo < 4) return { texto: '🚨 ROAS < 4 — Age IMEDIATAMENTE', acao: 'Sobe meta ROAS agora', cor: '#ef4444', urgente: true }
    const cU = getCenario(ultimo)
    const cP = penultimo ? getCenario(penultimo) : null
    if (!penultimo || !cP) return { texto: cU?.label || '—', acao: cU?.acao || '—', cor: cU?.cor || '#9090aa', urgente: false }
    if (cU?.label === cP.label) return { texto: `${cU.label} (2 intervalos)`, acao: cU.acao, cor: cU.cor, urgente: true }
    return { texto: 'Tendência mudou', acao: 'Aguarda mais 5 dias antes de agir', cor: '#9090aa', urgente: false }
  }, [intervalos, refs])

  // ── Resumo do mês ─────────────────────────────────────────────────────────
  const resumoMes = useMemo(() => {
    const totV = intervalos.reduce((s,i) => s+(i.vendas||0), 0)
    const totA = intervalos.reduce((s,i) => s+(i.gasto_ads||0), 0)
    const roas = totA > 0 ? totV / totA : 0
    return { totV, totA, roas, ok: roas >= (refs?.roasEmpate||0) && roas > 0 }
  }, [intervalos, refs])

  // ── Salvar intervalo ──────────────────────────────────────────────────────
  async function salvarIntervalo() {
    if (!formInt.numero_intervalo || !formInt.periodo_label) {
      showToast('Preencha o intervalo e o período', 'err'); return
    }
    setSaving(true)
    const payload = {
      sku_familia: familia, loja: formInt.loja || 'KL MARKET', mes_referencia: mesRef,
      numero_intervalo: formInt.numero_intervalo!, periodo_label: formInt.periodo_label || '',
      vendas: formInt.vendas||0, pedidos: formInt.pedidos||0, gasto_ads: formInt.gasto_ads||0,
      cpa_real: formInt.cpa_real||0, meta_roas: formInt.meta_roas||10, orcamento_diario: formInt.orcamento_diario||30,
      novo_meta_roas: formInt.novo_meta_roas||0, novo_orcamento_diario: formInt.novo_orcamento_diario||0,
    }
    let error
    if (editingId) {
      ;({ error } = await supabase.from('monitor_roas_intervalos').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('monitor_roas_intervalos').upsert(payload, {
        onConflict: 'sku_familia,loja,mes_referencia,numero_intervalo'
      }))
    }
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Intervalo salvo!')
    setEditingId(null)
    setFormInt({ numero_intervalo: 1, periodo_label: '', vendas: 0, pedidos: 0, gasto_ads: 0, cpa_real: 0, meta_roas: 10, orcamento_diario: 30, novo_meta_roas: 0, novo_orcamento_diario: 0, loja: 'KL MARKET' })
    loadIntervalos()
  }

  function editarIntervalo(i: Intervalo) {
    setFormInt({ ...i }); setEditingId(i.id || null); setActiveTab('intervalos')
  }
  async function deletarIntervalo(id: number) {
    await supabase.from('monitor_roas_intervalos').delete().eq('id', id)
    setIntervalos(prev => prev.filter(i => i.id !== id)); showToast('Removido')
  }

  // ── Sincronizar histórico — calcula margem e lucro automaticamente ───────────
  async function sincronizarHistorico() {
    setSaving(true)

    // Função local de custo (replica calcCalibracao mas por mês)
    function getCustoUnitLocal(sku: string): number {
      const comps = skuMapData.filter(m => m.sku_venda === sku)
      if (!comps.length) return 0
      const c = comps.reduce((t, comp) => {
        const p = estoque.find(e => e.sku_base === comp.sku_base)
        return t + (p?.custo || 0) * (comp.quantidade || 1)
      }, 0)
      const princ = estoque.find(e => e.sku_base === comps[0]?.sku_base)
      return c + (princ?.custo_embalagem || 0)
    }

    const skusDaFamilia = Object.entries(SKU_FAMILIA).filter(([,f]) => f === familia).map(([s]) => s)

    // Buscar financeiro completo da família
    const { data: finAll } = await supabase.from('financeiro').select('sku,quantidade,valor_bruto,data,loja,comissao_shopee')
    let rows = ((finAll || []) as any[]).filter(r => skusDaFamilia.includes(String(r.sku||'').toUpperCase()))
    if (loja !== 'Todas') rows = rows.filter(r => (r.loja||'').toUpperCase() === loja)

    // Agrupa por mês calculando todos os componentes financeiros
    const porMes: Record<string, {
      vendas: number; taxas: number; custo: number; imp: number
    }> = {}

    for (const r of rows) {
      const ym  = String(r.data||'').slice(0,7); if (!ym) continue
      const sku = String(r.sku||'').toUpperCase()
      const qtd = r.quantidade || 1
      const rec = r.valor_bruto || 0
      // Taxa Shopee: usa comissao_shopee se disponível, senão 20% + R$4
      const taxa = (r.comissao_shopee && r.comissao_shopee > 0)
        ? r.comissao_shopee
        : rec * 0.20 + 4
      const custo = getCustoUnitLocal(sku) * qtd
      const imp   = rec * (imposto / 100)
      if (!porMes[ym]) porMes[ym] = { vendas: 0, taxas: 0, custo: 0, imp: 0 }
      porMes[ym].vendas += rec
      porMes[ym].taxas  += taxa
      porMes[ym].custo  += custo
      porMes[ym].imp    += imp
    }

    // Buscar ads
    const { data: adsAll } = await supabase.from('ads').select('data,investimento,produto,loja')
    const adsPorMes: Record<string, number> = {}
    for (const a of (adsAll||[])) {
      if (SKU_FAMILIA[String(a.produto||'').toUpperCase()] !== familia) continue
      if (loja !== 'Todas' && (a.loja||'').toUpperCase() !== loja) continue
      const ym = String(a.data||'').slice(0,7); if (!ym) continue
      adsPorMes[ym] = (adsPorMes[ym]||0) + (a.investimento||0)
    }

    // Montar upserts com margem real calculada
    const upserts = Object.entries(porMes).map(([ym, { vendas, taxas, custo, imp }]) => {
      const ads    = adsPorMes[ym] || 0
      // Margem = Receita - Taxas - Custo - Imposto - Ads (igual ao DRE)
      const margem = vendas - taxas - custo - imp - ads
      const margemPct = vendas > 0 ? (margem / vendas) * 100 : 0
      return {
        sku_familia: familia,
        loja: loja === 'Todas' ? 'TODAS' : loja,
        mes_referencia: ym,
        faturamento: vendas,
        gasto_ads: ads,
        margem_pct: +margemPct.toFixed(2),
        ajuste_manual: false,
      }
    })

    if (upserts.length > 0) {
      // Buscar registros com ajuste_manual=true para não sobrescrever
      const lojaFiltroSync = loja === 'Todas' ? 'TODAS' : loja
      const { data: manuais } = await supabase.from('monitor_roas_historico')
        .select('mes_referencia').eq('sku_familia', familia)
        .eq('loja', lojaFiltroSync).eq('ajuste_manual', true)
      const manuaisSet = new Set((manuais||[]).map((m: any) => m.mes_referencia))
      // Filtra apenas os que NÃO foram ajustados manualmente
      const toUpsert = upserts.filter(u => !manuaisSet.has(u.mes_referencia))
      if (toUpsert.length > 0) {
        await supabase.from('monitor_roas_historico').upsert(toUpsert, {
          onConflict: 'sku_familia,loja,mes_referencia', ignoreDuplicates: false,
        })
      }
      const pulados = upserts.length - toUpsert.length
      setSaving(false)
      showToast(`${toUpsert.length} meses atualizados${pulados > 0 ? ` · ${pulados} manual(is) preservado(s)` : ''}`)
    } else {
      setSaving(false)
      showToast('Nenhum dado encontrado para sincronizar')
    }
    loadHistorico()
  }

  async function deletarHistorico(id: number) {
    if (!confirm('Apagar este mês do histórico?')) return
    await supabase.from('monitor_roas_historico').delete().eq('id', id)
    showToast('Registro removido!')
    loadHistorico()
  }

  async function salvarAjusteHistorico(ym: string) {
    const edit = editHist[ym]; if (!edit) return
    setSaving(true)
    const { error } = await supabase.from('monitor_roas_historico').upsert({
      sku_familia: familia, loja: loja === 'Todas' ? 'TODAS' : loja,
      mes_referencia: ym, ...edit, ajuste_manual: true,
    }, { onConflict: 'sku_familia,loja,mes_referencia' })
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Ajuste salvo!')
    setEditHist(prev => { const n = {...prev}; delete n[ym]; return n })
    loadHistorico()
  }

  const cor = FAMILIA_COR[familia] || '#ff6600'

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ width:36, height:36, border:'2px solid #1e1e2c', borderTop:`2px solid ${cor}`, borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding:'20px 24px', boxSizing:'border-box' as any }}>

      {/* HEADER */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ margin:'0 0 4px', fontSize:17, fontWeight:800, color:'#e8e8f8' }}>📊 Monitor de ROAS</h2>
        <p style={{ margin:0, fontSize:12, color:'#55556a' }}>Calibração mensal, controle de intervalos e histórico por família de produto</p>
      </div>

      {/* FILTROS TOPO */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' as any, alignItems:'center' }}>

        {/* Família */}
        <div style={{ display:'flex', gap:6 }}>
          {FAMILIAS.map(f => {
            const c = FAMILIA_COR[f]; const ativo = familia === f
            return (
              <button key={f} onClick={() => setFamilia(f)} style={{ background:ativo?c+'22':'#0f0f1a', border:`1px solid ${ativo?c:'#2a2a3a'}`, color:ativo?c:'#55556a', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:ativo?700:400 }}>{f}</button>
            )
          })}
        </div>

        {/* Loja */}
        <select value={loja} onChange={e => setLoja(e.target.value)} style={{ ...S.inp, width:200, background:'#0f0f1a' } as any}>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* Mês */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' as any }}>
          <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={{ ...S.inp, width:160 } as any} />
          <button onClick={() => setMesRef(mesAnterior())} style={{ background:'#13131e', border:'1px solid #2a2a3a', color:'#9090aa', borderRadius:7, padding:'7px 12px', cursor:'pointer', fontSize:11 }}>Mês Anterior</button>
          <button onClick={() => setMesRef(mesAtual())} style={{ background:'#13131e', border:'1px solid #2a2a3a', color:'#9090aa', borderRadius:7, padding:'7px 12px', cursor:'pointer', fontSize:11 }}>Mês Atual</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #1e1e2c' }}>
        {([
          { id:'calibracao', label:'🎯 Calibração Mensal' },
          { id:'intervalos', label:'📅 Controle de Intervalos' },
          { id:'historico',  label:'📈 Histórico Anual' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ background:'transparent', border:'none', borderBottom:`2px solid ${activeTab===t.id?cor:'transparent'}`, color:activeTab===t.id?cor:'#55556a', padding:'10px 18px', cursor:'pointer', fontWeight:activeTab===t.id?700:400, fontSize:13, marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          TAB 1 — CALIBRAÇÃO
      ═══════════════════════════════════════ */}
      {activeTab === 'calibracao' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Dados do mês */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:cor, marginBottom:14, letterSpacing:0.5 }}>
              📦 DADOS DO MÊS — {labelMes(mesRef)} {loja !== 'Todas' && <span style={{ color: LOJA_COR[loja]||'#ff6600', fontSize:11 }}>· {lojaShort(loja)}</span>}
            </div>
            {loadingCusto ? (
              <div style={{ color:'#55556a', fontSize:12 }}>⏳ Calculando...</div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {[
                    { label:'Faturamento',      v:R(totalVendas),  c:'#e2e2f0' },
                    { label:'Pedidos',           v:String(totalPedidos), c:'#e2e2f0' },
                    { label:'Ticket Médio',      v:R(ticketMedio),  c:'#f59e0b' },
                    { label:'Custo Médio Pond.', v:R(custoMedio),   c:'#0ea5e9' },
                  ].map(({ label, v, c }) => (
                    <div key={label} style={{ background:'#0f0f1a', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'#55556a', marginBottom:3, textTransform:'uppercase' as any, letterSpacing:0.5 }}>{label}</div>
                      <div style={{ fontFamily:'monospace', fontWeight:800, color:c, fontSize:15 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {custoInfo && <div style={{ fontSize:10, color:'#33334a', lineHeight:1.5, marginBottom:10 }}>{custoInfo}</div>}

                {/* Imposto manual */}
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'#0f0f1a', borderRadius:8, padding:'10px 12px', marginBottom:10 }}>
                  <label style={{ ...S.label, margin:0, whiteSpace:'nowrap' as any }}>Imposto desta loja (%)</label>
                  <input type="number" step="0.1" min="0" max="20" value={imposto} onChange={e => setImposto(+e.target.value)}
                    style={{ ...S.inp, width:80, textAlign:'center' as any } as any} />
                  <span style={{ fontSize:11, color:'#55556a' }}>Pré-preenchido com {IMPOSTO_PADRAO[loja]??4}%</span>
                </div>

                <button onClick={calcCalibracao} style={{ background:'transparent', border:`1px solid ${cor}44`, color:cor, borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  🔄 Recalcular
                </button>
              </>
            )}
          </div>

          {/* Referências */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#c0c0d8', marginBottom:14, letterSpacing:0.5 }}>⭐ SUAS REFERÊNCIAS DO MÊS</div>
            {!refs ? (
              <div style={{ color:'#55556a', fontSize:12 }}>Sem dados suficientes. Verifique cadastro de produtos e SKU map.</div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {[
                    { label:'⭐ ROAS Empate',     v:`${refs.roasEmpate.toFixed(2)}x`,                           desc:'Mínimo para não perder',   c:'#f59e0b' },
                    { label:'🎯 ROAS Ideal (15%)', v:refs.roasIdeal>0?`${refs.roasIdeal.toFixed(2)}x`:'—',      desc:'Para 15% de lucro líquido',c:'#22c55e' },
                    { label:'⭐ CPA Máximo',       v:R(refs.cpaMax),                                            desc:'Não pague mais por venda', c:'#f59e0b' },
                    { label:'🎯 CPA Ideal',        v:refs.cpaIdeal>0?R(refs.cpaIdeal):'—',                      desc:'Para 15% de lucro líquido',c:'#22c55e' },
                  ].map(({ label, v, desc, c }) => (
                    <div key={label} style={{ background:'#0f0f1a', borderRadius:8, padding:'10px 12px', borderLeft:`3px solid ${c}` }}>
                      <div style={{ fontSize:10, color:'#55556a', marginBottom:3 }}>{label}</div>
                      <div style={{ fontFamily:'monospace', fontWeight:800, color:c, fontSize:15 }}>{v}</div>
                      <div style={{ fontSize:10, color:'#44445a', marginTop:2 }}>{desc}</div>
                    </div>
                  ))}
                </div>

                {/* Nota explicativa sobre ROAS Ideal */}
                {refs.roasIdeal > 20 && (
                  <div style={{ background:'#1a1a0f', border:'1px solid #f59e0b33', borderRadius:8, padding:'10px 12px', marginBottom:10, fontSize:11, color:'#9090aa', lineHeight:1.5 }}>
                    💡 <strong style={{ color:'#f59e0b' }}>Por que o ROAS Ideal é tão alto?</strong><br/>
                    Sua margem é {Pct(refs.margemPct)} e a meta de lucro é 15%. Sobram apenas {Pct(refs.margemPct - 0.15)} para pagar os ads.
                    Com pouca margem, o ROAS exigido fica muito alto. <strong style={{ color:'#e2e2f0' }}>Use o ROAS Empate como referência principal agora</strong> — o Ideal só se torna atingível quando a margem crescer.
                  </div>
                )}

                {/* Decomposição */}
                <div style={{ fontSize:11, color:'#44445a', borderTop:'1px solid #1e1e2c', paddingTop:10 }}>
                  {[
                    { l:'Ticket médio',            v:R(refs.p),          c:'#e2e2f0' },
                    { l:'Taxa Shopee (20% + R$4)', v:`-${R(refs.taxaVal)}`, c:'#f59e0b' },
                    { l:'Custo produto',            v:`-${R(refs.cp)}`,   c:'#888' },
                    { l:`Imposto (${imposto}%)`,    v:`-${R(refs.impostoVal)}`, c:'#666' },
                  ].map(({ l, v, c }) => (
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span>{l}</span><span style={{ color:c, fontFamily:'monospace' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', background:cor+'14', borderLeft:`3px solid ${cor}`, borderRadius:4, marginTop:4 }}>
                    <span style={{ fontWeight:700, color:'#c0c0d8' }}>Margem antes de Ads</span>
                    <span style={{ fontFamily:'monospace', fontWeight:800, color:cor }}>{R(refs.margem)} ({Pct(refs.margemPct)})</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          TAB 2 — CONTROLE DE INTERVALOS
      ═══════════════════════════════════════ */}
      {activeTab === 'intervalos' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Decisão + Resumo */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ ...S.card, borderColor:decisao?decisao.cor+'44':'#222232' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#c0c0d8', marginBottom:12, letterSpacing:0.5 }}>🧠 DECISÃO — 2 ÚLTIMOS INTERVALOS</div>
              {!decisao ? (
                <div style={{ color:'#55556a', fontSize:12 }}>Registre ao menos 1 intervalo para ver a análise.</div>
              ) : (
                <>
                  <div style={{ background:decisao.cor+'14', border:`1px solid ${decisao.cor}33`, borderRadius:8, padding:'12px 14px', marginBottom:8 }}>
                    <div style={{ fontWeight:700, color:decisao.cor, fontSize:13, marginBottom:4 }}>{decisao.texto}</div>
                    <div style={{ fontSize:11, color:'#9090aa' }}>{decisao.acao}</div>
                  </div>
                  <div style={{ fontSize:11, color:decisao.urgente?'#ef4444':'#55556a', fontWeight:decisao.urgente?600:400 }}>
                    {decisao.urgente ? '⚡ Age agora' : 'Altera meta ROAS em no máximo +2 ou -2 pontos por vez'}
                  </div>
                </>
              )}
            </div>

            <div style={S.card}>
              <div style={{ fontSize:12, fontWeight:700, color:'#c0c0d8', marginBottom:12, letterSpacing:0.5 }}>📊 RESUMO — {labelMes(mesRef)}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { label:'Total Vendas', v:R(resumoMes.totV),  c:'#e2e2f0' },
                  { label:'Total Ads',   v:R(resumoMes.totA),  c:'#e2e2f0' },
                  { label:'ROAS Mês',    v:resumoMes.roas>0?`${resumoMes.roas.toFixed(2)}x`:'—', c:resumoMes.ok?'#22c55e':'#ef4444' },
                ].map(({ label, v, c }) => (
                  <div key={label} style={{ background:'#0f0f1a', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'#55556a', marginBottom:3, textTransform:'uppercase' as any, letterSpacing:0.5 }}>{label}</div>
                    <div style={{ fontFamily:'monospace', fontWeight:800, color:c, fontSize:14 }}>{v}</div>
                  </div>
                ))}
              </div>
              {refs && resumoMes.roas > 0 && (
                <div style={{ marginTop:10, fontSize:11, color:resumoMes.ok?'#22c55e':'#ef4444', fontWeight:600 }}>
                  {resumoMes.ok ? '✅ Mês no verde' : '⚠️ Abaixo do empate'} — ROAS empate: {refs.roasEmpate.toFixed(2)}x
                  {refs && resumoMes.totA > 0 && (
                    <span style={{ marginLeft:8, color:'#9090aa', fontWeight:400 }}>
                      | CPA médio: {R(resumoMes.totA / intervalos.reduce((s,i)=>s+(i.pedidos||0),0))}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:cor, marginBottom:14, letterSpacing:0.5 }}>
              {editingId ? '✏️ EDITAR INTERVALO' : '+ REGISTRAR INTERVALO'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:12, marginBottom:14 }}>
              <div>
                <label style={S.label}>Loja</label>
                <select value={formInt.loja||'KL MARKET'} onChange={e => setFormInt(f => ({...f, loja:e.target.value}))} style={S.inp as any}>
                  {LOJAS.filter(l => l !== 'Todas').map(l => <option key={l} value={l}>{lojaShort(l)}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Intervalo</label>
                <select value={formInt.numero_intervalo} onChange={e => setFormInt(f => ({...f, numero_intervalo:+e.target.value}))} style={S.inp as any}>
                  {INTERVAL_LABELS.map((l,i) => <option key={i+1} value={i+1}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Período</label>
                <input type="text" value={formInt.periodo_label||''} onChange={e => setFormInt(f => ({...f, periodo_label:e.target.value}))}
                  placeholder="01/04 - 05/04" style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Vendas (R$)</label>
                <input type="number" step="0.01" value={formInt.vendas||''} onChange={e => setFormInt(f => ({...f, vendas:+e.target.value}))} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Pedidos</label>
                <input type="number" value={formInt.pedidos||''} onChange={e => setFormInt(f => ({...f, pedidos:+e.target.value}))} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Gasto Ads (R$)</label>
                <input type="number" step="0.01" value={formInt.gasto_ads||''} onChange={e => setFormInt(f => ({...f, gasto_ads:+e.target.value}))} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>CPA Real (R$)</label>
                <input type="number" step="0.01" value={formInt.cpa_real||''} onChange={e => setFormInt(f => ({...f, cpa_real:+e.target.value}))}
                  placeholder={formInt.gasto_ads&&formInt.pedidos ? R((formInt.gasto_ads||0)/(formInt.pedidos||1)) : 'ex: 5,70'} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Meta ROAS (atual)</label>
                <input type="number" step="0.5" value={formInt.meta_roas||''} onChange={e => setFormInt(f => ({...f, meta_roas:+e.target.value}))} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Orç. Diário (R$)</label>
                <input type="number" step="1" value={formInt.orcamento_diario||''} onChange={e => setFormInt(f => ({...f, orcamento_diario:+e.target.value}))} style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Novo Meta ROAS</label>
                <input type="number" step="0.5" value={formInt.novo_meta_roas||''} onChange={e => setFormInt(f => ({...f, novo_meta_roas:+e.target.value}))}
                  placeholder="0 = sem alteração" style={S.inp as any} />
              </div>
              <div>
                <label style={S.label}>Novo Orçamento Diário (R$)</label>
                <input type="number" step="1" value={formInt.novo_orcamento_diario||''} onChange={e => setFormInt(f => ({...f, novo_orcamento_diario:+e.target.value}))}
                  placeholder="0 = sem alteração" style={S.inp as any} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={salvarIntervalo} disabled={saving} style={{ background:cor, color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', cursor:'pointer', fontWeight:700, fontSize:13 }}>
                {saving ? '⏳' : editingId ? '✓ Atualizar' : '✓ Salvar Intervalo'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setFormInt({ numero_intervalo:1, periodo_label:'', vendas:0, pedidos:0, gasto_ads:0, cpa_real:0, meta_roas:10, orcamento_diario:30, novo_meta_roas:0, novo_orcamento_diario:0, loja:'KL MARKET' }) }}
                  style={{ background:'#13131e', color:'#9090aa', border:'1px solid #2a2a3a', borderRadius:8, padding:'9px 16px', cursor:'pointer', fontSize:12 }}>Cancelar</button>
              )}
            </div>
          </div>

          {/* Tabela de intervalos */}
          <div style={S.card}>
            <div style={{ fontSize:12, fontWeight:700, color:'#c0c0d8', marginBottom:14, letterSpacing:0.5 }}>📋 INTERVALOS DE {labelMes(mesRef).toUpperCase()}</div>
            {intervalos.length === 0 ? (
              <div style={{ color:'#55556a', fontSize:12, textAlign:'center' as any, padding:32 }}>Nenhum intervalo registrado.</div>
            ) : (
              <div style={{ overflowX:'auto' as any }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>{['Loja','Intervalo','Período','Vendas','Pedidos','Ads','CPA Real','vs CPA Máx','ROAS Int.','vs Empate','ROAS Acum.','Consome?','Cenário','Ação','Meta ROAS Ant.','Orç. Diário Ant.','Novo Meta ROAS','Novo Orç. Diário',''].map(h =>
                      <th key={h} style={S.th as any}>{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {[...intervalos].sort((a,b) => a.numero_intervalo - b.numero_intervalo).map((int, idx) => {
                      const roasInt  = int.gasto_ads > 0 ? int.vendas / int.gasto_ads : 0
                      const sorted   = [...intervalos].sort((a,b) => a.numero_intervalo - b.numero_intervalo)
                      const upTo     = sorted.filter(i => i.numero_intervalo <= int.numero_intervalo)
                      const totV     = upTo.reduce((s,i)=>s+(i.vendas||0),0)
                      const totA     = upTo.reduce((s,i)=>s+(i.gasto_ads||0),0)
                      const roasAcum = totA > 0 ? totV / totA : 0
                      const consome  = int.gasto_ads >= (int.orcamento_diario * 5 * 0.85)
                      const cenario  = getCenario(int)
                      const cpaReal  = int.cpa_real || (int.pedidos > 0 ? int.gasto_ads / int.pedidos : 0)
                      const bg       = idx % 2 === 0 ? '#13131e' : 'transparent'
                      const lcor     = LOJA_COR[int.loja] || '#9090aa'
                      return (
                        <tr key={int.id||idx} style={{ background:bg }}>
                          <td style={S.td as any}><span style={{ color:lcor, fontWeight:600, fontSize:11 }}>{lojaShort(int.loja)}</span></td>
                          <td style={{ ...S.td, color:cor, fontWeight:700 }}>{INTERVAL_LABELS[int.numero_intervalo-1]}</td>
                          <td style={S.td as any}>{int.periodo_label}</td>
                          <td style={{ ...S.td, fontFamily:'monospace', fontWeight:600 }}>{R(int.vendas)}</td>
                          <td style={S.td as any}>{int.pedidos}</td>
                          <td style={{ ...S.td, fontFamily:'monospace', color:'#f59e0b' }}>{R(int.gasto_ads)}</td>
                          <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: refs && cpaReal <= refs.cpaMax ? '#22c55e' : '#ef4444' }}>
                            {cpaReal > 0 ? R(cpaReal) : '—'}
                          </td>
                          <td style={S.td as any}>
                            {refs && cpaReal > 0 ? <DiffBadge value={cpaReal} base={refs.cpaMax} invertido /> : <span style={{ color:'#44445a' }}>—</span>}
                          </td>
                          <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: refs && roasInt >= refs.roasEmpate ? '#22c55e' : '#ef4444' }}>
                            {roasInt > 0 ? `${roasInt.toFixed(2)}x` : '—'}
                          </td>
                          <td style={S.td as any}>
                            {refs && roasInt > 0 ? <DiffBadge value={roasInt} base={refs.roasEmpate} /> : <span style={{ color:'#44445a' }}>—</span>}
                          </td>
                          <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: refs && roasAcum >= refs.roasEmpate ? '#22c55e' : '#ef4444' }}>
                            {roasAcum > 0 ? `${roasAcum.toFixed(2)}x` : '—'}
                          </td>
                          <td style={S.td as any}>
                            <span style={{ color:consome?'#22c55e':'#ef4444', fontWeight:600, fontSize:11 }}>{consome?'✅ Sim':'❌ Não'}</span>
                          </td>
                          <td style={S.td as any}>{cenario ? <CenarioBadge label={cenario.label} /> : <span style={{ color:'#44445a' }}>—</span>}</td>
                          <td style={{ ...S.td, fontSize:11, color:'#9090aa', maxWidth:150, whiteSpace:'normal' as any }}>{cenario?.acao||'—'}</td>
                          {/* Meta ROAS Anterior */}
                          <td style={{ ...S.td, fontFamily:'monospace', color:'#9090aa', textAlign:'center' as any }}>
                            {int.meta_roas > 0 ? `${int.meta_roas}x` : '—'}
                          </td>
                          {/* Orçamento Diário Anterior */}
                          <td style={{ ...S.td, fontFamily:'monospace', color:'#9090aa', textAlign:'center' as any }}>
                            {int.orcamento_diario > 0 ? R(int.orcamento_diario) : '—'}
                          </td>
                          {/* Novo Meta ROAS */}
                          <td style={{ ...S.td, fontFamily:'monospace', textAlign:'center' as any }}>
                            {int.novo_meta_roas > 0
                              ? <span style={{ color: int.novo_meta_roas > int.meta_roas ? '#22c55e' : '#ef4444', fontWeight:700 }}>
                                  {int.novo_meta_roas > int.meta_roas ? '▲' : '▼'} {int.novo_meta_roas}x
                                </span>
                              : <span style={{ color:'#33334a' }}>—</span>}
                          </td>
                          {/* Novo Orçamento Diário */}
                          <td style={{ ...S.td, fontFamily:'monospace', textAlign:'center' as any }}>
                            {int.novo_orcamento_diario > 0
                              ? <span style={{ color: int.novo_orcamento_diario > int.orcamento_diario ? '#22c55e' : '#ef4444', fontWeight:700 }}>
                                  {int.novo_orcamento_diario > int.orcamento_diario ? '▲' : '▼'} {R(int.novo_orcamento_diario)}
                                </span>
                              : <span style={{ color:'#33334a' }}>—</span>}
                          </td>
                          <td style={S.td as any}>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => editarIntervalo(int)} style={{ background:'#ff660018', color:'#ff6600', border:'1px solid #ff660030', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>✏️</button>
                              <button onClick={() => int.id && deletarIntervalo(int.id)} style={{ background:'#ef444418', color:'#ef4444', border:'1px solid #ef444430', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Regras */}
          <div style={{ ...S.card, background:'#0f0f1a' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#33334a', marginBottom:8, letterSpacing:0.8, textTransform:'uppercase' as any }}>📋 Regras de Ouro</div>
            {['Age só se 2 intervalos seguidos estiverem no mesmo cenário ruim (exceto ROAS < 4 → age imediatamente)',
              'Nunca muda mais que +2 ou -2 pontos na meta ROAS por vez',
              'Se tá vendendo + consumindo orçamento todo → NÃO MEXE, deixa rodar',
              'Após qualquer alteração, aguarda 7 dias antes de mexer de novo'].map((r,i) => (
              <div key={i} style={{ fontSize:11, color:'#44445a', padding:'4px 0', borderBottom:'1px solid #1a1a26' }}>{r}</div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          TAB 3 — HISTÓRICO ANUAL
      ═══════════════════════════════════════ */}
      {activeTab === 'historico' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' as any, gap:8 }}>
            <div style={{ fontSize:12, color:'#55556a' }}>
              Dados puxados do Financeiro. Ajuste manualmente linha a linha quando necessário.
              {loja !== 'Todas' && <span style={{ color:LOJA_COR[loja]||'#ff6600', marginLeft:6, fontWeight:600 }}>· {loja}</span>}
            </div>
            <button onClick={sincronizarHistorico} disabled={saving} style={{ background:cor+'22', color:cor, border:`1px solid ${cor}44`, borderRadius:8, padding:'8px 18px', cursor:'pointer', fontWeight:700, fontSize:12 }}>
              {saving ? '⏳ Sincronizando...' : '🔄 Sincronizar com Financeiro'}
            </button>
            <div style={{ fontSize:10, color:'#33334a', marginTop:6, textAlign:'right' as any }}>
              Sincroniza {loja === 'Todas' ? 'todas as lojas consolidadas' : loja} · Use ✕ para apagar linhas duplicadas
            </div>
          </div>

          <div style={S.card}>
            <div style={{ overflowX:'auto' as any }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>{['Mês','Faturamento','Gasto Ads','ROAS Real','ROAS Empate','Δ ROAS vs Empate','CPA Médio','CPA Máximo','Δ CPA vs Máximo','Margem (%)','Lucro Real','Status',''].map(h =>
                    <th key={h} style={S.th as any}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr><td colSpan={13} style={{ ...S.td, color:'#55556a', textAlign:'center' as any, padding:40 }}>
                      Nenhum dado. Clique em "Sincronizar com Financeiro".
                    </td></tr>
                  ) : historico.map((h, idx) => {
                    const isEditing = !!editHist[h.mes_referencia]
                    const ev        = editHist[h.mes_referencia] || {}
                    const fat       = ev.faturamento ?? h.faturamento
                    const ads       = ev.gasto_ads   ?? h.gasto_ads
                    const margPct   = ev.margem_pct  ?? h.margem_pct
                    const roas      = ads > 0 ? fat / ads : 0
                    // margem_pct já inclui ads no denominador (calculado na sincronização)
                    // lucro real = fat × margem% (não subtrai ads de novo)
                    const lucro     = fat * (margPct / 100)

                    const roasEmpRef = refs?.roasEmpate || 0
                    const cpaMaxRef  = refs?.cpaMax || 0
                    const pedidosEst = ticketMedio > 0 ? Math.round(fat / ticketMedio) : 0
                    const cpaEst     = pedidosEst > 0 ? ads / pedidosEst : 0

                    const ok        = roas >= roasEmpRef && roas > 0
                    const bg        = idx % 2 === 0 ? '#13131e' : 'transparent'
                    return (
                      <tr key={h.mes_referencia} style={{ background:bg }}>
                        <td style={{ ...S.td, fontWeight:700, color:cor }}>
                          {labelMes(h.mes_referencia)}
                          {h.ajuste_manual && <span style={{ fontSize:9, color:'#f59e0b', marginLeft:4 }}>✏️</span>}
                        </td>
                        <td style={S.td as any}>
                          {isEditing
                            ? <input type="number" value={fat} onChange={e => setEditHist(p => ({...p, [h.mes_referencia]:{...p[h.mes_referencia], faturamento:+e.target.value}}))} style={{ ...S.inp, width:110 } as any} step="0.01" />
                            : <span style={{ fontFamily:'monospace', fontWeight:600 }}>{R(fat)}</span>}
                        </td>
                        <td style={S.td as any}>
                          {isEditing
                            ? <input type="number" value={ads} onChange={e => setEditHist(p => ({...p, [h.mes_referencia]:{...p[h.mes_referencia], gasto_ads:+e.target.value}}))} style={{ ...S.inp, width:110 } as any} step="0.01" />
                            : <span style={{ fontFamily:'monospace', color:'#f59e0b' }}>{R(ads)}</span>}
                        </td>
                        {/* ROAS Real */}
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:ok?'#22c55e':ads>0?'#ef4444':'#55556a' }}>
                          {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                        </td>
                        {/* ROAS Empate */}
                        <td style={{ ...S.td, fontFamily:'monospace', color:'#f59e0b' }}>
                          {roasEmpRef > 0 ? `${roasEmpRef.toFixed(2)}x` : '—'}
                        </td>
                        {/* Δ ROAS vs Empate */}
                        <td style={S.td as any}>
                          {roas > 0 && roasEmpRef > 0 ? <DiffBadge value={roas} base={roasEmpRef} /> : <span style={{ color:'#44445a' }}>—</span>}
                        </td>
                        {/* CPA Médio */}
                        <td style={{ ...S.td, fontFamily:'monospace', color:cpaEst>0&&cpaMaxRef>0?(cpaEst<=cpaMaxRef?'#22c55e':'#ef4444'):'#9090aa' }}>
                          {cpaEst > 0 ? R(cpaEst) : '—'}
                        </td>
                        {/* CPA Máximo */}
                        <td style={{ ...S.td, fontFamily:'monospace', color:'#f59e0b' }}>
                          {cpaMaxRef > 0 ? R(cpaMaxRef) : '—'}
                        </td>
                        {/* Δ CPA vs Máximo */}
                        <td style={S.td as any}>
                          {cpaEst > 0 && cpaMaxRef > 0 ? <DiffBadge value={cpaEst} base={cpaMaxRef} invertido /> : <span style={{ color:'#44445a' }}>—</span>}
                        </td>
                        {/* Margem */}
                        <td style={S.td as any}>
                          {isEditing
                            ? <input type="number" value={margPct} onChange={e => setEditHist(p => ({...p, [h.mes_referencia]:{...p[h.mes_referencia], margem_pct:+e.target.value}}))} style={{ ...S.inp, width:75 } as any} step="0.1" />
                            : <span style={{ fontFamily:'monospace', color: margPct > 0 ? '#22c55e' : margPct < 0 ? '#ef4444' : '#9090aa' }}>{margPct !== 0 ? `${margPct.toFixed(1)}%` : '—'}</span>}
                        </td>
                        {/* Lucro estimado */}
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:600, color:lucro>=0?'#22c55e':'#ef4444' }}>
                          {margPct !== 0 ? <span style={{ color: lucro >= 0 ? '#22c55e' : '#ef4444' }}>{R(lucro)}</span> : '—'}
                        </td>
                        {/* Status */}
                        <td style={S.td as any}>
                          {roas > 0
                            ? <span style={{ background:(ok?'#22c55e':'#ef4444')+'18', color:ok?'#22c55e':'#ef4444', border:`1px solid ${ok?'#22c55e':'#ef4444'}33`, borderRadius:5, padding:'2px 7px', fontSize:11, fontWeight:700 }}>{ok?'✅ Verde':'⚠️ Atenção'}</span>
                            : <span style={{ color:'#44445a', fontSize:11 }}>—</span>}
                        </td>
                        <td style={S.td as any}>
                          {isEditing
                            ? <div style={{ display:'flex', gap:4 }}>
                                <button onClick={() => salvarAjusteHistorico(h.mes_referencia)} style={{ background:'#22c55e22', color:'#22c55e', border:'1px solid #22c55e44', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11, fontWeight:700 }}>✓</button>
                                <button onClick={() => setEditHist(p => { const n={...p}; delete n[h.mes_referencia]; return n })} style={{ background:'#13131e', color:'#9090aa', border:'1px solid #2a2a3a', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>✕</button>
                              </div>
                            : <div style={{ display:'flex', gap:4 }}>
                                <button onClick={() => setEditHist(p => ({...p, [h.mes_referencia]:{}}))} style={{ background:'#ff660018', color:'#ff6600', border:'1px solid #ff660030', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>✏️</button>
                                <button onClick={() => h.id && deletarHistorico(h.id)} style={{ background:'#ef444418', color:'#ef4444', border:'1px solid #ef444430', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>✕</button>
                              </div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
