import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'

/**
 * Los datos del API dependen del usuario y de la sucursal activa (X-Branch-Id),
 * pero las claves de caché no los incluyen. Se limpia la caché cuando cambia el
 * usuario o la sucursal para no mostrar datos de la sesión anterior.
 *
 * El valor vive fuera del componente porque AppLayout se desmonta al cerrar sesión.
 */
let lastScope: string | null = null

export function useSessionScope() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const branchId = useAuthStore((s) => s.activeBranch?.id ?? null)

  const scope = `${userId ?? 'anon'}:${branchId ?? 'none'}`

  useEffect(() => {
    if (lastScope === scope) return
    const hadPreviousScope = lastScope !== null
    lastScope = scope
    if (hadPreviousScope) {
      queryClient.clear()
    }
  }, [scope, queryClient])
}
