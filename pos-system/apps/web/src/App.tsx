import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/ui/Spinner'

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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="cash-register" element={<CashRegisterPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="fiscal" element={<FiscalPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
