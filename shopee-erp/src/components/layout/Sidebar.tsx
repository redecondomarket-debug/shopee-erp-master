'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Package, ShoppingCart, DollarSign,
  Megaphone, TrendingUp, ClipboardList, Download,
  ShoppingBag, LogOut, ChevronRight, GitBranch
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/estoque', icon: Package, label: 'Estoque' },
  { href: '/sku-map', icon: GitBranch, label: 'Composição SKUs' },
  { href: '/vendas', icon: ShoppingCart, label: 'Vendas' },
  { href: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { href: '/ads', icon: Megaphone, label: 'Shopee Ads' },
  { href: '/curva-abc', icon: TrendingUp, label: 'Curva ABC' },
  { href: '/compras', icon: ClipboardList, label: 'Ordem de Compra' },
  { href: '/relatorios', icon: Download, label: 'Relatórios' },
]

const lojas = ['KL Market', 'Universo dos Achados', 'Mundo dos Achados']

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col z-40"
           style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #EE2C00, #FF6535)' }}>
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Shopee ERP
            </div>
            <div className="text-xs" style={{ color: 'var(--shopee-primary)' }}>Master</div>
          </div>
        </div>
      </div>

      {/* Lojas */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Lojas
        </p>
        {lojas.map(loja => (
          <div key={loja} className="flex items-center gap-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{loja}</span>
          </div>
        ))}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group"
              style={{
                background: active ? 'rgba(238,44,0,0.12)' : 'transparent',
                color: active ? 'var(--shopee-primary)' : 'var(--text-secondary)',
              }}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,61,113,0.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  )
}
