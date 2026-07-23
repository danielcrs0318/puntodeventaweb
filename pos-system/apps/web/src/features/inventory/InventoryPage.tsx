import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Layers, ArrowUpDown, PlusCircle, Search } from 'lucide-react'
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
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'

type InvTab = 'existencias' | 'movimientos' | 'ajuste'

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
  const [movPage, setMovPage] = useState(1)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjProductId, setAdjProductId] = useState('')
  const [adjQty, setAdjQty] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data: stock = [], isLoading: loadingStock } = useQuery<StockItem[]>({
    queryKey: ['inventory-stock'],
    queryFn: async () => (await api.get('/inventory')).data,
  })

  const { data: movements, isLoading: loadingMov } = useQuery({
    queryKey: ['inventory-movements', movPage],
    queryFn: async () => (await api.get(`/inventory/movements?page=${movPage}&limit=30`)).data,
    enabled: tab === 'movimientos',
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
      setAdjProductId(''); setAdjQty(''); setAdjReason('')
    },
    onError: () => toast.error('Error al ajustar inventario'),
  })

  const filtered = stock.filter(
    (s) =>
      !search ||
      s.product.name.toLowerCase().includes(search.toLowerCase()) ||
      s.product.sku.toLowerCase().includes(search.toLowerCase()),
  )

  const movData: Movement[] = movements?.data ?? []
  const movTotal: number = movements?.total ?? 0

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">{stock.length} productos con registro de stock</p>
        </div>
        <Button variant="primary" leftIcon={<PlusCircle size={16} />} onClick={() => setShowAdjust(true)} id="inventory-adjust-btn">
          Ajuste Manual
        </Button>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        {(['existencias', 'movimientos', 'ajuste'] as InvTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
            {t === 'existencias' ? 'Existencias' : t === 'movimientos' ? 'Movimientos' : 'Ajuste Manual'}
          </button>
        ))}
      </div>

      {/* Tab: Existencias */}
      {tab === 'existencias' && (
        <>
          <div className="mb-4">
            <Input placeholder="Buscar por nombre o SKU..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={16} />} className="max-w-xs" fullWidth={false} />
          </div>
          <Table
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
                  setShowAdjust(true)
                }}>Ajustar</Button>
              )},
            ]}
            data={filtered}
            loading={loadingStock}
            keyExtractor={(s) => s.id}
            emptyMessage="Sin productos en inventario"
            emptyIcon={<Package size={48} />}
          />
        </>
      )}

      {/* Tab: Movimientos */}
      {tab === 'movimientos' && (
        <>
          <Table
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
          <Pagination currentPage={movPage} totalPages={Math.ceil(movTotal / 30)}
            totalItems={movTotal} itemsPerPage={30} onPageChange={setMovPage} />
        </>
      )}

      {/* Tab: Ajuste */}
      {tab === 'ajuste' && (
        <div className="card max-w-lg">
          <h2 className="text-base font-semibold text-text-primary mb-4">Ajuste Manual de Stock</h2>
          <div className="space-y-4">
            <Select label="Producto" value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)}
              options={[{ value: '', label: 'Selecciona un producto' }, ...stock.map((s) => ({ value: String(s.product.id), label: `${s.product.sku} — ${s.product.name}` }))]} />
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

      {/* Modal de ajuste rápido */}
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
          <Select label="Producto" value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)}
            options={[{ value: '', label: 'Selecciona un producto' }, ...stock.map((s) => ({ value: String(s.product.id), label: `${s.product.sku} — ${s.product.name}` }))]} />
          <Input label="Nueva cantidad" type="number" min="0" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} />
          <Input label="Motivo" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Conteo físico, merma..." />
        </div>
      </Modal>
    </div>
  )
}
