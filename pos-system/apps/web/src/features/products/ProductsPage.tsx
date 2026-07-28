import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit, Trash2, Package, Upload } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog, Pagination } from '@/components/ui/index'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'
import { ProductFormModal } from './components/ProductFormModal'
import { ImportProductsModal } from './components/ImportProductsModal'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

interface Product {
  id: number
  sku: string
  name: string
  salePrice: number
  costPrice: number
  taxRate: number
  isActive: boolean
  category?: { name: string }
  inventory?: { quantity: number; minStockAlert: number }
  imageUrl?: string
}

const PAGE_SIZE = 20

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [filterActive, setFilterActive] = useState<boolean | undefined>(true)
  const qc = useQueryClient()
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, debouncedSearch, filterActive],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filterActive !== undefined ? { active: String(filterActive) } : {}),
      })
      const res = await api.get(`/products?${params}`)
      return res.data
    },
  })

  const products: Product[] = data?.data ?? []
  const total: number = data?.total ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto eliminado')
      setDeleteProduct(null)
    },
    onError: () => toast.error('No se pudo eliminar el producto'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.patch(`/products/${id}`, { isActive: active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Estado actualizado')
    },
  })

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">{total} productos en total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Upload size={14} />} onClick={() => setShowImport(true)}>
            Importar CSV
          </Button>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditProduct(null); setShowForm(true) }} id="product-create-btn">
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Buscar por nombre, SKU o código de barras..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          leftIcon={<Search size={16} />}
          className="w-full sm:max-w-xs"
        />
        <div className="flex gap-2">
          {[{ label: 'Activos', value: true }, { label: 'Inactivos', value: false }, { label: 'Todos', value: undefined }].map((f) => (
            <button
              key={String(f.value)}
              onClick={() => { setFilterActive(f.value); setPage(1) }}
              className={`filter-chip ${filterActive === f.value ? 'active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <Table
        minWidth="960px"
        columns={[
          {
            key: 'image', header: '', width: '60px',
            render: (p) => (
              <div className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center overflow-hidden">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  : <Package size={18} className="text-text-secondary opacity-40" />
                }
              </div>
            ),
          },
          { key: 'sku', header: 'SKU', sortable: true },
          { key: 'name', header: 'Nombre', sortable: true },
          { key: 'category', header: 'Categoría', render: (p) => p.category?.name ?? '—' },
          {
            key: 'inventory', header: 'Stock', align: 'center',
            render: (p) => {
              const qty = p.inventory?.quantity ?? 0
              const min = p.inventory?.minStockAlert ?? 0
              return (
                <Badge variant={qty <= 0 ? 'danger' : qty <= min ? 'warning' : 'success'} dot>
                  {qty}
                </Badge>
              )
            },
          },
          {
            key: 'costPrice', header: 'Costo', align: 'right',
            render: (p) => formatCurrency(p.costPrice),
          },
          {
            key: 'salePrice', header: 'Precio Venta', align: 'right',
            render: (p) => <span className="font-semibold text-accent-light">{formatCurrency(p.salePrice)}</span>,
          },
          {
            key: 'taxRate', header: 'ISV', align: 'center',
            render: (p) => `${(p.taxRate * 100).toFixed(0)}%`,
          },
          {
            key: 'isActive', header: 'Estado', align: 'center',
            render: (p) => (
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: p.id, active: !p.isActive }) }}
                title={p.isActive ? 'Desactivar' : 'Activar'}
              >
                <Badge variant={p.isActive ? 'success' : 'neutral'} dot>
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </button>
            ),
          },
          {
            key: 'actions', header: 'Acciones', align: 'center',
            render: (p) => (
              <div className="flex items-center justify-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditProduct(p); setShowForm(true) }} aria-label="Editar">
                  <Edit size={15} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteProduct(p)} aria-label="Eliminar">
                  <Trash2 size={15} className="text-danger" />
                </Button>
              </div>
            ),
          },
        ]}
        data={products}
        loading={isLoading}
        keyExtractor={(p) => p.id}
        emptyMessage="No hay productos"
        emptyIcon={<Package size={48} />}
      />

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Modales */}
      <ProductFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null) }}
        product={editProduct}
        onSuccess={() => { qc.invalidateQueries({ queryKey: ['products'] }); setShowForm(false) }}
      />

      <ImportProductsModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => { qc.invalidateQueries({ queryKey: ['products'] }); setShowImport(false) }}
      />

      <ConfirmDialog
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={() => deleteMutation.mutate(deleteProduct!.id)}
        title="Eliminar Producto"
        message={`¿Estás seguro de eliminar "${deleteProduct?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
