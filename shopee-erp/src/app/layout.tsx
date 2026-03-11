import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Shopee ERP Master',
  description: 'Gestão de vendas Shopee — Estoque único · 3 lojas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, background: '#0b0b12', color: '#e2e2f0', fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#0b0b12' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
