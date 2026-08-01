import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getHomePath } from '@/lib/access'

interface RoleRouteProps {
  roles: readonly string[]
  children: React.ReactNode
}

/** Solo renderiza children si el usuario tiene uno de los roles indicados. */
export function RoleRoute({ roles, children }: RoleRouteProps) {
  const hasRole = useAuthStore((s) => s.hasRole)
  if (!hasRole([...roles])) {
    return <Navigate to={getHomePath()} replace />
  }
  return <>{children}</>
}
