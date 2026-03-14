'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

const GROUPS = [
  { label: 'Visão Geral', items: TABS.slice(0, 3)  },
  { label: 'Operações',   items: TABS.slice(3, 6)  },
  { label: 'Análises',    items: TABS.slice(6, 9)  },
  { label: 'Gestão',      items: TABS.slice(9, 12) },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [email,      setEmail]      = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email)
    })
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside style={{ width:220, background:'#0d0d16', borderRight:'1px solid #1e1e2c', minHeight:'100vh', display:'flex', flexDirection:'column', position:'sticky', top:0, flexShrink:0 }}>

      <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid #1e1e2c' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#ff6600,#ff9500)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0, boxShadow:'0 4px 12px #ff660040' }}>🛍️</div>
          <div>
            <div style={{ fontWeight:800, fontSize:12.5, letterSpacing:0.5, color:'#ff6600', lineHeight:1.2 }}>SHOPEE GESTÃO</div>
            <div style={{ fontSize:9.5, color:'#44445a', letterSpacing:0.8, marginTop:2 }}>Estoque Único · 3 Lojas</div>
          </div>
        </div>
      </div>

      <nav style={{ flex:1, padding:'10px 0 8px', overflowY:'auto' }}>
        {GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom:4 }}>
            <div style={{ padding:'8px 18px 3px', fontSize:9.5, fontWeight:700, color:'#30304a', letterSpacing:1.2, textTransform:'uppercase' as any }}>{group.label}</div>
            {group.items.map(t => {
              const active = pathname === t.href || (t.href !== '/dashboard' && pathname.startsWith(t.href))
              return (
                <Link key={t.href} href={t.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 18px', color:active?'#ff6600':'#58587a', fontWeight:active?600:400, fontSize:12.5, textDecoration:'none', background:active?'#ff660012':'transparent', borderLeft:`2px solid ${active?'#ff6600':'transparent'}`, transition:'all .12s', borderRadius:'0 7px 7px 0', marginRight:8 }}>
                  <span style={{ fontSize:14, opacity:active?1:0.55 }}>{t.icon}</span>
                  <span>{t.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding:'12px 18px 16px', borderTop:'1px solid #1e1e2c' }}>
        {email && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'#ff660022', border:'1px solid #ff660044', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>👤</div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontSize:10, color:'#55556a', fontWeight:600, letterSpacing:0.5 }}>LOGADO COMO</div>
              <div style={{ fontSize:11, color:'#9090aa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{email}</div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} disabled={loggingOut} style={{ width:'100%', background:'#ef444412', color:'#ef4444', border:'1px solid #ef444430', borderRadius:7, padding:'8px 0', cursor:loggingOut?'not-allowed':'pointer', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {loggingOut ? '⏳ Saindo...' : '🚪 Sair do Sistema'}
        </button>
        <div style={{ marginTop:10, fontSize:9, color:'#22223a', letterSpacing:0.8, fontWeight:600, textAlign:'center' }}>SHOPEE ERP MASTER v2.0</div>
      </div>

    </aside>
  )
}
