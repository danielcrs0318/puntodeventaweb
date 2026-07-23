import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit, Trash2, User, ShoppingBag } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog, StatCard } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime, statusLabel, statusClass } from '@/lib/utils'

interface Customer {
  id: number; name: string; identificationNumber?: string
  phone?: string; email?: string; address?: string
  creditLimit: number; creditBalance: number; isActive: boolean
}

const schema = z.object({
  name: z.string().min(2),
  identificationNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  creditLimit: z.coerce.number<number>().min(0),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 20

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: async () => (await api.get(`/customers?page=${page}&limit=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ''}`)).data,
  })
  const customers: Customer[] = data?.data ?? []
  const total: number = data?.total ?? 0

  const { data: salesHistory } = useQuery({
    queryKey: ['customer-sales', historyCustomer?.id],
    queryFn: async () => (await api.get(`/customers/${historyCustomer!.id}/sales?limit=20`)).data,
    enabled: !!historyCustomer,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { creditLimit: 0 },
  })

  const saveMutation = useMutation({
    mutationFn: (d: FormData) =>
      editCustomer ? api.patch(`/customers/${editCustomer.id}`, d) : api.post('/customers', d),
    onSuccess: () => {
      toast.success(editCustomer ? 'Cliente actualizado' : 'Cliente creado')
      qc.invalidateQueries({ queryKey: ['customers'] })
      setShowForm(false); setEditCustomer(null); reset()
    },
    onError: () => toast.error('Error al guardar el cliente'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => { toast.success('Cliente eliminado'); qc.invalidateQueries({ queryKey: ['customers'] }); setDeleteCustomer(null) },
  })

  const openEdit = (c: Customer) => {
    setEditCustomer(c)
    reset({ name: c.name, identificationNumber: c.identificationNumber ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', creditLimit: c.creditLimit })
    setShowForm(true)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{total} clientes registrados</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditCustomer(null); reset({ creditLimit: 0 }); setShowForm(true) }} id="customer-create-btn">
          Nuevo Cliente
        </Button>
      </div>

      <div className="mb-5">
        <Input placeholder="Buscar por nombre, RTN o teléfono..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          leftIcon={<Search size={16} />} className="max-w-sm" fullWidth={false} />
      </div>

      <Table
        columns={[
          { key: 'name', header: 'Nombre', render: (c) => (
            <button className="text-left hover:text-accent-light transition-colors" onClick={() => setHistoryCustomer(c)}>
              <p className="font-medium text-text-primary">{c.name}</p>
              {c.identificationNumber && <p className="text-xs text-text-secondary">{c.identificationNumber}</p>}
            </button>
          )},
          { key: 'phone', header: 'Teléfono', render: (c) => c.phone ?? '—' },
          { key: 'email', header: 'Correo', render: (c) => c.email ?? '—' },
          { key: 'creditLimit', header: 'Límite Crédito', align: 'right', render: (c) => formatCurrency(c.creditLimit) },
          { key: 'isActive', header: 'Estado', align: 'center', render: (c) => (
            <Badge variant={c.isActive ? 'success' : 'neutral'} dot>{c.isActive ? 'Activo' : 'Inactivo'}</Badge>
          )},
          { key: 'actions', header: '', align: 'center', render: (c) => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setHistoryCustomer(c)} title="Ver compras"><ShoppingBag size={15} /></Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit size={15} /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteCustomer(c)}><Trash2 size={15} className="text-danger" /></Button>
            </div>
          )},
        ]}
        data={customers} loading={isLoading}
        keyExtractor={(c) => c.id}
        emptyMessage="No hay clientes registrados" emptyIcon={<User size={48} />}
      />
      <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} totalItems={total} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />

      {/* Modal formulario */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditCustomer(null); reset() }}
        title={editCustomer ? 'Editar Cliente' : 'Nuevo Cliente'} size="md"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit((d) => saveMutation.mutate(d))} loading={saveMutation.isPending} id="customer-form-submit">
            {editCustomer ? 'Guardar' : 'Crear Cliente'}
          </Button></div>}>
        <div className="space-y-4">
          <Input label="Nombre completo" error={errors.name?.message} required {...register('name')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="RTN / Identidad" {...register('identificationNumber')} />
            <Input label="Teléfono" {...register('phone')} />
          </div>
          <Input label="Correo electrónico" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Dirección" {...register('address')} />
          <Input label="Límite de crédito (L.)" type="number" min="0" step="0.01" {...register('creditLimit')} />
        </div>
      </Modal>

      {/* Modal historial */}
      <Modal isOpen={!!historyCustomer} onClose={() => setHistoryCustomer(null)}
        title={`Historial de Compras — ${historyCustomer?.name}`} size="lg">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {!salesHistory?.data?.length ? (
            <p className="text-center text-text-secondary py-8">Sin compras registradas</p>
          ) : salesHistory.data.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border-subtle">
              <div>
                <p className="text-sm font-medium text-text-primary">{s.invoiceNumber}</p>
                <p className="text-xs text-text-secondary">{formatDateTime(s.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={statusClass(s.status)}>{statusLabel(s.status)}</Badge>
                <span className="text-sm font-semibold">{formatCurrency(s.total)}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteCustomer} onClose={() => setDeleteCustomer(null)}
        onConfirm={() => deleteMutation.mutate(deleteCustomer!.id)}
        title="Eliminar Cliente" message={`¿Eliminar al cliente "${deleteCustomer?.name}"?`}
        confirmText="Eliminar" loading={deleteMutation.isPending} />
    </div>
  )
}
