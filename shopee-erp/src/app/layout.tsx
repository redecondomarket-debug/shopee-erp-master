import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shopee ERP Master',
  description: 'Sistema de gestão completo para vendedores Shopee',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
