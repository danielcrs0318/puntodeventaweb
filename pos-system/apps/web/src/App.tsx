import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { RoleRoute } from '@/components/auth/RoleRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/ui/Spinner'
import { ToastContainer } from '@/components/ui/Toast'
import { getHomePath, rolesFor } from '@/lib/access'
import { preloadPrivatePages } from '@/lib/prefetch'

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const PosPage = lazy(() => import('@/features/pos/PosPage'))
const ProductsPage = lazy(() => import('@/features/products/ProductsPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const SalesPage = lazy(() => import('@/features/sales/SalesPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const SuppliersPage = lazy(() => import('@/features/suppliers/SuppliersPage'))
const CashRegisterPage = lazy(() => import('@/features/cash-register/CashRegisterPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const FiscalPage = lazy(() => import('@/features/fiscal/FiscalPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const CategoriesPage = lazy(() => import('@/features/categories/CategoriesPage'))
const AuditPage = lazy(() => import('@/features/audit/AuditPage'))
const BranchesPage = lazy(() => import('@/features/branches/BranchesPage'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

function HomeRedirect() {
  return <Navigate to={getHomePath()} replace />
}

function Guard({ route, children }: { route: Parameters<typeof rolesFor>[0]; children: React.ReactNode }) {
  return <RoleRoute roles={rolesFor(route)}>{children}</RoleRoute>
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return
    // Espera a que la primera pantalla termine de montarse antes de encolar el resto.
    let cancelPreload: (() => void) | undefined
    const timer = window.setTimeout(() => {
      cancelPreload = preloadPrivatePages()
    }, 1500)
    return () => {
      window.clearTimeout(timer)
      cancelPreload?.()
    }
  }, [isAuthenticated])

  return (
    <ErrorBoundary>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<Guard route="dashboard"><DashboardPage /></Guard>} />
            <Route path="pos" element={<Guard route="pos"><PosPage /></Guard>} />
            <Route path="products" element={<Guard route="products"><ProductsPage /></Guard>} />
            <Route path="categories" element={<Guard route="categories"><CategoriesPage /></Guard>} />
            <Route path="inventory" element={<Guard route="inventory"><InventoryPage /></Guard>} />
            <Route path="sales" element={<Guard route="sales"><SalesPage /></Guard>} />
            <Route path="customers" element={<Guard route="customers"><CustomersPage /></Guard>} />
            <Route path="suppliers" element={<Guard route="suppliers"><SuppliersPage /></Guard>} />
            <Route path="cash-register" element={<Guard route="cash-register"><CashRegisterPage /></Guard>} />
            <Route path="reports" element={<Guard route="reports"><ReportsPage /></Guard>} />
            <Route path="fiscal" element={<Guard route="fiscal"><FiscalPage /></Guard>} />
            <Route path="branches" element={<Guard route="branches"><BranchesPage /></Guard>} />
            <Route path="audit" element={<Guard route="audit"><AuditPage /></Guard>} />
            <Route path="settings" element={<Guard route="settings"><SettingsPage /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
