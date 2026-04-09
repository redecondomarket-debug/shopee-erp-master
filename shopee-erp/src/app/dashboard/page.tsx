'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTaxRate } from '@/hooks/useTaxRate'

const LOJAS = ['KL MARKET', 'UNIVERSO DOS ACHADOS', 'MUNDO DOS ACHADOS']
const LOJA_COLORS: Record<string, string> = {
  'KL MARKET': '#ff6600',
  'UNIVERSO DOS ACHADOS': '#0ea5e9',
  'MUNDO DOS ACHADOS': '#a855f7',
}
const TAXA_SHOPEE = 0.20
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const R = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0)
const P = (v: number) => `${((+v || 0) * 100).toFixed(1)}%`
const N = (v: number) => new Intl.NumberFormat('pt-BR').format(+v || 0)

const S: Record<string, React.CSSProperties> = {
  card:  { background: '#16161f', border: '1px solid #222232', borderRadius: 12, padding: '18px 20px' },
  th:    { padding: '10px 14px', textAlign: 'left' as any, fontSize: 11, fontWeight: 700, color: '#55556a', letterSpacing: 1, textTransform: 'uppercase' as any, borderBottom: '1px solid #1e1e2c', whiteSpace: 'nowrap' as any, background: '#13131e' },
  td:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #1a1a26', whiteSpace: 'nowrap' as any, color: '#e2e2f0' },
  inp:   { background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '8px 12px', color: '#e2e2f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as any },
  btnSm: { background: '#ff660018', color: '#ff6600', border: '1px solid #ff660033', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
}

function Badge({ children, color = '#ff6600' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{children}</span>
}
function StatusBadge({ v }: { v: number }) {
  if (v >= 0.20) return <Badge color="#22c55e">▲ {P(v)}</Badge>
  if (v >= 0.10) return <Badge color="#f59e0b">● {P(v)}</Badge>
  if (v >= 0)    return <Badge color="#f59e0b">● {P(v)}</Badge>
  return <Badge color="#ef4444">▼ {P(v)}</Badge>
}
function ROASBadge({ v }: { v: number }) {
  const color = v >= 2 ? '#22c55e' : v >= 1 ? '#f59e0b' : '#ef4444'
  return <Badge color={color}>{(+v || 0).toFixed(2)}x</Badge>
}
function KPI({ label, value, sub, color = '#ff9933', icon }: any) {
  return (
    <div style={{ ...S.card, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function Table({ headers, rows, emptyMsg = 'Nenhum dado.' }: { headers: string[]; rows: React.ReactNode[][]; emptyMsg?: string }) {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={S.th as any}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ ...S.td, color: '#555', textAlign: 'center', padding: 32 } as any}>{emptyMsg}</td></tr>
            : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={S.td as any}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

// ── Gráfico barras por dia ────────────────────────────────────────────────────
function GraficoDia({ data }: { data: { l: string; v: number }[] }) {
  if (!data.length) return <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Sem dados no período</div>
  const W = 900, H = 230, PL = 56, PR = 10, PT = 30, PB = 44
  const max   = Math.max(...data.map(d => d.v), 1)
  const iW    = W - PL - PR
  const iH    = H - PT - PB
  const n     = data.length

  // Largura da barra com espaço mínimo garantido entre elas
  // Espaço entre barras = 40% do slot; barra = 60%
  const slotW = iW / n
  const bW    = Math.max(4, Math.min(26, slotW * 0.60))

  const xc    = (i: number) => PL + (i + 0.5) * slotW
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ v: max * p, y: PT + iH * (1 - p) }))
  const fmtV  = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`

  // Com muitos dias: alternar rótulos (par/ímpar) para evitar sobreposição
  const mostrarLabel = (i: number) => n <= 20 || i % 2 === 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#1e1e2c" strokeWidth={1} />
          <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#44445a">{fmtV(t.v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const bh = Math.max((d.v / max) * iH, 1)
        const bx = xc(i) - bW / 2
        const by = PT + iH - bh
        // Rótulo do valor: só mostra se a barra tiver largura suficiente
        const showVal = bW >= 8
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bW} height={bh} rx={2} fill="#ff6600" fillOpacity={0.88} />
            {showVal && (
              <text x={xc(i)} y={by - 4} textAnchor="middle" fontSize={7} fill="#ff9933" fontWeight="700">
                {fmtV(d.v)}
              </text>
            )}
            {mostrarLabel(i) && (
              <text x={xc(i)} y={H - PB + 14} textAnchor="middle" fontSize={8} fill="#44445a"
                transform={n > 25 ? `rotate(-45,${xc(i)},${H - PB + 14})` : ''}>
                {d.l}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Gráfico barras por mês + linha % variação (faixas fixas separadas) ──────
function GraficoMes({ data }: { data: { l: string; v: number; var: number | null }[] }) {
  if (!data.length) return <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Sem dados</div>

  // SVG dividido em 2 faixas fixas — linha SEMPRE acima, barras SEMPRE abaixo
  // Faixa LINHA: y 18..88  (altura 70px) — escala própria de %
  // Separador:   y 96
  // Faixa BARRA: y 110..244 (altura 134px) — escala de R$
  const W = 760, H = 280
  const PL = 62, PR = 20, PB = 36

  const L_TOP = 18,  L_BOT = 88   // faixa da linha de %
  const B_TOP = 110, B_BOT = H - PB  // faixa das barras
  const L_H = L_BOT - L_TOP
  const B_H = B_BOT - B_TOP

  const iW = W - PL - PR
  const n  = data.length
  const bW = Math.max(24, iW / n - 10)
  const xc = (i: number) => PL + (i + 0.5) * (iW / n)
  const max = Math.max(...data.map(d => d.v), 1)

  // Escala da linha: min..max das variações com margem de 10%
  const vars = data.map(d => d.var).filter(v => v !== null) as number[]
  const vRaw = vars.length ? vars : [0]
  const vPad = Math.max((Math.max(...vRaw) - Math.min(...vRaw)) * 0.15, 10)
  const vMin = Math.min(...vRaw) - vPad
  const vMax = Math.max(...vRaw) + vPad
  const vRng = Math.max(vMax - vMin, 1)

  // yLn: posição Y DENTRO da faixa L_TOP..L_BOT
  const yLn = (v: number) => L_TOP + L_H * (1 - (v - vMin) / vRng)

  const pts = data
    .map((d, i) => d.var !== null ? `${xc(i)},${yLn(d.var!)}` : null)
    .filter(Boolean).join(' ')

  const fmtV = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
  const barTicks = [0, 0.5, 1].map(p => ({ v: max * p, y: B_BOT - B_H * p }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>

      {/* Linha divisória entre as duas faixas */}
      <line x1={PL} x2={W - PR} y1={96} y2={96}
        stroke="#2a2a3a" strokeWidth={1} strokeDasharray="5,4" />

      {/* Eixo Y das barras */}
      {barTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y}
            stroke="#1e1e2c" strokeWidth={1} strokeDasharray="2,5" />
          <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#44445a">
            {fmtV(t.v)}
          </text>
        </g>
      ))}

      {/* Barras */}
      {data.map((d, i) => {
        const bh = Math.max((d.v / max) * B_H, 2)
        const bx = xc(i) - bW / 2
        const by = B_BOT - bh
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bW} height={bh} rx={4}
              fill="#1a4a8a" fillOpacity={0.92} />
            <text x={xc(i)} y={by - 5} textAnchor="middle"
              fontSize={9.5} fill="#5599ff" fontWeight="700">
              {fmtV(d.v)}
            </text>
            <text x={xc(i)} y={H - PB + 14} textAnchor="middle"
              fontSize={11} fill="#9090aa" fontWeight="600">
              {d.l}
            </text>
          </g>
        )
      })}

      {/* Linha de variação — restrita à faixa L_TOP..L_BOT */}
      {pts && (
        <polyline points={pts} fill="none" stroke="#22c55e"
          strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Pontos + rótulos da % — sempre dentro da faixa de linha */}
      {data.map((d, i) => {
        if (d.var === null) return null
        const cy  = yLn(d.var)   // y garantido entre L_TOP e L_BOT
        const cor = d.var >= 0 ? '#22c55e' : '#ef4444'
        // Rótulo: acima do ponto se tiver espaço, senão abaixo
        const lblY = cy - L_TOP > 16 ? cy - 8 : cy + 17
        return (
          <g key={`v${i}`}>
            <circle cx={xc(i)} cy={cy} r={5} fill={cor}
              stroke="#16161f" strokeWidth={2} />
            <text x={xc(i)} y={lblY} textAnchor="middle"
              fontSize={10} fill={cor} fontWeight="800">
              {d.var >= 0 ? '+' : ''}{d.var.toFixed(1)}%
            </text>
          </g>
        )
      })}


    </svg>
  )
}

// ── Gráfico Pizza donut SVG ───────────────────────────────────────────────────
function GraficoPizza({ fatias }: { fatias: { label: string; v: number; color: string }[] }) {
  const total = fatias.reduce((s, f) => s + f.v, 0)
  if (!total) return <div style={{ color: '#555', textAlign: 'center', padding: 32, fontSize: 12 }}>Sem dados</div>
  const CX = 90, CY = 90, RO = 76, RI = 38
  let ang = -Math.PI / 2
  const slices = fatias.map(f => {
    const a   = (f.v / total) * 2 * Math.PI
    const ea  = ang + a
    const lg  = a > Math.PI ? 1 : 0
    const cos1 = Math.cos(ang), sin1 = Math.sin(ang)
    const cos2 = Math.cos(ea),  sin2 = Math.sin(ea)
    const d = [
      `M${CX + RO * cos1},${CY + RO * sin1}`,
      `A${RO},${RO} 0 ${lg},1 ${CX + RO * cos2},${CY + RO * sin2}`,
      `L${CX + RI * cos2},${CY + RI * sin2}`,
      `A${RI},${RI} 0 ${lg},0 ${CX + RI * cos1},${CY + RI * sin1}`,
      'Z',
    ].join(' ')
    const pct = ((f.v / total) * 100).toFixed(1)
    ang = ea
    return { ...f, d, pct }
  })
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" style={{ width: 180, height: 180, flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#16161f" strokeWidth={2} />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize={9} fill="#55556a">Total</text>
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize={9.5} fill="#c0c0d8" fontWeight="700">
          {R(total).replace('R$\u00a0', 'R$')}
        </text>
      </svg>
      <div style={{ flex: 1, minWidth: 100 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#c0c0d8' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#55556a' }}>{R(s.v)} · <strong style={{ color: s.color }}>{s.pct}%</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── Gráfico Ads por Mês (mesmo padrão do faturamento) ────────────────────────
function GraficoAdsMes({ data }: { data: { l: string; v: number; var: number | null }[] }) {
  if (!data.length) return <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Sem dados de Ads</div>
  const W = 760, H = 280, PL = 62, PR = 20, PB = 36
  const BAR_TOP = 110, BAR_BOT = H - PB, BAR_H = BAR_BOT - BAR_TOP
  const LINE_TOP = 14, LINE_BOT = 96, LINE_H = LINE_BOT - LINE_TOP
  const iW = W - PL - PR, n = data.length
  const bW = Math.max(24, iW / n - 10)
  const xc = (i: number) => PL + (i + 0.5) * (iW / n)
  const max = Math.max(...data.map(d => d.v), 1)
  const vars  = data.map(d => d.var).filter(v => v !== null) as number[]
  const vPad  = vars.length ? Math.max((Math.max(...vars) - Math.min(...vars)) * 0.15, 10) : 15
  const vMin  = vars.length ? Math.min(...vars) - vPad : -20
  const vMax  = vars.length ? Math.max(...vars) + vPad : 20
  const yLn   = (v: number) => LINE_TOP + LINE_H * (1 - (v - vMin) / Math.max(vMax - vMin, 1))
  const pts   = data.map((d, i) => d.var !== null ? `${xc(i)},${yLn(d.var!)}` : null).filter(Boolean).join(' ')
  const fmtV  = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
  const bTick = [0, 0.5, 1].map(p => ({ v: max * p, y: BAR_BOT - BAR_H * p }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <line x1={PL} x2={W-PR} y1={96} y2={96} stroke="#2a2a3a" strokeWidth={1} strokeDasharray="5,4"/>
      {bTick.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W-PR} y1={t.y} y2={t.y} stroke="#1e1e2c" strokeWidth={1} strokeDasharray="2,5"/>
          <text x={PL-6} y={t.y+4} textAnchor="end" fontSize={9} fill="#44445a">{fmtV(t.v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const bh = Math.max((d.v / max) * BAR_H, 2)
        const bx = xc(i) - bW / 2
        const by = BAR_BOT - bh
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bW} height={bh} rx={4} fill="#7c3aed" fillOpacity={0.85}/>
            <text x={xc(i)} y={by-5} textAnchor="middle" fontSize={9} fill="#a78bfa" fontWeight="700">{fmtV(d.v)}</text>
            <text x={xc(i)} y={H-PB+14} textAnchor="middle" fontSize={10.5} fill="#9090aa" fontWeight="600">{d.l}</text>
          </g>
        )
      })}
      {pts && <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>}
      {data.map((d, i) => {
        if (d.var === null) return null
        const cy  = yLn(d.var)
        const cor = d.var >= 0 ? '#22c55e' : '#ef4444'
        const lblY = cy - LINE_TOP > 16 ? cy - 8 : cy + 17
        return (
          <g key={`v${i}`}>
            <circle cx={xc(i)} cy={cy} r={5} fill={cor} stroke="#16161f" strokeWidth={2}/>
            <text x={xc(i)} y={lblY} textAnchor="middle" fontSize={10} fill={cor} fontWeight="800">
              {d.var >= 0 ? '+' : ''}{d.var.toFixed(1)}%
            </text>
          </g>
        )
      })}

    </svg>
  )
}

// ── Gráfico Faturamento vs Ads (barras duplas + linha ROAS) ───────────────────
function GraficoFatVsAds({ data }: { data: { l: string; fat: number; ads: number; roas: number }[] }) {
  if (!data.length) return <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Sem dados</div>
  const W = 760, H = 280, PL = 62, PR = 20, PB = 36
  const BAR_TOP = 110, BAR_BOT = H - PB, BAR_H = BAR_BOT - BAR_TOP
  const LINE_TOP = 14, LINE_BOT = 96, LINE_H = LINE_BOT - LINE_TOP
  const iW   = W - PL - PR, n = data.length
  const slotW = iW / n
  const bW    = Math.max(10, slotW / 2 - 4)
  const xFat  = (i: number) => PL + i * slotW + slotW * 0.25
  const xAds  = (i: number) => PL + i * slotW + slotW * 0.55
  const xMid  = (i: number) => PL + (i + 0.5) * slotW
  const maxV  = Math.max(...data.map(d => d.fat), 1)
  const roasV = data.map(d => d.roas).filter(v => v > 0)
  const rMin  = roasV.length ? Math.max(0, Math.min(...roasV) - 0.5) : 0
  const rMax  = roasV.length ? Math.max(...roasV) + 0.5 : 5
  const yBar  = (v: number) => BAR_BOT - (v / maxV) * BAR_H
  const yRoas = (v: number) => LINE_TOP + LINE_H * (1 - (v - rMin) / Math.max(rMax - rMin, 1))
  const roasPts = data.map((d, i) => d.roas > 0 ? `${xMid(i)},${yRoas(d.roas)}` : null).filter(Boolean).join(' ')
  const fmtV  = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
  const bTick = [0, 0.5, 1].map(p => ({ v: maxV * p, y: BAR_BOT - BAR_H * p }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <line x1={PL} x2={W-PR} y1={96} y2={96} stroke="#2a2a3a" strokeWidth={1} strokeDasharray="5,4"/>
      {bTick.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W-PR} y1={t.y} y2={t.y} stroke="#1e1e2c" strokeWidth={1} strokeDasharray="2,5"/>
          <text x={PL-6} y={t.y+4} textAnchor="end" fontSize={9} fill="#44445a">{fmtV(t.v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const bFat = Math.max((d.fat / maxV) * BAR_H, 2)
        const bAds = Math.max((d.ads / maxV) * BAR_H, 2)
        const byFat = BAR_BOT - bFat
        const byAds = BAR_BOT - bAds
        return (
          <g key={i}>
            <rect x={xFat(i)} y={byFat} width={bW} height={bFat} rx={3} fill="#1a4a8a" fillOpacity={0.9}/>
            {d.fat > 0 && (
              <text x={xFat(i) + bW/2} y={byFat - 4} textAnchor="middle" fontSize={8.5} fill="#5599ff" fontWeight="700">
                {fmtV(d.fat)}
              </text>
            )}
            <rect x={xAds(i)} y={byAds} width={bW} height={bAds} rx={3} fill="#7c3aed" fillOpacity={0.85}/>
            {d.ads > 0 && (
              <text x={xAds(i) + bW/2} y={byAds - 4} textAnchor="middle" fontSize={8.5} fill="#a78bfa" fontWeight="700">
                {fmtV(d.ads)}
              </text>
            )}
            <text x={xMid(i)} y={H-PB+14} textAnchor="middle" fontSize={9.5} fill="#9090aa" fontWeight="600">{d.l}</text>
          </g>
        )
      })}
      {roasPts && <polyline points={roasPts} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>}
      {data.map((d, i) => {
        if (!d.roas) return null
        const cy  = yRoas(d.roas)
        const cor = d.roas >= 2 ? '#22c55e' : d.roas >= 1 ? '#f59e0b' : '#ef4444'
        const lblY = cy - LINE_TOP > 16 ? cy - 8 : cy + 17
        return (
          <g key={`r${i}`}>
            <circle cx={xMid(i)} cy={cy} r={5} fill={cor} stroke="#16161f" strokeWidth={2}/>
            <text x={xMid(i)} y={lblY} textAnchor="middle" fontSize={9.5} fill={cor} fontWeight="800">{d.roas.toFixed(1)}x</text>
          </g>
        )
      })}

    </svg>
  )
}

export default function DashboardPage() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [ads,        setAds]        = useState<any[]>([])
  const [estoque,    setEstoque]    = useState<any[]>([])
  const [skuMapData, setSkuMapData] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lojaFiltro, setLojaFiltro] = useState('Todas')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [periodo,    setPeriodo]    = useState('personalizado')
  const [periodoGrafDia, setPeriodoGrafDia] = useState('15dias')
  const [grafDiaFrom,    setGrafDiaFrom]    = useState('')
  const [grafDiaTo,      setGrafDiaTo]      = useState('')

  const { imposto } = useTaxRate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [finRes, adsRes, estRes, mapRes] = await Promise.all([
      supabase.from('financeiro').select('*').order('data', { ascending: false }).limit(5000),
      supabase.from('ads').select('*').order('data', { ascending: false }),
      supabase.from('estoque').select('*'),
      supabase.from('sku_map').select('*'),
    ])
    setFinanceiro(finRes.data || [])
    setAds(adsRes.data || [])
    setEstoque(estRes.data || [])
    setSkuMapData(mapRes.data || [])
    setLoading(false)
  }

  function aplicarPeriodo(p: string) {
    setPeriodo(p)
    const hoje = new Date()
    const fmt  = (d: Date) => d.toISOString().slice(0, 10)
    if (p === 'hoje')   { setDateFrom(fmt(hoje)); setDateTo(fmt(hoje)) }
    else if (p === 'ontem')  { const d = new Date(hoje); d.setDate(d.getDate()-1); setDateFrom(fmt(d)); setDateTo(fmt(d)) }
    else if (p === 'semana') { const d = new Date(hoje); d.setDate(d.getDate()-6); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'mes')    { const d = new Date(hoje); d.setDate(d.getDate()-29); setDateFrom(fmt(d)); setDateTo(fmt(hoje)) }
    else if (p === 'tudo')   { setDateFrom(''); setDateTo('') }
  }

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

  const finF = useMemo(() => financeiro.filter(f => {
    if (lojaFiltro !== 'Todas' && f.loja !== lojaFiltro) return false
    if (dateFrom && f.data < dateFrom) return false
    if (dateTo   && f.data > dateTo)   return false
    return true
  }), [financeiro, lojaFiltro, dateFrom, dateTo])

  const adsF = useMemo(() => ads.filter(a => {
    if (lojaFiltro !== 'Todas' && a.loja !== lojaFiltro) return false
    if (dateFrom && a.data < dateFrom) return false
    if (dateTo   && a.data > dateTo)   return false
    return true
  }), [ads, lojaFiltro, dateFrom, dateTo])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRec   = finF.reduce((s, f) => s + (f.valor_bruto || 0), 0)
  const totalTaxas = finF.reduce((s, f) => s + ((f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : (f.valor_bruto || 0) * TAXA_SHOPEE), 0)
  const totalCprod = finF.reduce((s, f) => s + calcCustoProd(f.sku || '', f.quantidade || 1), 0)
  const totalImp   = totalRec * imposto
  const totalAds   = adsF.reduce((s, a) => s + (a.investimento || 0), 0)
  // MC inclui imposto e ads como custos variáveis
  const totalMC    = totalRec - totalTaxas - totalCprod - totalImp - totalAds
  const mcPct      = totalRec > 0 ? totalMC / totalRec : 0
  // Lucro Op e Lucro Líq = MC (já inclui tudo)
  const totalLucOp = totalMC
  const lucroLiq   = totalMC
  const margemLiq  = totalRec > 0 ? lucroLiq / totalRec : 0
  const roas       = totalAds > 0 ? totalRec / totalAds : 0
  const pedSet     = new Set(finF.map(f => f.pedido)).size
  const ticket     = pedSet > 0 ? totalRec / pedSet : 0

  // ── Por loja ──────────────────────────────────────────────────────────────
  const porLoja = LOJAS.map(loja => {
    const lp    = finF.filter(f => f.loja === loja)
    const rec   = lp.reduce((s, f) => s + (f.valor_bruto || 0), 0)
    const taxas = lp.reduce((s, f) => s + ((f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : (f.valor_bruto || 0) * TAXA_SHOPEE), 0)
    const cprod = lp.reduce((s, f) => s + calcCustoProd(f.sku || '', f.quantidade || 1), 0)
    const imp   = rec * imposto
    const gads  = adsF.filter(a => a.loja === loja).reduce((s, a) => s + (a.investimento || 0), 0)
    const mc    = rec - taxas - cprod - imp - gads
    const lucOp = mc
    const ll    = mc
    return { loja, rec, mc, mcPct: rec > 0 ? mc / rec : 0, lucOp, gads, ll, roas: gads > 0 ? rec / gads : 0, peds: new Set(lp.map(f => f.pedido)).size }
  })

  // ── Top SKUs ──────────────────────────────────────────────────────────────
  const skuAgg: Record<string, any> = {}
  finF.forEach(f => {
    const sku = f.sku || 'SEM SKU'
    if (!skuAgg[sku]) skuAgg[sku] = { sku, nome: f.produto || sku, rec: 0, lucro: 0, qtd: 0 }
    const rec_s   = f.valor_bruto || 0
    const taxas_s = (f.comissao_shopee && f.comissao_shopee > 0) ? f.comissao_shopee : rec_s * TAXA_SHOPEE
    const cprod_s = calcCustoProd(f.sku || '', f.quantidade || 1)
    const imp_s   = rec_s * imposto
    skuAgg[sku].rec   += rec_s
    skuAgg[sku].lucro += rec_s - taxas_s - cprod_s - imp_s
    skuAgg[sku].qtd   += f.quantidade || 1
  })
  const topSkus  = Object.values(skuAgg).sort((a: any, b: any) => b.rec - a.rec).slice(0, 8)
  const totalQtd = finF.reduce((s, f) => s + (f.quantidade || 1), 0)

  // ── Gráfico por dia — filtro próprio (independente do filtro geral) ─────────
  const dayChartData = useMemo(() => {
    const hoje   = new Date()
    const fmt    = (d: Date) => d.toISOString().slice(0, 10)
    let from = '', to = ''
    if (periodoGrafDia === '15dias') {
      const d = new Date(hoje); d.setDate(d.getDate() - 14)
      from = fmt(d); to = fmt(hoje)
    } else if (periodoGrafDia === 'mesAtual') {
      from = fmt(hoje).slice(0,8) + '01'; to = fmt(hoje)
    } else if (periodoGrafDia === 'mesAnterior') {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const d2 = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
      from = fmt(d); to = fmt(d2)
    } else {
      from = grafDiaFrom; to = grafDiaTo
    }
    const byDay: Record<string, number> = {}
    financeiro.forEach(f => {
      if (!f.data) return
      if (lojaFiltro !== 'Todas' && f.loja !== lojaFiltro) return
      if (from && f.data < from) return
      if (to   && f.data > to)   return
      byDay[f.data] = (byDay[f.data] || 0) + (f.valor_bruto || 0)
    })
    return { entries: Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b)).map(([d,v]) => ({ l: d.slice(8,10)+'/'+d.slice(5,7), v })), from, to }
  }, [financeiro, lojaFiltro, periodoGrafDia, grafDiaFrom, grafDiaTo])
  const dayChart = dayChartData.entries

  // ── Gráfico por mês (histórico completo, sem filtro de data) ──────────────
  const byMes: Record<string, number> = {}
  financeiro.filter(f => lojaFiltro === 'Todas' || f.loja === lojaFiltro).forEach(f => {
    if (!f.data) return
    const key = f.data.slice(0, 7)
    byMes[key] = (byMes[key] || 0) + (f.valor_bruto || 0)
  })
  const mesChart = Object.entries(byMes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v], i, arr) => {
    const prev   = i > 0 ? arr[i-1][1] : null
    const varPct = prev && prev > 0 ? ((v - prev) / prev) * 100 : null
    const [ano, mes] = k.split('-')
    return { l: `${MESES[+mes-1]}/${ano.slice(2)}`, v, var: varPct }
  })

  // ── Pizza produtos (por produto base) ─────────────────────────────────────
  const skuParaBase: Record<string, string> = {}
  skuMapData.forEach(m => { if (!skuParaBase[m.sku_venda]) skuParaBase[m.sku_venda] = m.sku_base })

  const CATS: { key: string; label: string; color: string }[] = [
    { key: 'SAQUINHO',      label: 'Saquinhos',    color: '#0ea5e9' },
    { key: 'TAPETES',       label: 'Tapetes',       color: '#a855f7' },
    { key: 'FORMA',         label: 'Formas',        color: '#ff6600' },
    { key: 'PORTASAQUINHO', label: 'Porta-Saquinho',color: '#22c55e' },
    { key: 'OUTROS',        label: 'Outros',        color: '#55556a' },
  ]
  const recPorCat: Record<string, number> = {}
  CATS.forEach(c => { recPorCat[c.key] = 0 })
  finF.forEach(f => {
    const base = skuParaBase[f.sku || ''] || ''
    const cat  = CATS.find(c => c.key !== 'OUTROS' && base.includes(c.key))?.key || 'OUTROS'
    recPorCat[cat] += f.valor_bruto || 0
  })
  const pizzaProdutos = CATS.map(c => ({ label: c.label, v: recPorCat[c.key], color: c.color })).filter(f => f.v > 0)

  // ── Pizza lojas ───────────────────────────────────────────────────────────
  const pizzaLojas = LOJAS.map(l => ({
    label: l === 'KL MARKET' ? 'KL Market' : l === 'UNIVERSO DOS ACHADOS' ? 'Universo' : 'Mundo',
    v:     finF.filter(f => f.loja === l).reduce((s, f) => s + (f.valor_bruto || 0), 0),
    color: LOJA_COLORS[l],
  })).filter(f => f.v > 0)

  // ── Estoque crítico ───────────────────────────────────────────────────────
  const criticos = estoque.filter(e => (e.estoque_atual || 0) <= (e.estoque_minimo || 0))

  // ── Ticket médio por loja ─────────────────────────────────────────────────
  const ticketPorLoja = LOJAS.map(loja => {
    const lp  = finF.filter(f => f.loja === loja)
    const ped = new Set(lp.map(f => f.pedido)).size
    const rec = lp.reduce((s, f) => s + (f.valor_bruto || 0), 0)
    return { loja, ticket: ped > 0 ? rec / ped : 0, peds: ped }
  }).filter(l => l.peds > 0)


  // ── Gráfico Ads por mês (histórico completo) ─────────────────────────────
  const byAds: Record<string, number> = {}
  ads.filter(a => lojaFiltro === 'Todas' || a.loja === lojaFiltro).forEach(a => {
    if (!a.data) return
    const key = a.data.slice(0, 7)
    byAds[key] = (byAds[key] || 0) + (a.investimento || 0)
  })
  // Mesmas chaves que mesChart para alinhar meses
  const adsChart = Object.entries(byMes).sort(([a], [b]) => a.localeCompare(b)).map(([k], i, arr) => {
    const v    = byAds[k] || 0
    const prev = i > 0 ? (byAds[arr[i-1][0]] || 0) : null
    const varPct = prev !== null && prev > 0 ? ((v - prev) / prev) * 100 : null
    const [ano, mes] = k.split('-')
    return { l: `${MESES[+mes-1]}/${ano.slice(2)}`, v, var: varPct }
  })

  // ── Faturamento vs Ads por mês (barras duplas) ────────────────────────────
  const fatVsAds = Object.entries(byMes).sort(([a], [b]) => a.localeCompare(b)).map(([k, fat]) => {
    const adsMes = byAds[k] || 0
    const roas   = adsMes > 0 ? fat / adsMes : 0
    const [ano, mes] = k.split('-')
    return { l: `${MESES[+mes-1]}/${ano.slice(2)}`, fat, ads: adsMes, roas }
  })

  // ── Heatmap dias da semana ────────────────────────────────────────────────
  const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const heatmap: Record<string, number> = {}
  finF.forEach(f => {
    if (!f.data) return
    const d   = new Date(f.data + 'T12:00:00')
    const dia = d.getDay() // 0=Dom..6=Sáb
    const semKey = f.data.slice(0, 7) + '-S' + Math.ceil(d.getDate() / 7)
    const key = `${dia}-${semKey}`
    heatmap[key] = (heatmap[key] || 0) + (f.valor_bruto || 0)
  })
  // Agrupar por dia da semana: média de faturamento
  const mediaPorDia = DIAS_SEMANA.map((nome, idx) => {
    const vals = finF
      .filter(f => f.data && new Date(f.data + 'T12:00:00').getDay() === idx)
      .reduce((acc: Record<string, number>, f) => {
        const d = f.data.slice(0, 10)
        acc[d] = (acc[d] || 0) + (f.valor_bruto || 0)
        return acc
      }, {})
    const dias = Object.values(vals)
    const media = dias.length ? dias.reduce((s, v) => s + v, 0) / dias.length : 0
    return { nome, media, dias: dias.length }
  })

  // ── Velocidade de venda por SKU (unidades/dia) ────────────────────────────
  const diasPeriodo = (() => {
    const datas = finF.map(f => f.data).filter(Boolean).sort()
    if (datas.length < 2) return 1
    return Math.max(1, (new Date(datas[datas.length-1]).getTime() - new Date(datas[0]).getTime()) / 86400000 + 1)
  })()
  const velocidade = Object.values(skuAgg)
    .map((s: any) => ({ ...s, velDia: s.qtd / diasPeriodo, diasCobertura: 0 }))
    .sort((a: any, b: any) => b.velDia - a.velDia)
    .slice(0, 10)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 36, height: 36, border: '2px solid #1e1e2c', borderTop: '2px solid #ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box' }}>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Todas', ...LOJAS].map(l => {
            const cor  = LOJA_COLORS[l] || '#ff6600'
            const ativo = lojaFiltro === l
            const label = l === 'Todas' ? 'Todas' : l === 'KL MARKET' ? 'KL' : l === 'UNIVERSO DOS ACHADOS' ? 'UNIVERSO' : 'MUNDO'
            return (
              <button key={l} onClick={() => setLojaFiltro(l)} style={{ background: ativo ? cor+'33' : 'transparent', border: `1px solid ${ativo ? cor : '#2a2a3a'}`, color: ativo ? cor : '#555', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: ativo ? 700 : 400 }}>{label}</button>
            )
          })}
        </div>
        {(['hoje','ontem','semana','mes','tudo','personalizado'] as const).map(p => (
          <button key={p} onClick={() => aplicarPeriodo(p)} style={{ background: periodo === p ? '#ff6600' : '#13131e', color: periodo === p ? '#fff' : '#9090aa', border: `1px solid ${periodo === p ? '#ff6600' : '#2a2a3a'}`, borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
            {p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : p === 'semana' ? 'Última Semana' : p === 'mes' ? 'Último Mês' : p === 'tudo' ? 'Tudo' : 'Personalizado'}
          </button>
        ))}
        {periodo === 'personalizado' && <>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 150, padding: '5px 8px', fontSize: 12 } as any} />
          <span style={{ color: '#555', fontSize: 12 }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 150, padding: '5px 8px', fontSize: 12 } as any} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              ✕ Limpar
            </button>
          )}
        </>}
        <button onClick={loadData} style={{ ...S.btnSm, marginLeft: 'auto' } as any}>🔄 Atualizar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI icon="💰" label="Faturamento Total"      value={R(totalRec)}                    color="#ff9933" sub={`${N(pedSet)} pedidos · Ticket: ${R(ticket)}`} />
        <KPI icon="📊" label="Margem de Contribuição" value={`${R(totalMC)} · ${P(mcPct)}`}  color={mcPct>=0.30?'#a78bfa':mcPct>=0.15?'#f59e0b':'#ef4444'} sub="Receita − Taxas − Custo − Imp − Ads" />
        <KPI icon="✅" label="Lucro Líquido Real"     value={R(lucroLiq)}                    color={lucroLiq>=0?'#22c55e':'#ef4444'} sub={`Op: ${R(totalLucOp)} · Ads: ${R(totalAds)}`} />
        <KPI icon="📈" label="Margem Líquida"         value={P(margemLiq)}                   color={margemLiq>.15?'#22c55e':margemLiq>.05?'#f59e0b':'#ef4444'} sub="sobre receita bruta" />
        <KPI icon="⚡" label="ROAS Geral"             value={`${roas.toFixed(2)}x`}          color={roas>=2?'#22c55e':roas>=1?'#f59e0b':'#ef4444'} sub={roas>=2?'Eficiente':roas>=1?'Atenção':'Abaixo do ideal'} />
        <KPI icon="🛒" label="Total de Pedidos"       value={N(pedSet)}                      color="#a78bfa" sub={`Ticket médio: ${R(ticket)}`} />
      </div>

      {/* GRÁFICO FATURAMENTO POR DIA */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8' }}>📅 Faturamento por Dia</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={periodoGrafDia} onChange={e => setPeriodoGrafDia(e.target.value)}
              style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 6, padding: '5px 10px', color: '#e2e2f0', fontSize: 11, outline: 'none', cursor: 'pointer' }}>
              <option value="15dias">Últimos 15 dias</option>
              <option value="mesAtual">Mês atual</option>
              <option value="mesAnterior">Mês anterior</option>
              <option value="personalizado">Personalizado</option>
            </select>
            {periodoGrafDia === 'personalizado' && <>
              <input type="date" value={grafDiaFrom} onChange={e => setGrafDiaFrom(e.target.value)}
                style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 6, padding: '5px 8px', color: '#e2e2f0', fontSize: 11, outline: 'none' }} />
              <span style={{ color: '#555', fontSize: 11 }}>até</span>
              <input type="date" value={grafDiaTo} onChange={e => setGrafDiaTo(e.target.value)}
                style={{ background: '#0f0f1a', border: '1px solid #2a2a3a', borderRadius: 6, padding: '5px 8px', color: '#e2e2f0', fontSize: 11, outline: 'none' }} />
            </>}
          </div>
        </div>
        <GraficoDia data={dayChart} />
      </div>

      {/* GRÁFICO FATURAMENTO POR MÊS + LINHA % VARIAÇÃO */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8' }}>📆 Faturamento por Mês</div>
            <div style={{ fontSize: 10, color: '#44445a' }}>Histórico completo · independente do filtro de período</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: 2, background: '#1a4a8a' }} />
              <span style={{ fontSize: 11, color: '#5599ff' }}>Faturamento mensal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 11, color: '#22c55e' }}>% variação vs mês anterior</span>
            </div>
          </div>
        </div>
        <GraficoMes data={mesChart} />
      </div>

      {/* 2 PIZZAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>🥧 Participação por Produto</div>
          <GraficoPizza fatias={pizzaProdutos} />
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>🏪 Participação por Loja</div>
          <GraficoPizza fatias={pizzaLojas} />
        </div>
      </div>

      {/* RESULTADO POR LOJA */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>🏪 Resultado por Loja</div>
        <Table
          headers={['Loja', 'Faturamento', 'Mg Contrib', 'MC%', 'Lucro Op', 'Gasto Ads', 'Lucro Líq', 'ROAS', 'Margem']}
          rows={porLoja.map(l => [
            <span style={{ color: LOJA_COLORS[l.loja], fontWeight: 700, fontSize: 11 }}>{l.loja}</span>,
            <span style={{ fontFamily: 'monospace' }}>{R(l.rec)}</span>,
            <span style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>{R(l.mc)}</span>,
            <span style={{ background: l.mcPct>=0.30?'#22c55e22':l.mcPct>=0.15?'#f59e0b22':'#ef444422', color: l.mcPct>=0.30?'#22c55e':l.mcPct>=0.15?'#f59e0b':'#ef4444', border: `1px solid ${l.mcPct>=0.30?'#22c55e44':l.mcPct>=0.15?'#f59e0b44':'#ef444444'}`, borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>{P(l.mcPct)}</span>,
            <span style={{ fontFamily: 'monospace' }}>{R(l.lucOp)}</span>,
            <span style={{ fontFamily: 'monospace', color: '#e67e22' }}>{R(l.gads)}</span>,
            <span style={{ fontFamily: 'monospace', color: l.ll>=0?'#22c55e':'#ef4444', fontWeight: 700 }}>{R(l.ll)}</span>,
            <ROASBadge v={l.roas} />,
            <StatusBadge v={l.rec>0?l.ll/l.rec:0} />,
          ])}
        />
      </div>

      {/* TOP PRODUTOS + ALERTAS ESTOQUE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>🏆 Top Produtos por Receita</div>
          <Table
            headers={['#', 'SKU', 'Produto', 'Qtd', '% Mix', 'Receita', 'Lucro Op', 'Margem']}
            rows={topSkus.map((s: any, i: number) => [
              <span style={{ color: '#555', fontFamily: 'monospace' }}>{i+1}</span>,
              <span style={{ fontFamily: 'monospace', color: '#ff6600', fontSize: 11 }}>{s.sku}</span>,
              <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{s.nome}</span>,
              N(s.qtd),
              <span style={{ fontSize: 11, color: '#55556a' }}>{totalQtd > 0 ? ((s.qtd/totalQtd)*100).toFixed(1)+'%' : '—'}</span>,
              <span style={{ fontFamily: 'monospace' }}>{R(s.rec)}</span>,
              <span style={{ fontFamily: 'monospace', color: s.lucro>=0?'#22c55e':'#ef4444', fontWeight: 700 }}>{R(s.lucro)}</span>,
              <StatusBadge v={s.rec>0?s.lucro/s.rec:0} />,
            ])}
            emptyMsg="Sem dados de vendas"
          />
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>⚠️ Alertas de Estoque</div>
          {criticos.length === 0
            ? <div style={{ color: '#22c55e', textAlign: 'center', padding: 32, fontSize: 13 }}>✅ Todos os produtos com estoque adequado</div>
            : <Table
                headers={['SKU', 'Produto', 'Atual', 'Mínimo', 'Status']}
                rows={criticos.map(e => [
                  <span style={{ fontFamily: 'monospace', color: '#ef4444', fontSize: 11 }}>{e.sku_base}</span>,
                  e.produto,
                  N(e.estoque_atual || 0),
                  N(e.estoque_minimo || 0),
                  e.estoque_atual <= 0 ? <Badge color="#ef4444">SEM ESTOQUE</Badge> : <Badge color="#f59e0b">BAIXO</Badge>,
                ])}
              />
          }
          <div style={{ marginTop: 14 }}>
            {estoque.map(e => {
              const cor = (e.estoque_atual||0)<=0 ? '#ef4444' : (e.estoque_atual||0)<(e.estoque_minimo||0) ? '#f59e0b' : '#22c55e'
              const pct = (e.estoque_minimo||0)>0 ? Math.min((e.estoque_atual||0)/((e.estoque_minimo||0)*2),1) : (e.estoque_atual||0)>0?1:0
              return (
                <div key={e.id} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#888' }}>{e.produto}</span>
                    <span style={{ fontFamily: 'monospace', color: cor, fontWeight: 700 }}>{N(e.estoque_atual||0)} {e.unidade||'un'}</span>
                  </div>
                  <div style={{ height: 4, background: '#1e1e2a', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct*100}%`, background: cor, borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* TICKET MÉDIO POR LOJA + DEMONSTRATIVO FINANCEIRO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>🎫 Ticket Médio por Loja</div>
          {ticketPorLoja.length === 0
            ? <div style={{ color: '#555', textAlign: 'center', padding: 24, fontSize: 12 }}>Sem dados</div>
            : ticketPorLoja.map(l => {
                const maxT = Math.max(...ticketPorLoja.map(x => x.ticket), 1)
                const cor  = LOJA_COLORS[l.loja] || '#ff6600'
                const nome = l.loja === 'KL MARKET' ? 'KL Market' : l.loja === 'UNIVERSO DOS ACHADOS' ? 'Universo' : 'Mundo'
                return (
                  <div key={l.loja} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: cor, fontWeight: 600 }}>{nome}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e2e2f0' }}>
                        {R(l.ticket)} <span style={{ color: '#44445a', fontWeight: 400, fontSize: 11 }}>({l.peds} ped.)</span>
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#1e1e2a', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${(l.ticket/maxT)*100}%`, background: cor, borderRadius: 4, transition: 'width .4s' }} />
                    </div>
                  </div>
                )
              })
          }
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>💹 Demonstrativo Resumido (DRE)</div>
          {[
            { label: '(+) Receita Bruta',         v: totalRec,                        cor: '#ff9933', bold: false },
            { label: '(-) Taxas Shopee',           v: -totalTaxas,                     cor: '#f59e0b', bold: false },
            { label: '(-) Custo Produtos',         v: -totalCprod,                     cor: '#888',    bold: false },
            { label: '(-) Impostos',               v: -totalImp,                       cor: '#666',    bold: false },
            { label: '(-) Gasto Ads',              v: -totalAds,                       cor: '#e67e22', bold: false },
            { label: '(=) Margem de Contribuição', v: totalMC,                         cor: '#a78bfa', bold: true  },
            { label: '(=) Lucro Líquido Real',     v: lucroLiq,                        cor: lucroLiq>=0?'#22c55e':'#ef4444', bold: true },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1a1a26' }}>
              <span style={{ fontSize: 12, color: row.bold ? '#c0c0d8' : '#55556a', fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
              <div style={{ textAlign: 'right' as any }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: row.cor, fontWeight: row.bold ? 800 : 500 }}>
                  {row.v >= 0 ? R(row.v) : `-${R(Math.abs(row.v))}`}
                </span>
                {totalRec > 0 && (
                  <span style={{ fontSize: 10, color: '#44445a', marginLeft: 6 }}>
                    ({((Math.abs(row.v) / totalRec) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* GRÁFICO ADS POR MÊS */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8' }}>📣 Gasto em Ads por Mês</div>
            <div style={{ fontSize: 10, color: '#44445a' }}>Histórico completo · independente do filtro de período</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: 2, background: '#7c3aed' }} />
              <span style={{ fontSize: 11, color: '#a78bfa' }}>Gasto Ads mensal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ fontSize: 11, color: '#f59e0b' }}>% variação vs mês anterior</span>
            </div>
          </div>
        </div>
        <GraficoAdsMes data={adsChart} />
      </div>

      {/* FATURAMENTO VS ADS POR MÊS */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d8' }}>⚖️ Faturamento vs Gasto Ads por Mês</div>
            <div style={{ fontSize: 10, color: '#44445a' }}>ROAS ≥ 2x = eficiente</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: 2, background: '#1a4a8a' }} />
              <span style={{ fontSize: 11, color: '#5599ff' }}>Faturamento</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: 2, background: '#7c3aed' }} />
              <span style={{ fontSize: 11, color: '#a78bfa' }}>Gasto Ads</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 11, color: '#22c55e' }}>ROAS mensal</span>
            </div>
          </div>
        </div>
        <GraficoFatVsAds data={fatVsAds} />
      </div>

      {/* HEATMAP + VELOCIDADE DE VENDA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Heatmap dias da semana */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#c0c0d8' }}>🗓️ Faturamento Médio por Dia da Semana</div>
          {mediaPorDia.every(d => d.media === 0)
            ? <div style={{ color: '#555', textAlign: 'center', padding: 32, fontSize: 12 }}>Sem dados no período</div>
            : (() => {
                const maxMedia = Math.max(...mediaPorDia.map(d => d.media), 1)
                return (
                  <div>
                    {mediaPorDia.map((d, i) => {
                      const pct    = d.media / maxMedia
                      const cor    = pct > 0.8 ? '#22c55e' : pct > 0.5 ? '#f59e0b' : pct > 0.2 ? '#ef4444' : '#2a2a3a'
                      const bgOpac = Math.max(pct * 0.8, 0.08)
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 30, fontSize: 12, fontWeight: 600, color: '#9090aa', flexShrink: 0 }}>{d.nome}</div>
                          <div style={{ flex: 1, height: 28, background: '#1a1a26', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct * 100}%`, background: cor, opacity: bgOpac + 0.2, borderRadius: 6, transition: 'width .4s' }} />
                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#e2e2f0' }}>
                              {R(d.media)}/dia
                            </div>
                          </div>
                          <div style={{ width: 28, fontSize: 10, color: '#44445a', flexShrink: 0, textAlign: 'right' as any }}>
                            {d.dias}d
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ fontSize: 10, color: '#33334a', marginTop: 8 }}>
                      🟢 Alto · 🟡 Médio · 🟠 Baixo · ⬛ Sem venda · coluna direita = dias com dados
                    </div>
                  </div>
                )
              })()
          }
        </div>

        {/* Velocidade de venda por SKU */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#c0c0d8' }}>⚡ Velocidade de Venda por SKU</div>
          <div style={{ fontSize: 10, color: '#44445a', marginBottom: 12 }}>Unidades/dia · período de {diasPeriodo.toFixed(0)} dias</div>
          {velocidade.length === 0
            ? <div style={{ color: '#555', textAlign: 'center', padding: 32, fontSize: 12 }}>Sem dados no período</div>
            : <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '6px 12px', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#44445a', fontWeight: 700, textTransform: 'uppercase' as any, letterSpacing: 0.8 }}>SKU</div>
                  <div style={{ fontSize: 10, color: '#44445a', fontWeight: 700, textTransform: 'uppercase' as any, letterSpacing: 0.8 }}>Ritmo</div>
                  <div style={{ fontSize: 10, color: '#44445a', fontWeight: 700, textTransform: 'uppercase' as any, letterSpacing: 0.8 }}>Un/dia</div>
                  <div style={{ fontSize: 10, color: '#44445a', fontWeight: 700, textTransform: 'uppercase' as any, letterSpacing: 0.8 }}>30d</div>
                </div>
                {velocidade.map((s: any, i: number) => {
                  const maxVel = velocidade[0]?.velDia || 1
                  const pct    = s.velDia / maxVel
                  const cor    = pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#f59e0b' : '#0ea5e9'
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '4px 12px', alignItems: 'center', marginBottom: 7 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#ff6600', fontWeight: 700 }}>{s.sku}</div>
                      <div style={{ height: 8, background: '#1a1a26', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: cor, borderRadius: 4, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: cor, fontWeight: 700, textAlign: 'right' as any }}>{s.velDia.toFixed(2)}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#55556a', textAlign: 'right' as any }}>{Math.ceil(s.velDia * 30)}</div>
                    </div>
                  )
                })}
                <div style={{ fontSize: 10, color: '#33334a', marginTop: 8 }}>
                  Coluna 30d = previsão de unidades necessárias para os próximos 30 dias
                </div>
              </div>
          }
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
