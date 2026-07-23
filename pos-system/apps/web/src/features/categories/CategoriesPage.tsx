import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit, Trash2, Tags } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import { getApiErrorMessage } from '@/lib/errors'

interface Category {
  id: number
  name: string
  description?: string | null
  isActive: boolean
}

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Category | null>(null)
  const [deleteItem, setDeleteItem] = useState<Category | null>(null)
  const qc = useQueryClient()

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = (await api.get('/categories')).data
      return Array.isArray(res) ? res : (res?.data ?? [])
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const saveMutation = useMutation({
    mutationFn: (d: FormData) =>
      editItem ? api.patch(`/categories/${editItem.id}`, d) : api.post('/categories', d),
    onSuccess: () => {
      toast.success(editItem ? 'Categoría actualizada' : 'Categoría creada')
      qc.invalidateQueries({ queryKey: ['categories'] })
      setShowForm(false)
      setEditItem(null)
      reset()
    },
    onError: (e) => toast.error('Error', getApiErrorMessage(e, 'No se pudo guardar')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Categoría desactivada')
      qc.invalidateQueries({ queryKey: ['categories'] })
      setDeleteItem(null)
    },
    onError: (e) => toast.error('Error', getApiErrorMessage(e, 'No se pudo eliminar')),
  })

  const openCreate = () => {
    setEditItem(null)
    reset({ name: '', description: '' })
    setShowForm(true)
  }

  const openEdit = (c: Category) => {
    setEditItem(c)
    reset({ name: c.name, description: c.description ?? '' })
    setShowForm(true)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">{categories.length} categorías registradas</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreate}>
          Nueva categoría
        </Button>
      </div>

      <Table
        columns={[
          { key: 'name', header: 'Nombre', render: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'description', header: 'Descripción', render: (c) => c.description || '—' },
          {
            key: 'isActive',
            header: 'Estado',
            align: 'center',
            render: (c) => (
              <Badge variant={c.isActive ? 'success' : 'danger'}>
                {c.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'center',
            render: (c) => (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar">
                  <Edit size={15} />
                </Button>
                {c.isActive && (
                  <Button variant="ghost" size="icon" onClick={() => setDeleteItem(c)} title="Desactivar">
                    <Trash2 size={15} className="text-danger" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        data={categories}
        loading={isLoading}
        keyExtractor={(c) => c.id}
        emptyMessage="No hay categorías"
        emptyIcon={<Tags size={48} />}
      />

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? 'Editar categoría' : 'Nueva categoría'}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              onClick={handleSubmit((d) => saveMutation.mutate(d))}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit((d) => saveMutation.mutate(d))}>
          <Input label="Nombre" required error={errors.name?.message} {...register('name')} />
          <Textarea label="Descripción" rows={3} {...register('description')} />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        title="Desactivar categoría"
        message={`¿Desactivar la categoría "${deleteItem?.name}"? Los productos asociados no se eliminarán.`}
        confirmText="Desactivar"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
