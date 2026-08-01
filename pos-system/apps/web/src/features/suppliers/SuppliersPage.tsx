import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit, Trash2, Truck, ShoppingCart, Check } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Supplier { id: number; name: string; contactName?: string; phone?: string; email?: string; isActive: boolean }
interface PurchaseItem { productId: number; productName: string; quantity: number; unitCost: number }
interface Purchase {
  id: number
  createdAt: string
  total: number
  status: string
  supplier?: { name: string }
  user?: { name: string }
  items?: unknown[]
}

export default function SuppliersPage() {
  const [tab, setTab] = useState<'proveedores' | 'compras'>('proveedores')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null)
  const [showPurchase, setShowPurchase] = useState(false)
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('')
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [purchasePage, setPurchasePage] = useState(1)
  // Supplier form state
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', taxId: '' })
  const qc = useQueryClient()

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = (await api.get('/suppliers')).data
      return Array.isArray(res) ? res : (res?.data ?? [])
    },
  })

  const { data: purchasesData, isLoading: loadingPurchases } = useQuery<{ data: Purchase[]; total: number }>({
    queryKey: ['purchases', purchasePage],
    queryFn: async () => (await api.get(`/suppliers/purchases?page=${purchasePage}&limit=20`)).data,
    enabled: tab === 'compras',
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-select'],
    queryFn: async () => (await api.get('/products?limit=100&active=true')).data,
    enabled: showPurchase,
  })
  const allProducts = productsData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: () => editSupplier ? api.patch(`/suppliers/${editSupplier.id}`, form) : api.post('/suppliers', form),
    onSuccess: () => { toast.success(editSupplier ? 'Proveedor actualizado' : 'Proveedor creado'); qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowForm(false) },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/suppliers/${id}`),
    onSuccess: () => { toast.success('Proveedor eliminado'); qc.invalidateQueries({ queryKey: ['suppliers'] }); setDeleteSupplier(null) },
    onError: () => toast.error('Error al eliminar el proveedor'),
  })

  const purchaseMutation = useMutation({
    mutationFn: () => api.post('/suppliers/purchases', {
      supplierId: Number(purchaseSupplierId),
      items: purchaseItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
    }),
    onSuccess: () => {
      toast.success('Orden creada (pendiente). Completa la recepción para ingresar stock.')
      qc.invalidateQueries({ queryKey: ['purchases'] })
      setShowPurchase(false); setPurchaseItems([]); setPurchaseSupplierId('')
    },
    onError: () => toast.error('Error al registrar la compra'),
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/suppliers/purchases/${id}/complete`),
    onSuccess: () => {
      toast.success('Compra completada. Stock actualizado.')
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: () => toast.error('Error al completar la compra'),
  })

  const addPurchaseItem = () => setPurchaseItems((prev) => [...prev, { productId: 0, productName: '', quantity: 1, unitCost: 0 }])

  const filtered = suppliers.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">{suppliers.length} proveedores registrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<ShoppingCart size={16} />} onClick={() => setShowPurchase(true)} id="new-purchase-btn">
            Nueva Orden de Compra
          </Button>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditSupplier(null); setForm({ name: '', contactName: '', phone: '', email: '', address: '', taxId: '' }); setShowForm(true) }} id="supplier-create-btn">
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      <div className="tabs mb-6">
        {['proveedores', 'compras'].map((t) => (
          <button key={t} onClick={() => setTab(t as any)} className={`tab ${tab === t ? 'active' : ''}`}>
            {t === 'proveedores' ? 'Proveedores' : 'Órdenes de Compra'}
          </button>
        ))}
      </div>

      {tab === 'proveedores' && (
        <>
          <div className="mb-4">
            <Input placeholder="Buscar proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={16} />} className="w-full sm:max-w-xs" />
          </div>
          <Table
            columns={[
              { key: 'name', header: 'Nombre', render: (s) => <div><p className="font-medium">{s.name}</p>{s.contactName && <p className="text-xs text-text-secondary">{s.contactName}</p>}</div> },
              { key: 'phone', header: 'Teléfono', render: (s) => s.phone ?? '—' },
              { key: 'email', header: 'Correo', render: (s) => s.email ?? '—' },
              { key: 'isActive', header: 'Estado', align: 'center', render: (s) => <Badge variant={s.isActive ? 'success' : 'neutral'} dot>{s.isActive ? 'Activo' : 'Inactivo'}</Badge> },
              { key: 'actions', header: '', align: 'center', render: (s) => (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditSupplier(s); setForm({ name: s.name, contactName: s.contactName ?? '', phone: s.phone ?? '', email: s.email ?? '', address: '', taxId: '' }); setShowForm(true) }}><Edit size={15} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteSupplier(s)}><Trash2 size={15} className="text-danger" /></Button>
                </div>
              )},
            ]}
            data={filtered} loading={isLoading} keyExtractor={(s) => s.id}
            emptyMessage="No hay proveedores" emptyIcon={<Truck size={48} />}
          />
        </>
      )}

      {tab === 'compras' && (
        <>
          <Table
            minWidth="900px"
            columns={[
              { key: 'id', header: 'N° Orden', render: (p) => <span className="font-mono">OC-{String(p.id).padStart(6, '0')}</span> },
              { key: 'createdAt', header: 'Fecha', render: (p) => formatDate(p.createdAt) },
              { key: 'supplier', header: 'Proveedor', render: (p) => p.supplier?.name ?? '—' },
              { key: 'user', header: 'Registrado por', render: (p) => p.user?.name ?? '—' },
              { key: 'itemCount', header: 'Items', align: 'center', render: (p) => p.items?.length ?? 0 },
              { key: 'total', header: 'Total', align: 'right', render: (p) => formatCurrency(p.total) },
              { key: 'status', header: 'Estado', align: 'center', render: (p) => <Badge variant={p.status === 'COMPLETADA' ? 'success' : 'warning'}>{p.status}</Badge> },
              { key: 'actions', header: '', render: (p) => p.status === 'PENDIENTE' ? (
                <Button variant="ghost" size="sm" leftIcon={<Check size={14} />} onClick={() => completeMutation.mutate(p.id)}>Completar</Button>
              ) : null },
            ]}
            data={purchasesData?.data ?? []} loading={loadingPurchases}
            keyExtractor={(p) => p.id} emptyMessage="Sin órdenes de compra" emptyIcon={<ShoppingCart size={48} />}
          />
          <Pagination currentPage={purchasePage} totalPages={Math.ceil((purchasesData?.total ?? 0) / 20)} totalItems={purchasesData?.total ?? 0} itemsPerPage={20} onPageChange={setPurchasePage} />
        </>
      )}

      {/* Modal Proveedor */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="md"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} id="supplier-form-submit">
            {editSupplier ? 'Guardar' : 'Crear'}
          </Button></div>}>
        <div className="space-y-4">
          <Input label="Nombre del proveedor" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Contacto" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <Input label="Correo" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <Input label="RTN" value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} />
        </div>
      </Modal>

      {/* Modal Orden de Compra */}
      <Modal isOpen={showPurchase} onClose={() => setShowPurchase(false)} title="Nueva Orden de Compra" size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => setShowPurchase(false)}>Cancelar</Button>
          <Button variant="primary" onClick={() => purchaseMutation.mutate()} loading={purchaseMutation.isPending}
            disabled={!purchaseSupplierId || purchaseItems.length === 0} id="purchase-submit-btn">
            Registrar Compra
          </Button></div>}>
        <div className="space-y-4">
          <Select label="Proveedor" value={purchaseSupplierId} onChange={(e) => setPurchaseSupplierId(e.target.value)}
            options={[{ value: '', label: 'Selecciona un proveedor' }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="label">Productos</p>
              <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={addPurchaseItem}>Agregar</Button>
            </div>
            {purchaseItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-2 bg-bg-elevated rounded-lg border border-border-subtle">
                <Select options={[{ value: '0', label: 'Producto...' }, ...allProducts.map((p: any) => ({ value: String(p.id), label: p.name }))]}
                  value={String(item.productId)}
                  onChange={(e) => setPurchaseItems((prev) => prev.map((i, j) => j === idx ? { ...i, productId: Number(e.target.value) } : i))} />
                <Input type="number" min="1" placeholder="Cantidad" value={item.quantity}
                  onChange={(e) => setPurchaseItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: Number(e.target.value) } : i))} />
                <Input type="number" min="0" step="0.01" placeholder="Costo unit." value={item.unitCost}
                  onChange={(e) => setPurchaseItems((prev) => prev.map((i, j) => j === idx ? { ...i, unitCost: Number(e.target.value) } : i))} />
                <Button variant="ghost" size="icon" onClick={() => setPurchaseItems((prev) => prev.filter((_, j) => j !== idx))}><Trash2 size={14} className="text-danger" /></Button>
              </div>
            ))}
          </div>
          {purchaseItems.length > 0 && (
            <p className="text-right text-sm font-semibold text-text-primary">
              Total: {formatCurrency(purchaseItems.reduce((s, i) => s + i.quantity * i.unitCost, 0))}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteSupplier} onClose={() => setDeleteSupplier(null)}
        onConfirm={() => deleteMutation.mutate(deleteSupplier!.id)}
        title="Eliminar Proveedor" message={`¿Eliminar a "${deleteSupplier?.name}"?`}
        confirmText="Eliminar" loading={deleteMutation.isPending} />
    </div>
  )
}
