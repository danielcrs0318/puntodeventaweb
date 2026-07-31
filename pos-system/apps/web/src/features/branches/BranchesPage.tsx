import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, Edit } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { getApiErrorMessage } from '@/lib/errors'

interface Branch {
  id: number
  code: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  isActive: boolean
  isMain: boolean
  _count?: { users: number; sales: number }
}

const emptyForm = {
  code: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  isMain: false,
  isActive: true,
}

export default function BranchesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Branch | null>(null)
  const [form, setForm] = useState(emptyForm)
  const qc = useQueryClient()

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches-admin'],
    queryFn: async () => {
      const res = (await api.get('/branches')).data
      return Array.isArray(res) ? res : (res?.data ?? [])
    },
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      editItem
        ? api.patch(`/branches/${editItem.id}`, form)
        : api.post('/branches', form),
    onSuccess: () => {
      toast.success(editItem ? 'Sucursal actualizada' : 'Sucursal creada')
      qc.invalidateQueries({ queryKey: ['branches-admin'] })
      setShowForm(false)
      setEditItem(null)
      setForm(emptyForm)
    },
    onError: (e) => toast.error('Error', getApiErrorMessage(e, 'No se pudo guardar')),
  })

  const openCreate = () => {
    setEditItem(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (b: Branch) => {
    setEditItem(b)
    setForm({
      code: b.code,
      name: b.name,
      address: b.address ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      isMain: b.isMain,
      isActive: b.isActive,
    })
    setShowForm(true)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sucursales</h1>
          <p className="page-subtitle">
            Gestiona ubicaciones. Cada sucursal tiene su propio inventario, caja y ventas.
          </p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreate}>
          Nueva sucursal
        </Button>
      </div>

      <Table
        columns={[
          { key: 'code', header: 'Código', render: (b) => <span className="font-mono">{b.code}</span> },
          { key: 'name', header: 'Nombre', render: (b) => (
            <div>
              <p className="font-medium">{b.name}</p>
              {b.isMain && <Badge variant="success">Matriz</Badge>}
            </div>
          )},
          { key: 'address', header: 'Dirección', render: (b) => b.address || '—' },
          { key: 'phone', header: 'Teléfono', render: (b) => b.phone || '—' },
          {
            key: 'users',
            header: 'Usuarios',
            align: 'center',
            render: (b) => b._count?.users ?? 0,
          },
          {
            key: 'isActive',
            header: 'Estado',
            align: 'center',
            render: (b) => (
              <Badge variant={b.isActive ? 'success' : 'danger'}>
                {b.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (b) => (
              <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Editar">
                <Edit size={15} />
              </Button>
            ),
          },
        ]}
        data={branches}
        loading={isLoading}
        keyExtractor={(b) => b.id}
        emptyMessage="No hay sucursales"
        emptyIcon={<Building2 size={48} />}
      />

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? 'Editar sucursal' : 'Nueva sucursal'}
        size="md"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              disabled={!form.code.trim() || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Código"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="SPS, TGU..."
            />
            <Input
              label="Nombre"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Correo"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.isMain}
              onChange={(e) => setForm((f) => ({ ...f, isMain: e.target.checked }))}
            />
            Marcar como sucursal matriz
          </label>
          {editItem && (
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Sucursal activa
            </label>
          )}
        </div>
      </Modal>
    </div>
  )
}
