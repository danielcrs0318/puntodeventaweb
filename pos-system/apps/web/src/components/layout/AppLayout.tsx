import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { ToastContainer } from '@/components/ui/Toast'

export function AppLayout() {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isPos = location.pathname.startsWith('/pos')

  // En tablet, colapsar sidebar a iconos por defecto
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const apply = () => {
      if (mq.matches) setDesktopCollapsed(true)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Cerrar drawer móvil al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar
        desktopCollapsed={desktopCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleDesktop={() => setDesktopCollapsed((c) => !c)}
      />
      <Topbar
        onMenuToggle={() => setMobileOpen((o) => !o)}
        desktopCollapsed={desktopCollapsed}
      />
      <main
        className={[
          'transition-all duration-250 pt-16 min-h-screen',
          isPos ? 'pb-16 md:pb-0' : 'pb-20 md:pb-6',
          desktopCollapsed ? 'md:pl-[72px]' : 'md:pl-64',
        ].join(' ')}
      >
        <div
          className={
            isPos
              ? 'p-0 max-w-none'
              : 'p-4 sm:p-5 md:p-6 max-w-[1600px] mx-auto w-full'
          }
        >
          <Outlet />
        </div>
      </main>
      <MobileNav onOpenMore={() => setMobileOpen(true)} />
      <ToastContainer />
    </div>
  )
}
