/**
 * useCustoProduto — Hook centralizado de custo de produto
 *
 * Lógica: para cada venda, busca a entrada de estoque mais recente
 * ANTERIOR à data da venda e usa aquele custo_unitario.
 * Fallback: se não encontrar entrada com custo, usa estoque.custo.
 *
 * Usado por: DRE, Dashboard, Financeiro, Análise Produtos,
 *            Resultado, Monitor ROAS, Movimentação
 */

import { useMemo } from 'react'

type EstoqueRow     = { sku_base: string; custo: number; custo_embalagem: number }
type SkuMapRow      = { sku_venda: string; sku_base: string; quantidade: number }
type MovimentacaoRow = { sku_base: string; tipo: string; data: string; custo_unitario: number }

export function useCustoProduto(
  estoque:      EstoqueRow[],
  skuMapData:   SkuMapRow[],
  movimentacoes: MovimentacaoRow[],
) {
  // Pré-filtra só as ENTRADAs com custo > 0, ordenadas por data desc
  const entradas = useMemo(() =>
    movimentacoes
      .filter(m => m.tipo === 'ENTRADA' && m.custo_unitario > 0)
      .sort((a, b) => b.data.localeCompare(a.data)),  // mais recente primeiro
  [movimentacoes])

  /**
   * Retorna o custo unitário do produto base para uma data de venda.
   * Busca a entrada mais recente anterior ou igual à data da venda.
   * Se não encontrar, usa estoque.custo como fallback.
   */
  function getCustoUnit(skuBase: string, dataVenda: string): number {
    // Entrada mais recente com data <= dataVenda
    const entrada = entradas.find(
      m => m.sku_base === skuBase && m.data <= dataVenda
    )
    if (entrada) return entrada.custo_unitario

    // Fallback: custo fixo do cadastro de estoque
    return estoque.find(e => e.sku_base === skuBase)?.custo || 0
  }

  /**
   * Calcula o custo total de um SKU de venda para uma data específica.
   * Inclui custo_embalagem do produto principal.
   */
  function calcCustoProd(skuVendido: string, quantidade: number, dataVenda: string): number {
    if (!skuVendido) return 0
    const comps = skuMapData.filter(m => m.sku_venda === skuVendido)
    if (!comps.length) return 0

    const custoProd = comps.reduce((t, c) => {
      return t + getCustoUnit(c.sku_base, dataVenda) * (c.quantidade || 1) * quantidade
    }, 0)

    // custo_embalagem do produto principal (não muda com o lote — é fixo)
    const principal = estoque.find(e => e.sku_base === comps[0]?.sku_base)
    return custoProd + (principal?.custo_embalagem || 0)
  }

  return { calcCustoProd, getCustoUnit }
}

