import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  ShoppingCart,
  LogOut,
  User,
  Menu,
  AlertTriangle,
  DollarSign,
  Building2,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useCashRegisterStore } from '@/store/cashRegisterStore'
import { useCartStore } from '@/store/cartStore'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface TopbarProps {
  onMenuToggle: () => void
  desktopCollapsed: boolean
}

export function Topbar({ onMenuToggle, desktopCollapsed }: TopbarProps) {
  const { user, logout, branches, activeBranch, setActiveBranch } = useAuthStore()
  const { activeSession, clearSession } = useCashRegisterStore()
  const clearCart = useCartStore((s) => s.clearCart)
  const itemCount = useCartStore((s) => s.itemCount())
  const navigate = useNavigate()
  const qc = useQueryClient()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleBranchChange = (branchId: number) => {
    const next = branches.find((b) => b.id === branchId)
    if (!next || next.id === activeBranch?.id) return
    setActiveBranch(next)
    clearSession()
    clearCart()
    qc.clear()
  }

  return (
    <header
      className={[
        'fixed top-0 right-0 h-16 bg-bg-secondary border-b border-border-subtle z-30',
        'flex items-center px-3 sm:px-4 gap-2 sm:gap-3 transition-all duration-250',
        desktopCollapsed ? 'md:left-[72px]' : 'md:left-64',
        'left-0',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors touch-target"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {branches.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-[42%] sm:max-w-none">
          <Building2 size={16} className="text-accent-light flex-shrink-0 hidden xs:block sm:block" />
          {branches.length === 1 ? (
            <span className="text-sm font-medium text-text-primary truncate">
              {activeBranch?.name ?? branches[0].name}
            </span>
          ) : (
            <select
              className="bg-bg-elevated border border-border-subtle rounded-md text-sm text-text-primary px-2 py-1.5 max-w-[140px] sm:max-w-[200px] lg:max-w-[240px] truncate"
              value={activeBranch?.id ?? ''}
              onChange={(e) => handleBranchChange(Number(e.target.value))}
              aria-label="Sucursal activa"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        {activeSession ? (
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-success-muted border border-green-700/40">
            <DollarSign size={14} className="text-green-400" />
            <div className="hidden md:block">
              <p className="text-xs font-medium text-green-400 leading-none">Caja Abierta</p>
              <p className="text-xs text-text-secondary leading-none mt-0.5">
                {formatDateTime(activeSession.openedAt)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-warning-muted border border-yellow-700/40">
            <AlertTriangle size={14} className="text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400 hidden lg:block">
              Sin caja abierta
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-2" />

      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate('/pos')}
        leftIcon={<ShoppingCart size={14} />}
        className="hidden sm:inline-flex relative"
      >
        <span className="hidden md:inline">Nueva Venta</span>
        <span className="md:hidden">Venta</span>
        {itemCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white text-xs flex items-center justify-center font-bold">
            {itemCount > 9 ? '9+' : itemCount}
          </span>
        )}
      </Button>

      <button
        type="button"
        className="relative p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors hidden sm:inline-flex"
        aria-label="Notificaciones"
        onClick={() => navigate('/reports')}
      >
        <Bell size={18} />
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l border-border-subtle flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-accent-primary" />
        </div>
        <div className="hidden lg:block text-right max-w-[120px]">
          <p className="text-sm font-medium text-text-primary leading-none truncate">
            {user?.name ?? 'Usuario'}
          </p>
          <p className="text-xs text-text-secondary leading-none mt-0.5 capitalize truncate">
            {user?.role.name ?? ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 p-1.5 rounded text-text-secondary hover:text-danger hover:bg-danger-muted transition-all duration-150"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
