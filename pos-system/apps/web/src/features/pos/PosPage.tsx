import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  User,
  ShoppingCart,
  ChevronRight,
  X,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Percent,
  Package,
  Tag,
} from 'lucide-react'
import api from '@/lib/api'
import { useCartStore } from '@/store/cartStore'
import { useActiveCashSession } from '@/hooks/useActiveCashSession'
import { formatCurrency, calculateChange } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { PaymentModal } from './components/PaymentModal'
import { CustomerSearchModal } from './components/CustomerSearchModal'
import { ProductCard } from './components/ProductCard'

interface Product {
  id: number
  sku: string
  name: string
  salePrice: number
  taxRate: number
  imageUrl?: string
  barcode?: string
  inventory?: { quantity: number }
}

export default function PosPage() {
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showCustomer, setShowCustomer] = useState(false)
  const [showCart, setShowCart] = useState(false) // móvil
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { session: activeSession } = useActiveCashSession()
  const { user } = useAuthStore()

  const {
    items,
    addItem,
    updateQuantity,
    updateDiscount,
    removeItem,
    globalDiscount,
    setGlobalDiscount,
    setCustomer,
    customerId,
    customerName,
    clearCart,
    subtotal,
    taxTotal,
    discountTotal,
    total,
    itemCount,
  } = useCartStore()

  // Atajos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'F4' && items.length > 0) {
        e.preventDefault()
        setShowPayment(true)
      }
      if (e.key === 'Escape') {
        setShowPayment(false)
        setShowCustomer(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length])

  // Búsqueda de productos
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products-pos', search],
    queryFn: async () => {
      if (!search.trim()) {
        const res = await api.get('/products?limit=40&active=true')
        return res.data.data ?? res.data
      }
      const res = await api.get(`/products/search?q=${encodeURIComponent(search)}&active=true`)
      return res.data
    },
    staleTime: 30000,
  })

  const handleAddProduct = (product: Product) => {
    if ((product.inventory?.quantity ?? 0) <= 0) {
      toast.warning('Sin stock', `${product.name} no tiene unidades disponibles`, {
        position: 'top-left',
      })
      return
    }
    addItem({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitPrice: product.salePrice,
      taxRate: product.taxRate,
      imageUrl: product.imageUrl,
    })
    toast.success('Agregado al carrito', product.name, { position: 'top-left', duration: 2500 })
  }

  // Alerta si no hay caja
  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-2xl bg-warning-muted flex items-center justify-center mb-4">
          <ShoppingCart size={36} className="text-yellow-400" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Sin caja abierta
        </h2>
        <p className="text-text-secondary mb-6 max-w-xs">
          Debes abrir una caja antes de comenzar a registrar ventas
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/cash-register')}
          rightIcon={<ChevronRight size={16} />}
        >
          Abrir Caja
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-4rem-4rem)] md:h-[calc(100dvh-4rem)] gap-0 lg:gap-4 p-3 sm:p-4">
      {/* ────────── Panel izquierdo: Catálogo ────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra de búsqueda */}
        <div className="flex gap-2 mb-3 sm:mb-4">
          <Input
            ref={searchRef}
            placeholder="Buscar producto, SKU o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
            rightIcon={search ? (
              <button type="button" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            ) : <Barcode size={16} />}
            id="pos-search-input"
          />
          {/* Botón carrito — móvil y tablet */}
          <Button
            variant="secondary"
            size="icon"
            className="lg:hidden relative flex-shrink-0"
            onClick={() => setShowCart(true)}
            aria-label="Ver carrito"
          >
            <ShoppingCart size={18} />
            {itemCount() > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent-primary text-white text-xs flex items-center justify-center font-bold">
                {itemCount()}
              </span>
            )}
          </Button>
        </div>

        {/* Atajos de teclado — solo desktop */}
        <div className="hidden lg:flex gap-3 mb-3 text-xs text-text-secondary">
          <span><span className="kbd">F2</span> Buscar</span>
          <span><span className="kbd">F4</span> Cobrar</span>
          <span><span className="kbd">Esc</span> Cerrar</span>
        </div>

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card h-36 sm:h-40 animate-pulse bg-bg-hover" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <Package size={48} className="empty-state-icon opacity-30" />
              <p className="empty-state-title">Sin resultados</p>
              <p className="empty-state-desc">
                No se encontraron productos para &quot;{search}&quot;
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => handleAddProduct(product)}
                  inCart={items.some((i) => i.productId === product.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop carrito (móvil/tablet) */}
      {showCart && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setShowCart(false)}
          aria-hidden
        />
      )}

      {/* ────────── Panel derecho: Carrito ────────── */}
      <div
        className={[
          'flex flex-col bg-bg-secondary border border-border-subtle',
          // Desktop: panel fijo
          'lg:w-96 lg:flex-shrink-0 lg:rounded-xl lg:relative lg:translate-x-0',
          // Móvil/tablet: drawer
          'fixed inset-y-0 right-0 top-16 z-50 w-full max-w-md',
          'lg:inset-auto lg:top-auto lg:z-auto lg:max-w-none',
          'transition-transform duration-250',
          showCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Header carrito */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-accent-primary" />
            <span className="font-semibold text-text-primary">
              Carrito ({itemCount()})
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Cliente */}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<User size={14} />}
              onClick={() => setShowCustomer(true)}
              id="pos-select-customer-btn"
            >
              {customerName ?? 'Cons. Final'}
            </Button>
            {customerName && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCustomer(null, null)}
              >
                <X size={14} />
              </Button>
            )}
            {/* Cerrar en móvil/tablet */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setShowCart(false)}
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Líneas del carrito */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="empty-state py-12">
              <ShoppingCart size={40} className="empty-state-icon opacity-20" />
              <p className="empty-state-title text-base">Carrito vacío</p>
              <p className="empty-state-desc text-xs">
                Selecciona productos del catálogo o usa el escáner
              </p>
            </div>
          ) : (
            items.map((item) => (
              <CartItem
                key={item.productId}
                item={item}
                onQuantityChange={(q) => updateQuantity(item.productId, q)}
                onDiscountChange={(d) => updateDiscount(item.productId, d)}
                onRemove={() => removeItem(item.productId)}
              />
            ))
          )}
        </div>

        {/* Descuento global */}
        {items.length > 0 && (
          <div className="px-4 py-2 border-t border-border-subtle">
            <div className="flex items-center gap-2">
              <Percent size={14} className="text-text-secondary" />
              <span className="text-xs text-text-secondary flex-1">
                Descuento global
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                  className="w-14 text-right text-sm bg-bg-primary border border-border-subtle rounded px-2 py-1 text-text-primary"
                  id="pos-global-discount-input"
                />
                <span className="text-sm text-text-secondary">%</span>
              </div>
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="px-4 py-3 border-t border-border-subtle space-y-1.5">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal())}</span>
          </div>
          {discountTotal() > 0 && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Descuento</span>
              <span>-{formatCurrency(discountTotal())}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-text-secondary">
            <span>ISV (15%)</span>
            <span>{formatCurrency(taxTotal())}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-text-primary border-t border-border-subtle pt-2 mt-2">
            <span>TOTAL</span>
            <span className="text-accent-light">{formatCurrency(total())}</span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="p-3 border-t border-border-subtle flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={items.length === 0}
            onClick={() => setShowPayment(true)}
            leftIcon={<CreditCard size={18} />}
            id="pos-checkout-btn"
          >
            Cobrar — <span className="kbd ml-1 bg-accent-hover/30 border-accent-primary/40 text-white">F4</span>
          </Button>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => {
                clearCart()
                toast.info('Carrito', 'Carrito vaciado')
              }}
              leftIcon={<Trash2 size={14} />}
            >
              Vaciar carrito
            </Button>
          )}
        </div>
      </div>

      {/* Modales */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total()}
        items={items}
        customerId={customerId}
        sessionId={activeSession.id}
        userId={user!.id}
        onSuccess={() => {
          setShowPayment(false)
          setShowCart(false)
          clearCart()
        }}
      />

      <CustomerSearchModal
        isOpen={showCustomer}
        onClose={() => setShowCustomer(false)}
        onSelect={(id, name) => {
          setCustomer(id, name)
          setShowCustomer(false)
        }}
      />
    </div>
  )
}

