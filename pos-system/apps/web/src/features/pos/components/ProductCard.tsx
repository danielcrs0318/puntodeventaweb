import { Package, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { formatCurrency } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/api'

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

interface ProductCardProps {
  product: Product
  onAdd: () => void
  inCart: boolean
}

export function ProductCard({ product, onAdd, inCart }: ProductCardProps) {
  const stock = product.inventory?.quantity ?? 0
  const noStock = stock <= 0
  const reduce = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onAdd}
      disabled={noStock}
      whileHover={reduce || noStock ? undefined : { y: -3, scale: 1.01 }}
      whileTap={reduce || noStock ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={[
        'relative flex flex-col rounded-xl border text-left overflow-hidden group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
        noStock
          ? 'opacity-50 cursor-not-allowed border-border-subtle bg-bg-elevated'
          : inCart
          ? 'border-accent-primary bg-bg-elevated shadow-glow-accent'
          : 'border-border-subtle bg-bg-elevated hover:border-accent-primary hover:shadow-glow-accent',
      ].join(' ')}
    >
      <div className="w-full aspect-square bg-bg-secondary flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img
            src={resolveMediaUrl(product.imageUrl)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <Package size={32} className="text-text-secondary opacity-30" />
        )}
      </div>

      <div className="p-2.5 flex-1 flex flex-col">
        <p className="text-xs font-medium text-text-primary line-clamp-2 leading-snug flex-1">
          {product.name}
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-accent-light">
            {formatCurrency(product.salePrice)}
          </span>
          <span
            className={[
              'text-xs font-medium',
              stock <= 5 ? 'text-yellow-400' : 'text-text-secondary',
            ].join(' ')}
          >
            {noStock ? 'Agotado' : `${stock} uds`}
          </span>
        </div>
      </div>

      {!noStock && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-accent-primary flex items-center justify-center shadow-elevated">
            <Plus size={14} className="text-white" />
          </div>
        </div>
      )}

      {inCart && (
        <motion.div
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-primary flex items-center justify-center"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          <span className="text-white text-xs font-bold">✓</span>
        </motion.div>
      )}
    </motion.button>
  )
}
