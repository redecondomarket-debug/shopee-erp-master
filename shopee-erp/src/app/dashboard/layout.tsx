import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-60 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="p-6 min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
