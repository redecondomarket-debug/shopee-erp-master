'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { exportToExcel, exportToPDF } from '@/lib/exports'
import { TrendingUp, Download, FileText, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type CurvaItem = {
  sku: string; unidades: number; faturamento: number
  participacao: number; participacaoAcumulada: number; classe: 'A' | 'B' | 'C'
}

const LOJAS = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']
function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}
const CLASS_COLORS = { A: '#EE2C00', B: '#ffaa00', C: '#555570' }
const CLASS_BG = { A: 'rgba(238,44,0,0.1)', B: 'rgba(255,170,0,0.1)', C: 'rgba(85,85,112,0.1)' }

export default function CurvaABCPage() {
  const [vendas, setVendas] = useState<{ sku_venda: string; quantidade: number; valor_venda: number; loja: string; data: string }[]>([])
  const [curva, setCurva] = useState<CurvaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [lojaFilter, setLojaFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { loadData() }, [])
  useEffect(() => { calcularCurva() }, [vendas, lojaFilter, dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('vendas').select('sku_venda, quantidade, valor_venda, loja, data')
    setVendas(data || [])
    setLoading(false)
  }

  function calcularCurva() {
    const vendasFiltradas = vendas.filter(v => {
      if (lojaFilter && v.loja !== lojaFilter) return false
      if (dateFrom && v.data < dateFrom) return false
      if (dateTo && v.data > dateTo) return false
      return true
    })
    if (!vendasFiltradas.length) { setCurva([]); return }

    const map: Record<string, { unidades: number; faturamento: number }> = {}
    for (const v of vendasFiltradas) {
      if (!map[v.sku_venda]) map[v.sku_venda] = { unidades: 0, faturamento: 0 }
      map[v.sku_venda].unidades += v.quantidade || 0
      map[v.sku_venda].faturamento += v.valor_venda || 0
    }

    const total = Object.values(map).reduce((s, i) => s + i.faturamento, 0)
    const sorted = Object.entries(map).sort((a, b) => b[1].faturamento - a[1].faturamento)

    let acumulado = 0
    const result: CurvaItem[] = sorted.map(([sku, val]) => {
      const participacao = total > 0 ? (val.faturamento / total) * 100 : 0
      acumulado += participacao
      const classe: 'A' | 'B' | 'C' = acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C'
      return { sku, unidades: val.unidades, faturamento: val.faturamento, participacao, participacaoAcumulada: acumulado, classe }
    })
    setCurva(result)
  }

  const limparFiltros = () => { setLojaFilter(''); setDateFrom(''); setDateTo('') }
  const temFiltro = lojaFilter || dateFrom || dateTo
  const filtered = filter === 'all' ? curva : curva.filter(c => c.classe === filter)
  const totalA = curva.filter(c => c.classe === 'A').length
  const totalB = curva.filter(c => c.classe === 'B').length
  const totalC = curva.filter(c => c.classe === 'C').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Curva ABC</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {lojaFilter || 'Todas as lojas'} · {curva.length} SKUs analisados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportToExcel(curva.map(c => ({
            'SKU': c.sku, 'Unidades': c.unidades, 'Faturamento': c.faturamento,
            '% Part.': c.participacao.toFixed(2) + '%', '% Acum.': c.participacaoAcumulada.toFixed(2) + '%', 'Classe': c.classe,
          })), 'curva-abc')} className="btn-secondary"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => exportToPDF('Análise Curva ABC', [
            { header: 'SKU', dataKey: 'sku' }, { header: 'Unidades', dataKey: 'unidades' },
            { header: 'Faturamento', dataKey: 'faturamento' }, { header: '% Part.', dataKey: 'participacao' }, { header: 'Classe', dataKey: 'classe' },
          ], curva.map(c => ({ ...c, participacao: c.participacao.toFixed(2) + '%' })), 'curva-abc')}
            className="btn-secondary"><FileText className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={lojaFilter} onChange={e => setLojaFilter(e.target.value)} className="input-field w-52">
          <option value="">Todas as lojas</option>
          {LOJAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-36" />
        <span style={{ color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-36" />
        {temFiltro && <button onClick={limparFiltros} className="btn-secondary"><X className="w-4 h-4" /> Limpar</button>}
      </div>

      {/* Cards A/B/C */}
      <div className="grid grid-cols-3 gap-4">
        {([['A', '80% do faturamento', totalA], ['B', '15% do faturamento', totalB], ['C', '5% do faturamento', totalC]] as [string, string, number][]).map(([cls, label, count]) => (
          <div key={cls} className="stat-card cursor-pointer"
            style={{ borderColor: filter === cls ? CLASS_COLORS[cls as 'A'|'B'|'C'] : undefined }}
            onClick={() => setFilter(filter === cls ? 'all' : cls as 'A'|'B'|'C')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                style={{ background: CLASS_BG[cls as 'A'|'B'|'C'], color: CLASS_COLORS[cls as 'A'|'B'|'C'] }}>{cls}</div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Classe {cls} — {label}</p>
                <p className="text-xl font-bold" style={{ color: CLASS_COLORS[cls as 'A'|'B'|'C'] }}>{count} SKUs</p>
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
              <YAxis stroke="#555570" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(val: number) => [formatCurrency(val), 'Faturamento']} />
              <Bar dataKey="faturamento" radius={[4, 4, 0, 0]}>
                {curva.slice(0, 10).map(entry => <Cell key={entry.sku} fill={CLASS_COLORS[entry.classe]} />)}
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
          <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Calculando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum dado para análise</p></div>
        ) : filtered.map(item => (
          <div key={item.sku} className="grid grid-cols-6 table-row items-center">
            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>#{curva.indexOf(item) + 1}</span>
            <span className="font-mono text-sm" style={{ color: 'var(--shopee-primary)' }}>{item.sku}</span>
            <span className="text-center text-sm">{item.unidades.toLocaleString('pt-BR')}</span>
            <span className="text-right text-sm font-semibold">{formatCurrency(item.faturamento)}</span>
            <span className="text-right text-sm">{item.participacao.toFixed(2)}%</span>
            <div className="flex justify-center">
              <span className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: CLASS_BG[item.classe], color: CLASS_COLORS[item.classe] }}>{item.classe}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
