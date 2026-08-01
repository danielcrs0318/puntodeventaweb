import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  useCashRegisterStore,
  type CashRegisterSession,
} from '@/store/cashRegisterStore'

/**
 * Caja abierta del usuario y la sucursal actuales, confirmada por el servidor.
 * La caché local solo se usa mientras responde el API y únicamente si pertenece
 * a la misma combinación usuario + sucursal.
 */
export function useActiveCashSession() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const branchId = useAuthStore((s) => s.activeBranch?.id ?? null)
  const setSession = useCashRegisterStore((s) => s.setSession)
  const sessionFor = useCashRegisterStore((s) => s.sessionFor)

  const { data, isLoading } = useQuery<CashRegisterSession | null>({
    queryKey: ['active-session', userId, branchId],
    queryFn: async () =>
      (await api.get('/cash-register/active-session')).data ?? null,
    enabled: Boolean(userId && branchId),
  })

  useEffect(() => {
    if (data === undefined) return
    setSession(data, { userId, branchId })
  }, [data, userId, branchId, setSession])

  const cached = sessionFor({ userId, branchId })

  return {
    session: data !== undefined ? data : cached,
    isLoading: isLoading && cached === null,
  }
}
