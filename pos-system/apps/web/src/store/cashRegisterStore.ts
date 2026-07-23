import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CashRegisterSession {
  id: number
  userId: number
  openingAmount: number
  openedAt: string
  status: 'ABIERTA' | 'CERRADA'
}

interface CashRegisterState {
  activeSession: CashRegisterSession | null
  setActiveSession: (session: CashRegisterSession | null) => void
  openSession: (session: CashRegisterSession) => void
  closeSession: () => void
}

export const useCashRegisterStore = create<CashRegisterState>()(
  persist(
    (set) => ({
      activeSession: null,
      setActiveSession: (session) => set({ activeSession: session }),
      openSession: (session) => set({ activeSession: session }),
      closeSession: () => set({ activeSession: null }),
    }),
    { name: 'pos-cash-register' },
  ),
)
