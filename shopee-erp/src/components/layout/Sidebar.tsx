'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard',        icon: '⚡', label: 'Dashboard'        },
  { href: '/financeiro',       icon: '💰', label: 'Financeiro'       },
  { href: '/dre',              icon: '📊', label: 'DRE Diário'       },
  { href: '/estoque',          icon: '📦', label: 'Estoque'          },
  { href: '/movimentacao',     icon: '🔄', label: 'Movimentação'     },
  { href: '/ads',              icon: '📣', label: 'Shopee Ads'       },
  { href: '/analise-produtos', icon: '🔍', label: 'Análise Produtos' },
  { href: '/analise-ads',      icon: '📈', label: 'Análise Ads'      },
  { href: '/composicao',       icon: '🧩', label: 'Composição'       },
  { href: '/produtos-base',    icon: '🗂️', label: 'Produtos Base'    },
  { href: '/compras',          icon: '🛒', label: 'Ordem de Compra'  },
  { href: '/relatorios',       icon: '📋', label: 'Relatórios'       },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 200,
      background: '#0e0e17',
      borderRight: '1px solid #2a2a3a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
    }}>
      {/* LOGO */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid #2a2a3a',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 24 }}>🛍️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: -0.5, color: '#ff6600' }}>SHOPEE GESTÃO</div>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 1.5, textTransform: 'uppercase' }}>Estoque Único · 3 Lojas</div>
        </div>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {TABS.map(t => {
          const active = pathname === t.href || (t.href !== '/dashboard' && pathname.startsWith(t.href))
          return (
            <Link key={t.href} href={t.href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 16px',
              color: active ? '#ff6600' : '#666',
              fontWeight: active ? 700 : 400,
              fontSize: 13,
              textDecoration: 'none',
              background: active ? '#ff660015' : 'transparent',
              borderLeft: active ? '3px solid #ff6600' : '3px solid transparent',
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2a3a', fontSize: 10, color: '#333', letterSpacing: 0.5 }}>
        SHOPEE ERP MASTER v2.0
      </div>
    </aside>
  )
}
