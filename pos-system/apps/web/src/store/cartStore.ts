import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartItem {
  productId: number
  sku: string
  name: string
  unitPrice: number
  taxRate: number
  quantity: number
  discount: number
  imageUrl?: string
}

interface CartState {
  items: CartItem[]
  globalDiscount: number
  customerId: number | null
  customerName: string | null

  addItem: (product: Omit<CartItem, 'quantity' | 'discount'>) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  updateDiscount: (productId: number, discount: number) => void
  setGlobalDiscount: (discount: number) => void
  setCustomer: (id: number | null, name: string | null) => void
  clearCart: () => void

  itemCount: () => number
  subtotal: () => number
  taxTotal: () => number
  discountTotal: () => number
  total: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      globalDiscount: 0,
      customerId: null,
      customerName: null,

      addItem: (product) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === product.productId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === product.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            }
          }
          return {
            items: [...state.items, { ...product, quantity: 1, discount: 0 }],
          }
        })
      },

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i,
          ),
        }))
      },

      updateDiscount: (productId, discount) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, discount: Math.max(0, discount) } : i,
          ),
        })),

      setGlobalDiscount: (discount) =>
        set({ globalDiscount: Math.max(0, Math.min(100, discount)) }),

      setCustomer: (id, name) => set({ customerId: id, customerName: name }),

      clearCart: () =>
        set({ items: [], globalDiscount: 0, customerId: null, customerName: null }),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () => {
        const { items, globalDiscount } = get()
        const rawSubtotal = items.reduce(
          (sum, i) => sum + i.unitPrice * i.quantity - i.discount,
          0,
        )
        return rawSubtotal * (1 - globalDiscount / 100)
      },

      taxTotal: () => {
        const { items, globalDiscount } = get()
        return items.reduce((sum, i) => {
          const lineBase = (i.unitPrice * i.quantity - i.discount) * (1 - globalDiscount / 100)
          return sum + lineBase * i.taxRate
        }, 0)
      },

      discountTotal: () => {
        const { items, globalDiscount } = get()
        const lineDiscounts = items.reduce((sum, i) => sum + i.discount, 0)
        const rawSubtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
        const globalDiscountAmount = rawSubtotal * (globalDiscount / 100)
        return lineDiscounts + globalDiscountAmount
      },

      total: () => {
        const state = get()
        return state.subtotal() + state.taxTotal()
      },
    }),
    {
      name: 'pos-cart',
    },
  ),
)
