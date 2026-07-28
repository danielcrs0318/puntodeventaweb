import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, ArrowUpDown, PlusCircle, Search } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { toast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type InvTab = 'existencias' | 'movimientos' | 'ajuste'
type StockStatus = '' | 'bajo' | 'agotado' | 'ok'

interface StockItem {
  id: number
  quantity: number
  minStockAlert: number
  product: { id: number; sku: string; name: string; category?: { name: string } }
}

interface Movement {
  id: number
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  createdAt: string
  product: { name: string; sku: string }
  user?: { name: string }
}

const PAGE_SIZE = 20
const MOV_PAGE_SIZE = 30

const TYPE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE: 'Ajuste',
  COMPRA: 'Compra', DEVOLUCION: 'Devolución', VENTA: 'Venta',
}
const TYPE_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'neutral' | 'accent'> = {
  ENTRADA: 'success', COMPRA: 'success', DEVOLUCION: 'accent',
  SALIDA: 'danger', VENTA: 'danger',
  AJUSTE: 'warning',
}

export default function InventoryPage() {
  const [tab, setTab] = useState<InvTab>('existencias')
  const [search, setSearch] = useState('')
  const [stockStatus, setStockStatus] = useState<StockStatus>('')
  const [page, setPage] = useState(1)
  const [movSearch, setMovSearch] = useState('')
  const [movPage, setMovPage] = useState(1)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjProductId, setAdjProductId] = useState('')
  const [adjQty, setAdjQty] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [productPickerQ, setProductPickerQ] = useState('')
  const qc = useQueryClient()

  const debouncedSearch = useDebouncedValue(search)
  const debouncedMovSearch = useDebouncedValue(movSearch)
  const debouncedPickerQ = useDebouncedValue(productPickerQ)

  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['inventory-stock', page, debouncedSearch, stockStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (stockStatus) params.set('status', stockStatus)
      return (await api.get(`/inventory?${params}`)).data
    },
    enabled: tab === 'existencias',
  })

  const stock: StockItem[] = stockData?.data ?? []
  const stockTotal: number = stockData?.total ?? 0

  const { data: movements, isLoading: loadingMov } = useQuery({
    queryKey: ['inventory-movements', movPage, debouncedMovSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(movPage),
        limit: String(MOV_PAGE_SIZE),
      })
      if (debouncedMovSearch) params.set('search', debouncedMovSearch)
      return (await api.get(`/inventory/movements?${params}`)).data
    },
    enabled: tab === 'movimientos',
  })

  const { data: productOptions = [] } = useQuery({
    queryKey: ['inventory-product-picker', debouncedPickerQ],
    queryFn: async () => {
      if (debouncedPickerQ.trim().length < 1) {
        const res = await api.get('/products?limit=40&active=true')
        return res.data?.data ?? []
      }
      return (await api.get(`/products/search?q=${encodeURIComponent(debouncedPickerQ)}&active=true`)).data
    },
    enabled: showAdjust || tab === 'ajuste',
  })

  const adjustMutation = useMutation({
    mutationFn: () => api.post('/inventory/adjust', {
      productId: Number(adjProductId),
      quantity: Number(adjQty),
      reason: adjReason,
    }),
    onSuccess: () => {
      toast.success('Inventario ajustado')
      qc.invalidateQueries({ queryKey: ['inventory-stock'] })
      qc.invalidateQueries({ queryKey: ['inventory-movements'] })
      setShowAdjust(false)
      setAdjProductId(''); setAdjQty(''); setAdjReason(''); setProductPickerQ('')
    },
    onError: () => toast.error('Error al ajustar inventario'),
  })

  const movData: Movement[] = movements?.data ?? []
  const movTotal: number = movements?.total ?? 0

  const productSelectOptions = [
    { value: '', label: 'Selecciona un producto' },
    ...productOptions.map((p: { id: number; sku: string; name: string }) => ({
      value: String(p.id),
      label: `${p.sku} — ${p.name}`,
    })),
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">
            {tab === 'existencias' ? `${stockTotal} productos con registro de stock` : 'Control de existencias y movimientos'}
          </p>
        </div>
        <Button variant="primary" leftIcon={<PlusCircle size={16} />} onClick={() => setShowAdjust(true)} id="inventory-adjust-btn">
          Ajuste Manual
        </Button>
      </div>

      <div className="tabs mb-6">
        {(['existencias', 'movimientos', 'ajuste'] as InvTab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
            {t === 'existencias' ? 'Existencias' : t === 'movimientos' ? 'Movimientos' : 'Ajuste Manual'}
          </button>
        ))}
      </div>

      {tab === 'existencias' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              leftIcon={<Search size={16} />}
              className="w-full sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              {([
                { label: 'Todos', value: '' },
                { label: 'Stock bajo', value: 'bajo' },
                { label: 'Agotado', value: 'agotado' },
                { label: 'OK', value: 'ok' },
              ] as const satisfies ReadonlyArray<{ label: string; value: StockStatus }>).map((f) => (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => { setStockStatus(f.value); setPage(1) }}
                  className={`filter-chip ${stockStatus === f.value ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Table
            minWidth="880px"
            columns={[
              { key: 'sku', header: 'SKU', render: (s) => <span className="font-mono text-xs">{s.product.sku}</span> },
              { key: 'name', header: 'Producto', render: (s) => s.product.name },
              { key: 'category', header: 'Categoría', render: (s) => s.product.category?.name ?? '—' },
              { key: 'quantity', header: 'Stock Actual', align: 'center', render: (s) => {
                const low = s.quantity <= s.minStockAlert
                return <Badge variant={s.quantity <= 0 ? 'danger' : low ? 'warning' : 'success'} dot>{s.quantity}</Badge>
              }},
              { key: 'minStockAlert', header: 'Stock Mínimo', align: 'center', render: (s) => s.minStockAlert },
              { key: 'status', header: 'Estado', align: 'center', render: (s) => {
                if (s.quantity <= 0) return <Badge variant="danger">Agotado</Badge>
                if (s.quantity <= s.minStockAlert) return <Badge variant="warning">Stock bajo</Badge>
                return <Badge variant="success">OK</Badge>
              }},
              { key: 'actions', header: '', render: (s) => (
                <Button variant="ghost" size="sm" onClick={() => {
                  setAdjProductId(String(s.product.id))
                  setAdjQty(String(s.quantity))
                  setProductPickerQ(`${s.product.sku} ${s.product.name}`)
                  setShowAdjust(true)
                }}>Ajustar</Button>
              )},
            ]}
            data={stock}
            loading={loadingStock}
            keyExtractor={(s) => s.id}
            emptyMessage="Sin productos en inventario"
            emptyIcon={<Package size={48} />}
          />
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(stockTotal / PAGE_SIZE)}
            totalItems={stockTotal}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {tab === 'movimientos' && (
        <>
          <div className="mb-4">
            <Input
              placeholder="Buscar movimiento por producto o SKU..."
              value={movSearch}
              onChange={(e) => { setMovSearch(e.target.value); setMovPage(1) }}
              leftIcon={<Search size={16} />}
              className="w-full sm:max-w-xs"
            />
          </div>
          <Table
            minWidth="860px"
            columns={[
              { key: 'createdAt', header: 'Fecha', render: (m) => formatDate(m.createdAt) },
              { key: 'product', header: 'Producto', render: (m) => (
                <div><p className="font-medium text-text-primary">{m.product.name}</p>
                  <p className="text-xs text-text-secondary font-mono">{m.product.sku}</p></div>
              )},
              { key: 'type', header: 'Tipo', render: (m) => (
                <Badge variant={TYPE_VARIANTS[m.type] ?? 'neutral'}>{TYPE_LABELS[m.type] ?? m.type}</Badge>
              )},
              { key: 'quantity', header: 'Cantidad', align: 'center' },
              { key: 'previousStock', header: 'Stock Anterior', align: 'center' },
              { key: 'newStock', header: 'Stock Nuevo', align: 'center', render: (m) => (
                <span className={m.newStock < m.previousStock ? 'text-red-400' : 'text-green-400'}>{m.newStock}</span>
              )},
              { key: 'reason', header: 'Motivo', render: (m) => <span className="text-text-secondary text-xs">{m.reason}</span> },
              { key: 'user', header: 'Usuario', render: (m) => m.user?.name ?? '—' },
            ]}
            data={movData}
            loading={loadingMov}
            keyExtractor={(m) => m.id}
            emptyMessage="Sin movimientos registrados"
            emptyIcon={<ArrowUpDown size={48} />}
          />
          <Pagination
            currentPage={movPage}
            totalPages={Math.ceil(movTotal / MOV_PAGE_SIZE)}
            totalItems={movTotal}
            itemsPerPage={MOV_PAGE_SIZE}
            onPageChange={setMovPage}
          />
        </>
      )}

      {tab === 'ajuste' && (
        <div className="card max-w-lg">
          <h2 className="text-base font-semibold text-text-primary mb-4">Ajuste Manual de Stock</h2>
          <div className="space-y-4">
            <Input
              label="Buscar producto"
              placeholder="Nombre o SKU..."
              value={productPickerQ}
              onChange={(e) => setProductPickerQ(e.target.value)}
              leftIcon={<Search size={16} />}
            />
            <Select
              label="Producto"
              value={adjProductId}
              onChange={(e) => setAdjProductId(e.target.value)}
              options={productSelectOptions}
            />
            <Input label="Nueva cantidad en stock" type="number" min="0" step="0.001"
              value={adjQty} onChange={(e) => setAdjQty(e.target.value)}
              helperText="Ingresa la cantidad real contada en el inventario físico" />
            <Input label="Motivo del ajuste" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}
              placeholder="Ej: Conteo físico, merma, daño, etc." />
            <Button variant="primary" fullWidth onClick={() => adjustMutation.mutate()}
              loading={adjustMutation.isPending} disabled={!adjProductId || !adjQty || !adjReason}
              id="inventory-save-adjust-btn">
              Aplicar Ajuste
            </Button>
          </div>
        </div>
      )}

      <Modal isOpen={showAdjust && tab !== 'ajuste'} onClose={() => setShowAdjust(false)}
        title="Ajuste Rápido de Stock" size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowAdjust(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => adjustMutation.mutate()} loading={adjustMutation.isPending}
              disabled={!adjProductId || !adjQty || !adjReason} id="quick-adjust-btn">
              Aplicar
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Input
            label="Buscar producto"
            placeholder="Nombre o SKU..."
            value={productPickerQ}
            onChange={(e) => setProductPickerQ(e.target.value)}
            leftIcon={<Search size={16} />}
          />
          <Select label="Producto" value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)}
            options={productSelectOptions} />
          <Input label="Nueva cantidad" type="number" min="0" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} />
          <Input label="Motivo" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Conteo físico, merma..." />
        </div>
      </Modal>
    </div>
  )
}
