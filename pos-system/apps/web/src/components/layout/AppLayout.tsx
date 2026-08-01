import { useState, useEffect, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { easeOut } from '@/lib/motion'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { useSessionScope } from '@/hooks/useSessionScope'

export function AppLayout() {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isPos = location.pathname.startsWith('/pos')
  const reduce = useReducedMotion()
  const activeBranch = useAuthStore((s) => s.activeBranch)

  useSessionScope()

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const apply = () => {
      if (mq.matches) setDesktopCollapsed(true)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

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
          'transition-[padding] duration-200 ease-out pt-16 min-h-screen',
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
          {!activeBranch && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-lg border border-yellow-700/40 bg-warning-muted">
              <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300">
                  Sin sucursal asignada
                </p>
                <p className="text-xs text-yellow-400/80 mt-0.5">
                  Tu usuario no tiene una sucursal activa, por eso no se muestran datos.
                  Pide al administrador que te asigne una sucursal en Configuración → Usuarios.
                </p>
              </div>
            </div>
          )}

          <motion.div
            key={location.pathname}
            className="min-h-[calc(100vh-4rem)]"
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: easeOut }}
          >
            {/* Límite propio: el chunk de la página no oculta la barra ni el menú */}
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </div>
      </main>
      <MobileNav onOpenMore={() => setMobileOpen(true)} />
    </div>
  )
}
