'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const R  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const D  = (s: string) => { if (!s) return ''; const [y,m,d] = String(s).slice(0,10).split('-'); return d&&m&&y?`${d}/${m}/${y}`:s }

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600', 'UNIVERSO DOS ACHADOS': '#0ea5e9', 'MUNDO DOS ACHADOS': '#a855f7',
}

const S = {
  page:     { padding: '20px 24px', width: '100%', boxSizing: 'border-box' as any },
  card:     { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:       { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:       { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:      { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any, width: '100%' },
  btn:      { background: '#ff6600', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSm:    { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnGhost: { background: 'transparent', color: '#9090aa', border: '1px solid #2a2a3a', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 500, fontSize: 12 },
  btnDanger:{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  label:    { fontSize: 11, color: '#55556a', marginBottom: 5, display: 'block', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as any },
}

type Ad = { id: string; data: string; loja: string; produto: string; investimento: number; vendas_geradas: number; roas: number; gasto?: number }

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ ...S.card, width: '100%', maxWidth: 480, padding: '28px 32px' }}>{children}</div>
    </div>
  )
}

export default function AdsPage() {
  const [ads,      setAds]      = useState<Ad[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [lojaFil,  setLojaFil]  = useState('Todas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [showDel,  setShowDel]  = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [toast,    setToast]    = useState({ msg: '', type: 'ok' })
  const [newAd, setNewAd] = useState({
    data: new Date().toISOString().slice(0,10),
    loja: LOJAS[0],
    produto: '',
    investimento: '' as any,
    vendas_geradas: '' as any,
  })

  useEffect(() => { load() }, [])

  function showToast(msg: string, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 4000)
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('ads').select('*').order('data', { ascending: false })
    if (error) { showToast('Erro ao carregar: ' + error.message, 'err') }
    setAds((data || []).map((a: any) => ({ ...a, roas: (a.investimento||0) > 0 ? a.vendas_geradas / (a.investimento||1) : 0 })))
    setLoading(false)
  }

  async function addAd() {
    if (!newAd.data) { showToast('Preencha a data', 'err'); return }
    if (!newAd.produto) { showToast('Preencha o produto/campanha', 'err'); return }
    if (!newAd.investimento || +newAd.investimento <= 0) { showToast('Preencha o investimento', 'err'); return }

    setSaving(true)
    const inv  = +newAd.investimento
    const vend = +newAd.vendas_geradas || 0
    const roas = inv > 0 ? vend / inv : 0

    const payload = {
      data:           newAd.data,
      loja:           newAd.loja,
      produto:        newAd.produto,
      investimento:   inv,
      vendas_geradas: vend,
      roas,
    }

    const { error } = await supabase.from('ads').insert(payload)
    setSaving(false)

    if (error) {
      showToast('Erro ao salvar: ' + error.message, 'err')
      return
    }

    showToast('Anúncio salvo com sucesso!')
    setShowAdd(false)
    setNewAd({ data: new Date().toISOString().slice(0,10), loja: LOJAS[0], produto: '', investimento: '', vendas_geradas: '' })
    load()
  }

  async function delAd(id: string) {
    if (!confirm('Excluir registro?')) return
    await supabase.from('ads').delete().eq('id', id)
    load()
  }

  async function limpar() {
    setLimpando(true)
    let q = supabase.from('ads').delete().neq('id', '00000000-0000-0000-0000-000000000000') as any
    if (lojaFil !== 'Todas') q = q.eq('loja', lojaFil)
    if (dateFrom) q = q.gte('data', dateFrom)
    if (dateTo)   q = q.lte('data', dateTo)
    const { error } = await q
    setShowDel(false)
    setLimpando(false)
    if (error) { showToast('Erro: ' + error.message, 'err'); return }
    showToast('Registros removidos.')
    load()
  }

  const filtered = ads.filter(a => {
    if (lojaFil !== 'Todas' && a.loja !== lojaFil) return false
    if (dateFrom && a.data < dateFrom) return false
    if (dateTo   && a.data > dateTo)   return false
    return true
  })

  const totalInv    = filtered.reduce((s, a) => s + (a.investimento || 0), 0)
  const totalVendas = filtered.reduce((s, a) => s + (a.vendas_geradas || 0), 0)
  const roasGeral   = totalInv > 0 ? totalVendas / totalInv : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#e8e8f8', letterSpacing: -0.3 }}>📣 Shopee Ads</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#55556a' }}>{filtered.length} registros</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowDel(true)} style={S.btnDanger}>🗑️ Limpar Período</button>
          <button onClick={() => setShowAdd(true)} style={S.btn}>+ Novo Anúncio</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Investido',  val: R(totalInv),    color: '#ef4444' },
          { label: 'Vendas Geradas',   val: R(totalVendas), color: '#22c55e' },
          { label: 'ROAS Geral',       val: `${roasGeral.toFixed(2)}x`, color: '#0ea5e9' },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, borderTop: `3px solid ${k.color}22` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Todas', ...LOJAS].map(l => {
            const ativo = lojaFil === l
            const cor   = LOJA_COLORS[l] || '#ff6600'
            const label = l === 'Todas' ? 'Todas' : l === 'KL MARKET' ? 'KL' : l === 'UNIVERSO DOS ACHADOS' ? 'UNIVERSO' : 'MUNDO'
            return (
              <button key={l} onClick={() => setLojaFil(l)} style={{ background: ativo ? cor + '22' : 'transparent', border: `1px solid ${ativo ? cor : '#2a2a3a'}`, color: ativo ? cor : '#555', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: ativo ? 700 : 400 }}>{label}</button>
            )
          })}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 148 }} />
        <span style={{ color: '#444', fontSize: 12 }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 148 }} />
        {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo('') }} style={S.btnGhost}>✕ Limpar</button>}
      </div>

      {/* TABELA */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Data', 'Loja', 'Produto/Campanha', 'Investimento', 'Vendas Geradas', 'ROAS', 'Ação'].map(h => (
                  <th key={h} style={{ ...S.th, textAlign: h === 'Investimento' || h === 'Vendas Geradas' ? 'right' as any : S.th.textAlign }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: '40px', color: '#55556a' }}>Nenhum anúncio registrado</td></tr>
              ) : filtered.map(ad => {
                const inv  = ad.investimento || 0
                const roas = inv > 0 ? ad.vendas_geradas / inv : 0
                const cor  = LOJA_COLORS[ad.loja] || '#ff6600'
                return (
                  <tr key={ad.id}>
                    <td style={{ ...S.td, color: '#55556a' }}>{D(ad.data)}</td>
                    <td style={S.td}><span style={{ color: cor, fontWeight: 600 }}>{ad.loja === 'KL MARKET' ? 'KL' : ad.loja === 'UNIVERSO DOS ACHADOS' ? 'UNIVERSO' : 'MUNDO'}</span></td>
                    <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.produto}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: '#ef4444' }}>{R(inv)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: '#22c55e' }}>{R(ad.vendas_geradas)}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{ background: roas >= 3 ? '#22c55e22' : roas >= 1.5 ? '#f59e0b22' : '#ef444422', color: roas >= 3 ? '#22c55e' : roas >= 1.5 ? '#f59e0b' : '#ef4444', border: `1px solid ${roas >= 3 ? '#22c55e44' : roas >= 1.5 ? '#f59e0b44' : '#ef444444'}`, borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {roas.toFixed(2)}x
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <button onClick={() => delAd(ad.id)} style={{ background: '#ef444412', color: '#ef4444', border: '1px solid #ef444425', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, background: toast.type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, zIndex: 9999 }}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Modal Add */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>📣 Novo Registro de Ads</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>Data</label>
              <input type="date" value={newAd.data} onChange={e => setNewAd({ ...newAd, data: e.target.value })} style={S.inp} />
            </div>
            <div>
              <label style={S.label}>Loja</label>
              <select value={newAd.loja} onChange={e => setNewAd({ ...newAd, loja: e.target.value })} style={S.inp}>
                {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Produto / Campanha</label>
              <input value={newAd.produto} onChange={e => setNewAd({ ...newAd, produto: e.target.value })} placeholder="Nome da campanha" style={S.inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Investimento (R$)</label>
                <input type="number" step="0.01" min="0" value={newAd.investimento} onChange={e => setNewAd({ ...newAd, investimento: e.target.value })} style={S.inp} />
              </div>
              <div>
                <label style={S.label}>Vendas Geradas (R$)</label>
                <input type="number" step="0.01" min="0" value={newAd.vendas_geradas} onChange={e => setNewAd({ ...newAd, vendas_geradas: e.target.value })} style={S.inp} />
              </div>
            </div>
            <div style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              ROAS: <strong style={{ color: '#ff6600' }}>{+newAd.investimento > 0 ? (+newAd.vendas_geradas / +newAd.investimento).toFixed(2) : '0.00'}x</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={addAd} disabled={saving} style={{ ...S.btn, flex: 1, opacity: saving ? 0.7 : 1 }}>
              {saving ? '⏳ Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Limpar */}
      {showDel && (
        <Modal onClose={() => setShowDel(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Limpar Registros de Ads</h3>
          </div>
          <div style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>
            {lojaFil !== 'Todas' && <p style={{ margin: '0 0 4px', color: '#9090aa' }}>Loja: <strong style={{ color: '#e2e2f0' }}>{lojaFil}</strong></p>}
            {dateFrom && <p style={{ margin: '0 0 4px', color: '#9090aa' }}>De: <strong style={{ color: '#e2e2f0' }}>{D(dateFrom)}</strong></p>}
            {dateTo   && <p style={{ margin: '0 0 4px', color: '#9090aa' }}>Até: <strong style={{ color: '#e2e2f0' }}>{D(dateTo)}</strong></p>}
            {lojaFil === 'Todas' && !dateFrom && !dateTo && <p style={{ color: '#ef4444', margin: 0 }}>⚠️ Sem filtro — TODOS os registros serão apagados!</p>}
            <p style={{ margin: '8px 0 0', color: '#f59e0b' }}>Registros: <strong>{filtered.length}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowDel(false)} style={{ ...S.btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={limpar} disabled={limpando} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flex: 1 }}>
              {limpando ? 'Removendo...' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
