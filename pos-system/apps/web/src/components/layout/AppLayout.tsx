import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { ToastContainer } from '@/components/ui/Toast'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = () => setCollapsed((c) => !c)

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <Topbar onMenuToggle={toggle} sidebarCollapsed={collapsed} />
      <main
        className={[
          'transition-all duration-250 pt-16 min-h-screen pb-20 md:pb-6',
          collapsed ? 'md:pl-[72px]' : 'md:pl-64',
        ].join(' ')}
      >
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <ToastContainer />
    </div>
  )
}
