import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BranchInfo {
  id: number
  code: string
  name: string
  isMain?: boolean
  isDefault?: boolean
}

interface User {
  id: number
  name: string
  email: string
  role: {
    id: number
    name: string
    permissions: string[]
  }
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  branches: BranchInfo[]
  activeBranch: BranchInfo | null
  setAuth: (
    user: User,
    accessToken: string,
    refreshToken: string,
    branches?: BranchInfo[],
    activeBranch?: BranchInfo | null,
  ) => void
  setActiveBranch: (branch: BranchInfo) => void
  logout: () => void
  hasRole: (roles: string[]) => boolean
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      branches: [],
      activeBranch: null,

      setAuth: (user, accessToken, refreshToken, branches = [], activeBranch = null) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          branches,
          activeBranch: activeBranch ?? branches.find((b) => b.isDefault) ?? branches[0] ?? null,
        }),

      setActiveBranch: (branch) => set({ activeBranch: branch }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          branches: [],
          activeBranch: null,
        }),

      hasRole: (roles: string[]) => {
        const user = get().user
        if (!user) return false
        return roles.includes(user.role.name)
      },

      hasPermission: (permission: string) => {
        const user = get().user
        if (!user) return false
        return user.role.permissions.includes(permission)
      },
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        branches: state.branches,
        activeBranch: state.activeBranch,
      }),
    },
  ),
)
