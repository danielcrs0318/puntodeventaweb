import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CashRegisterSession {
  id: number
  userId: number
  openingAmount: number
  openedAt: string
  status: 'ABIERTA' | 'CERRADA'
  user?: { id: number; name: string }
  branch?: { id: number; code: string; name: string }
}

/** La caja es por usuario y sucursal: se guarda a quién pertenece la sesión en caché. */
export interface SessionOwner {
  userId: number | null
  branchId: number | null
}

interface CashRegisterState {
  activeSession: CashRegisterSession | null
  owner: SessionOwner
  setSession: (session: CashRegisterSession | null, owner: SessionOwner) => void
  closeSession: () => void
  clearSession: () => void
  sessionFor: (owner: SessionOwner) => CashRegisterSession | null
}

const emptyOwner: SessionOwner = { userId: null, branchId: null }

export const useCashRegisterStore = create<CashRegisterState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      owner: emptyOwner,

      setSession: (session, owner) => set({ activeSession: session, owner }),
      closeSession: () => set({ activeSession: null }),
      clearSession: () => set({ activeSession: null, owner: emptyOwner }),

      sessionFor: ({ userId, branchId }) => {
        const { activeSession, owner } = get()
        if (!activeSession || !userId || !branchId) return null
        if (owner.userId !== userId || owner.branchId !== branchId) return null
        return activeSession
      },
    }),
    {
      name: 'pos-cash-register',
      // v2 agrega el dueño de la sesión; lo guardado antes no se puede atribuir
      version: 2,
      migrate: () => ({ activeSession: null, owner: emptyOwner }),
    },
  ),
)
