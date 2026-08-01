/**
 * Precarga de las pantallas privadas. Se hace de a un chunk por vez y solo en
 * tiempo libre del hilo principal: bajar y evaluar todos los módulos a la vez
 * (recharts pesa ~330 kB) congelaba la interfaz justo después del login.
 */

type Cancel = () => void

function whenIdle(cb: () => void, timeout = 2000): Cancel {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(cb, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(cb, 200)
  return () => window.clearTimeout(id)
}

/**
 * Adelanta las pantallas de entrada según el rol (el panel arrastra el chunk de
 * gráficas), para que la navegación tras el login no descargue ni evalúe nada.
 */
export function preloadEntryPages(): Cancel {
  const cancelFirst = whenIdle(() => {
    void import('@/features/dashboard/DashboardPage').catch(() => {})
  }, 3000)
  const cancelSecond = whenIdle(() => {
    void import('@/features/pos/PosPage').catch(() => {})
  }, 5000)
  return () => {
    cancelFirst()
    cancelSecond()
  }
}

/** Ordenadas por probabilidad de uso; las más pesadas quedan al final. */
const routeLoaders: Array<() => Promise<unknown>> = [
  () => import('@/features/dashboard/DashboardPage'),
  () => import('@/features/pos/PosPage'),
  () => import('@/features/products/ProductsPage'),
  () => import('@/features/sales/SalesPage'),
  () => import('@/features/inventory/InventoryPage'),
  () => import('@/features/cash-register/CashRegisterPage'),
  () => import('@/features/customers/CustomersPage'),
  () => import('@/features/categories/CategoriesPage'),
  () => import('@/features/suppliers/SuppliersPage'),
  () => import('@/features/settings/SettingsPage'),
  () => import('@/features/branches/BranchesPage'),
  () => import('@/features/fiscal/FiscalPage'),
  () => import('@/features/audit/AuditPage'),
  () => import('@/features/reports/ReportsPage'),
]

export function preloadPrivatePages(): Cancel {
  const queue = [...routeLoaders]
  let cancelled = false
  let cancelIdle: Cancel = () => {}

  const step = () => {
    if (cancelled) return
    const load = queue.shift()
    if (!load) return
    load()
      .catch(() => {})
      .then(() => {
        if (!cancelled) cancelIdle = whenIdle(step)
      })
  }

  cancelIdle = whenIdle(step)

  return () => {
    cancelled = true
    cancelIdle()
  }
}
