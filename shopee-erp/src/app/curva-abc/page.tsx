'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { TrendingUp, Download, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type CurvaItem = {
  sku: string
  produto: string
  unidades: number
  faturamento: number
  participacao: number
  participacaoAcumulada: number
  classe: 'A' | 'B' | 'C'
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

const CLASS_COLORS = { A: '#EE2C00', B: '#ffaa00', C: '#555570' }
const CLASS_BG = { A: 'rgba(238,44,0,0.1)', B: 'rgba(255,170,0,0.1)', C: 'rgba(85,85,112,0.1)' }

export default function CurvaABCPage() {
  const [curva, setCurva] = useState<CurvaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: vendas } = await supabase.from('vendas').select('sku_venda, quantidade, valor_venda')
    
    if (!vendas || vendas.length === 0) { setLoading(false); return }

    // Agrupa por SKU
    const map: Record<string, { unidades: number; faturamento: number }> = {}
    for (const v of vendas) {
      if (!map[v.sku_venda]) map[v.sku_venda] = { unidades: 0, faturamento: 0 }
      map[v.sku_venda].unidades += v.quantidade || 0
      map[v.sku_venda].faturamento += v.valor_venda || 0
    }

    const totalFaturamento = Object.values(map).reduce((s, i) => s + i.faturamento, 0)

    // Sort by faturamento desc
    const sorted = Object.entries(map)
      .map(([sku, val]) => ({ sku, ...val }))
      .sort((a, b) => b.faturamento - a.faturamento)

    let acumulado = 0
    const result: CurvaItem[] = sorted.map(item => {
      const participacao = totalFaturamento > 0 ? (item.faturamento / totalFaturamento) * 100 : 0
      acumulado += participacao
      const classe: 'A' | 'B' | 'C' = acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C'
      return {
        sku: item.sku,
        produto: item.sku,
        unidades: item.unidades,
        faturamento: item.faturamento,
        participacao,
        participacaoAcumulada: acumulado,
        classe,
      }
    })

    setCurva(result)
    setLoading(false)
  }

  const filtered = filter === 'all' ? curva : curva.filter(c => c.classe === filter)
  const totalA = curva.filter(c => c.classe === 'A').length
  const totalB = curva.filter(c => c.classe === 'B').length
  const totalC = curva.filter(c => c.classe === 'C').length

  const exportExcel = () => exportToExcel(curva.map(c => ({
    'SKU': c.sku, 'Unidades Vendidas': c.unidades,
    'Faturamento': c.faturamento, '% Participação': c.participacao.toFixed(2) + '%',
    '% Acumulado': c.participacaoAcumulada.toFixed(2) + '%', 'Classe ABC': c.classe,
  })), 'curva-abc', 'Curva ABC')

  const exportPdf = () => exportToPDF('Análise Curva ABC', [
    { header: 'SKU', dataKey: 'sku' }, { header: 'Unidades', dataKey: 'unidades' },
    { header: 'Faturamento', dataKey: 'faturamento' }, { header: '% Part.', dataKey: 'participacao' },
    { header: 'Classe', dataKey: 'classe' },
  ], curva.map(c => ({ ...c, participacao: c.participacao.toFixed(2) + '%' })), 'curva-abc')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Curva ABC</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Análise automática por faturamento</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={exportPdf} className="btn-secondary"><FileText className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { classe: 'A', label: 'Classe A — 80% do faturamento', count: totalA, color: CLASS_COLORS.A },
          { classe: 'B', label: 'Classe B — 15% do faturamento', count: totalB, color: CLASS_COLORS.B },
          { classe: 'C', label: 'Classe C — 5% do faturamento', count: totalC, color: CLASS_COLORS.C },
        ].map(c => (
          <div key={c.classe} className="stat-card cursor-pointer" style={{ borderColor: filter === c.classe ? c.color : undefined }}
               onClick={() => setFilter(filter === c.classe ? 'all' : c.classe as 'A' | 'B' | 'C')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                   style={{ background: CLASS_BG[c.classe as 'A'|'B'|'C'], color: c.color }}>
                {c.classe}
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
                <p className="text-xl font-bold" style={{ color: c.color }}>{c.count} SKUs</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {curva.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-sm mb-4">Top 10 SKUs por Faturamento</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={curva.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="sku" stroke="#555570" tick={{ fontSize: 11 }} />
              <YAxis stroke="#555570" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(val: number) => [formatCurrency(val), 'Faturamento']}
              />
              <Bar dataKey="faturamento" radius={[4, 4, 0, 0]}>
                {curva.slice(0, 10).map((entry) => (
                  <Cell key={entry.sku} fill={CLASS_COLORS[entry.classe]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <div className="grid grid-cols-6 table-header">
          <span>Rank</span><span>SKU</span><span className="text-center">Unidades</span>
          <span className="text-right">Faturamento</span><span className="text-right">% Part.</span><span className="text-center">Classe</span>
        </div>
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Calculando curva ABC...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum dado de vendas para análise</p>
          </div>
        ) : (
          filtered.map((item, i) => (
            <div key={item.sku} className="grid grid-cols-6 table-row items-center">
              <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>#{curva.indexOf(item) + 1}</span>
              <span className="font-mono text-sm" style={{ color: 'var(--shopee-primary)' }}>{item.sku}</span>
              <span className="text-center text-sm">{item.unidades.toLocaleString('pt-BR')}</span>
              <span className="text-right text-sm font-semibold">{formatCurrency(item.faturamento)}</span>
              <span className="text-right text-sm">{item.participacao.toFixed(2)}%</span>
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: CLASS_BG[item.classe], color: CLASS_COLORS[item.classe] }}>
                  {item.classe}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