// ─── CartItem inline component ───
interface CartItemProps {
  item: {
    productId: number
    name: string
    unitPrice: number
    taxRate: number
    quantity: number
    discount: number
  }
  onQuantityChange: (q: number) => void
  onDiscountChange: (d: number) => void
  onRemove: () => void
}

function CartItem({ item, onQuantityChange, onDiscountChange, onRemove }: CartItemProps) {
  const lineSubtotal = (item.unitPrice * item.quantity - item.discount) * (1 + item.taxRate)

  return (
    <div className="bg-bg-elevated rounded-lg p-3 border border-border-subtle">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {item.name}
          </p>
          <p className="text-xs text-text-secondary">
            {formatCurrency(item.unitPrice)} / ud
          </p>
        </div>
        <button
          onClick={onRemove}
          className="text-text-secondary hover:text-danger transition-colors p-0.5 flex-shrink-0"
          aria-label="Eliminar item"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {/* Controles de cantidad */}
        <div className="flex items-center gap-1 bg-bg-primary rounded border border-border-subtle">
          <button
            onClick={() => onQuantityChange(item.quantity - 1)}
            className="p-1.5 hover:bg-bg-hover rounded-l transition-colors"
          >
            <Minus size={12} />
          </button>
          <input
            type="number"
            min="0.001"
            step="1"
            value={item.quantity}
            onChange={(e) => onQuantityChange(Number(e.target.value))}
            className="w-12 text-center text-sm bg-transparent text-text-primary border-none focus:outline-none"
          />
          <button
            onClick={() => onQuantityChange(item.quantity + 1)}
            className="p-1.5 hover:bg-bg-hover rounded-r transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Descuento por línea */}
        <div className="flex items-center gap-1 flex-1">
          <Tag size={11} className="text-text-secondary flex-shrink-0" />
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.discount}
            onChange={(e) => onDiscountChange(Number(e.target.value))}
            placeholder="Desc."
            className="w-full text-right text-xs bg-bg-primary border border-border-subtle rounded px-2 py-1 text-text-primary"
            title="Descuento en L."
          />
        </div>

        <span className="text-sm font-semibold text-accent-light ml-auto">
          {formatCurrency(lineSubtotal)}
        </span>
      </div>
    </div>
  )
}
