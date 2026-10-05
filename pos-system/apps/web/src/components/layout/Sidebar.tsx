import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Truck,
  ClipboardList,
  DollarSign,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Store,
  Receipt,
  Tags,
  Shield,
  Building2,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useAuthStore } from '@/store/authStore'
import { getHomePath, rolesFor } from '@/lib/access'
import { easeOut, motionDur } from '@/lib/motion'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: readonly string[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={20} />, roles: rolesFor('dashboard') },
  { to: '/pos', label: 'Punto de Venta', icon: <ShoppingCart size={20} />, roles: rolesFor('pos') },
  { to: '/products', label: 'Productos', icon: <Package size={20} />, roles: rolesFor('products') },
  { to: '/categories', label: 'Categorías', icon: <Tags size={20} />, roles: rolesFor('categories') },
  { to: '/inventory', label: 'Inventario', icon: <ClipboardList size={20} />, roles: rolesFor('inventory') },
  { to: '/customers', label: 'Clientes', icon: <Users size={20} />, roles: rolesFor('customers') },
  { to: '/suppliers', label: 'Proveedores', icon: <Truck size={20} />, roles: rolesFor('suppliers') },
  { to: '/sales', label: 'Ventas', icon: <Receipt size={20} />, roles: rolesFor('sales') },
  { to: '/cash-register', label: 'Caja', icon: <DollarSign size={20} />, roles: rolesFor('cash-register') },
  { to: '/reports', label: 'Reportes', icon: <BarChart3 size={20} />, roles: rolesFor('reports') },
  { to: '/fiscal', label: 'Facturación CAI', icon: <FileText size={20} />, roles: rolesFor('fiscal') },
  { to: '/branches', label: 'Sucursales', icon: <Building2 size={20} />, roles: rolesFor('branches') },
  { to: '/audit', label: 'Auditoría', icon: <Shield size={20} />, roles: rolesFor('audit') },
  { to: '/settings', label: 'Configuración', icon: <Settings size={20} />, roles: rolesFor('settings') },
]

interface SidebarProps {
  desktopCollapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  onToggleDesktop: () => void
}

export function Sidebar({
  desktopCollapsed,
  mobileOpen,
  onCloseMobile,
  onToggleDesktop,
}: SidebarProps) {
  const { user, hasRole } = useAuthStore()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const visibleItems = navItems.filter(
    (item) => !item.roles || hasRole([...item.roles]),
  )

  // En móvil siempre mostrar etiquetas cuando está abierto
  const showLabels = mobileOpen || !desktopCollapsed

  return (
    <>
      <motion.div
        className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        initial={false}
        animate={{ opacity: mobileOpen ? 1 : 0 }}
        transition={{ duration: motionDur.fast }}
        onClick={onCloseMobile}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={[
          'fixed top-0 left-0 h-full bg-bg-secondary border-r border-border-subtle z-40 flex flex-col shadow-sm',
          'transition-[width,transform] duration-300 ease-out',
          // Ancho: en móvil siempre w-64; en desktop según colapso
          'w-64',
          desktopCollapsed ? 'md:w-[72px]' : 'md:w-64',
          // Visibilidad móvil
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center h-16 px-4 border-b border-border-subtle flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              navigate(getHomePath())
              onCloseMobile()
            }}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-primary flex items-center justify-center flex-shrink-0">
              <Store size={20} className="text-white" />
            </div>
            <AnimatePresence initial={false}>
              {showLabels && (
                <motion.div
                  className="min-w-0 md:block"
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: motionDur.fast, ease: easeOut }}
                >
                  <p className="text-sm font-bold text-text-primary leading-tight truncate">
                    POS Honduras
                  </p>
                  <p className="text-xs text-text-secondary truncate capitalize">
                    {user?.role.name ?? 'Sistema'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1 no-scrollbar">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={!showLabels ? item.label : undefined}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                [
                  'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors duration-150 overflow-hidden',
                  isActive
                    ? 'text-accent-light'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                  !showLabels ? 'md:justify-center' : '',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-accent-muted border border-border-subtle"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex-shrink-0">{item.icon}</span>
                  <AnimatePresence initial={false}>
                    {showLabels && (
                      <motion.span
                        className="relative z-10 truncate"
                        initial={reduce ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: motionDur.fast, ease: easeOut }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-border-subtle hidden md:block">
          <button
            type="button"
            onClick={onToggleDesktop}
            className="w-full flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-150"
            aria-label={desktopCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {desktopCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <span className="flex items-center gap-2">
                <ChevronLeft size={18} />
                <span className="text-xs">Colapsar</span>
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
