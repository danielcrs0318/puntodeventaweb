import { useState } from 'react'
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
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={20} /> },
  { to: '/pos', label: 'Punto de Venta', icon: <ShoppingCart size={20} /> },
  { to: '/products', label: 'Productos', icon: <Package size={20} />, roles: ['admin', 'supervisor', 'inventario'] },
  { to: '/categories', label: 'Categorías', icon: <Tags size={20} />, roles: ['admin', 'supervisor', 'inventario'] },
  { to: '/inventory', label: 'Inventario', icon: <ClipboardList size={20} />, roles: ['admin', 'supervisor', 'inventario'] },
  { to: '/customers', label: 'Clientes', icon: <Users size={20} /> },
  { to: '/suppliers', label: 'Proveedores', icon: <Truck size={20} />, roles: ['admin', 'supervisor', 'inventario'] },
  { to: '/sales', label: 'Ventas', icon: <Receipt size={20} /> },
  { to: '/cash-register', label: 'Caja', icon: <DollarSign size={20} /> },
  { to: '/reports', label: 'Reportes', icon: <BarChart3 size={20} />, roles: ['admin', 'supervisor'] },
  { to: '/fiscal', label: 'Facturación CAI', icon: <FileText size={20} />, roles: ['admin', 'supervisor'] },
  { to: '/audit', label: 'Auditoría', icon: <Shield size={20} />, roles: ['admin', 'supervisor'] },
  { to: '/settings', label: 'Configuración', icon: <Settings size={20} />, roles: ['admin'] },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, hasRole } = useAuthStore()
  const navigate = useNavigate()

  const visibleItems = navItems.filter(
    (item) => !item.roles || hasRole(item.roles),
  )

  return (
    <>
      {/* Overlay móvil */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity ${
          !collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onToggle}
      />

      <aside
        className={[
          'fixed top-0 left-0 h-full bg-bg-secondary border-r border-border-subtle z-40 flex flex-col',
          'transition-all duration-250',
          collapsed ? 'w-18' : 'w-64',
          // Móvil: siempre oculto a menos que esté abierto
          collapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border-subtle flex-shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-primary flex items-center justify-center flex-shrink-0">
              <Store size={20} className="text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary leading-tight truncate">
                  POS Honduras
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {user?.role.name ?? 'Sistema'}
                </p>
              </div>
            )}
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 no-scrollbar">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent-muted text-accent-light border border-accent-primary/30'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                  collapsed ? 'justify-center' : '',
                ].join(' ')
              }
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar-label truncate">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Toggle */}
        <div className="p-2 border-t border-border-subtle">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-150"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ChevronRight size={18} /> : (
              <span className="flex items-center gap-2">
                <ChevronLeft size={18} />
                <span className="text-xs sidebar-label">Colapsar</span>
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
