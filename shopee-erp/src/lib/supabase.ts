import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkkkzhuxkpyspzliwjkx.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhra2t6aHV4a3B5c3B6bGl3amt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODU3NTEsImV4cCI6MjA4ODY2MTc1MX0.YgSCxj3Cy-RHGnRjUzkN_Q2gN8amE3xnojVyFyjCAtg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      estoque: {
        Row: {
          id: string
          sku_base: string
          produto: string
          estoque_atual: number
          estoque_minimo: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['estoque']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['estoque']['Insert']>
      }
      sku_map: {
        Row: {
          id: string
          sku_venda: string
          sku_base: string
          quantidade: number
        }
        Insert: Omit<Database['public']['Tables']['sku_map']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['sku_map']['Insert']>
      }
      vendas: {
        Row: {
          id: string
          data: string
          loja: string
          pedido: string
          sku_venda: string
          quantidade: number
          valor_venda: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendas']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['vendas']['Insert']>
      }
      movimentacoes: {
        Row: {
          id: string
          data: string
          tipo: 'ENTRADA' | 'VENDA' | 'AJUSTE'
          sku_base: string
          quantidade: number
          origem: string
          observacao: string
        }
        Insert: Omit<Database['public']['Tables']['movimentacoes']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['movimentacoes']['Insert']>
      }
      financeiro: {
        Row: {
          id: string
          pedido: string
          data: string
          produto: string
          sku: string
          quantidade: number
          valor_bruto: number
          desconto: number
          frete: number
          comissao_shopee: number
          taxas_shopee: number
          valor_liquido: number
          loja: string
        }
        Insert: Omit<Database['public']['Tables']['financeiro']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['financeiro']['Insert']>
      }
      ads: {
        Row: {
          id: string
          data: string
          loja: string
          produto: string
          investimento: number
          vendas_geradas: number
          roas: number
        }
        Insert: Omit<Database['public']['Tables']['ads']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['ads']['Insert']>
      }
    }
  }
}
