import { useAuthStore } from '@/store/authStore'

/** Roles permitidos por segmento de ruta (clave = path sin `/` inicial). */
export const ROUTE_ROLES = {
  dashboard: ['admin', 'supervisor'],
  pos: ['admin', 'supervisor', 'cajero'],
  products: ['admin', 'supervisor', 'inventario'],
  categories: ['admin', 'supervisor', 'inventario'],
  inventory: ['admin', 'supervisor', 'inventario'],
  customers: ['admin', 'supervisor', 'cajero'],
  suppliers: ['admin', 'supervisor', 'inventario'],
  sales: ['admin', 'supervisor', 'cajero'],
  'cash-register': ['admin', 'supervisor', 'cajero'],
  reports: ['admin', 'supervisor'],
  fiscal: ['admin', 'supervisor'],
  branches: ['admin'],
  audit: ['admin', 'supervisor'],
  settings: ['admin'],
} as const

export type RouteKey = keyof typeof ROUTE_ROLES

/** Ruta de inicio según el nombre del rol. */
export function homePathForRole(role: string): string {
  switch (role) {
    case 'admin':
    case 'supervisor':
      return '/dashboard'
    case 'inventario':
      return '/products'
    case 'cajero':
    default:
      return '/pos'
  }
}

/** Ruta de inicio del usuario autenticado actual. */
export function getHomePath(): string {
  const role = useAuthStore.getState().user?.role.name ?? ''
  return homePathForRole(role)
}

export function rolesFor(route: RouteKey): readonly string[] {
  return ROUTE_ROLES[route]
}
