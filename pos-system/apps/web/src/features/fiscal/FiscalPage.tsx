import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FileText, AlertTriangle, CheckCircle, Calendar, Hash, Edit, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/index'
import { formatDate, daysUntil } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'
import { PageLoader } from '@/components/ui/Spinner'

interface CaiRange {
  id: number
  caiCode: string
  documentType: string
  branchOfficeCode: string
  posCode: string
  rangeStart: number
  rangeEnd: number
  currentNumber: number
  authorizationDate: string
  expirationDate: string
  isActive: boolean
}

const caiSchema = z.object({
  caiCode: z.string().min(10, 'Ingresa el código CAI completo'),
  documentType: z.string().min(1),
  branchOfficeCode: z.string().min(1, 'Código de establecimiento requerido'),
  posCode: z.string().min(1, 'Código de punto de emisión requerido'),
  rangeStart: z.coerce.number<number>().int().min(1),
  rangeEnd: z.coerce.number<number>().int().min(1),
  authorizationDate: z.string().min(1),
  expirationDate: z.string().min(1),
})
type CaiFormData = z.infer<typeof caiSchema>

export default function FiscalPage() {
  const [showForm, setShowForm] = useState(false)
  const [editRange, setEditRange] = useState<CaiRange | null>(null)
  const [deleteRange, setDeleteRange] = useState<CaiRange | null>(null)
  const qc = useQueryClient()

  const { data: ranges = [], isLoading } = useQuery<CaiRange[]>({
    queryKey: ['cai-ranges'],
    queryFn: async () => {
      const res = (await api.get('/fiscal/cai-ranges')).data
      return Array.isArray(res) ? res : (res?.data ?? [])
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings')
      return res.data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CaiFormData>({
    resolver: zodResolver(caiSchema),
  })

  const saveMutation = useMutation({
    mutationFn: (data: CaiFormData) => {
      if (editRange) return api.patch(`/fiscal/cai-ranges/${editRange.id}`, data)
      return api.post('/fiscal/cai-ranges', data)
    },
    onSuccess: () => {
      toast.success(editRange ? 'Rango CAI actualizado' : 'Rango CAI registrado')
      qc.invalidateQueries({ queryKey: ['cai-ranges'] })
      setShowForm(false)
      setEditRange(null)
      reset()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error('Error', e.response?.data?.message ?? 'No se pudo guardar el rango')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fiscal/cai-ranges/${id}`),
    onSuccess: () => {
      toast.success('Rango eliminado')
      qc.invalidateQueries({ queryKey: ['cai-ranges'] })
      setDeleteRange(null)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch(`/fiscal/cai-ranges/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cai-ranges'] })
    },
  })

  if (isLoading) return <PageLoader />

  if (!settings?.fiscalInvoicingEnabled) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Facturación Fiscal CAI</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-20 h-20 rounded-2xl bg-warning-muted flex items-center justify-center mb-4">
            <FileText size={36} className="text-yellow-400" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Facturación Fiscal Desactivada
          </h2>
          <p className="text-text-secondary max-w-md mb-6">
            La facturación fiscal con CAI no está habilitada. Actívala desde la sección de Configuración para gestionar rangos autorizados por la SAR.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/settings'}>
            Ir a Configuración
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación Fiscal CAI</h1>
          <p className="page-subtitle">Gestión de rangos autorizados por la SAR — Honduras</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditRange(null); reset(); setShowForm(true) }} id="cai-new-range-btn">
          Registrar Rango CAI
        </Button>
      </div>

      {/* Alertas */}
      {ranges.filter(r => {
        const days = daysUntil(r.expirationDate)
        const remaining = r.rangeEnd - r.currentNumber + 1
        return r.isActive && (days <= 15 || remaining <= 50)
      }).map(r => {
        const days = daysUntil(r.expirationDate)
        const remaining = r.rangeEnd - r.currentNumber + 1
        return (
          <div key={r.id} className="flex items-center gap-3 p-4 rounded-lg border border-yellow-700/40 bg-warning-muted mb-4">
            <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">
                Rango CAI próximo a {remaining <= 50 ? 'agotarse' : 'vencer'}
              </p>
              <p className="text-xs text-yellow-400/70">
                CAI: {r.caiCode} — {remaining} facturas restantes · Vence: {formatDate(r.expirationDate)} ({days} días)
              </p>
            </div>
          </div>
        )
      })}

      {/* Tabla de rangos */}
      <Table
        minWidth="1100px"
        columns={[
          { key: 'caiCode', header: 'Código CAI' },
          { key: 'documentType', header: 'Tipo Documento', render: (r) => (
            <Badge variant={r.documentType === 'FACTURA' ? 'accent' : r.documentType === 'NOTA_CREDITO' ? 'warning' : 'neutral'}>
              {r.documentType.replace('_', ' ')}
            </Badge>
          )},
          { key: 'fullCode', header: 'Establecimiento / POS', render: (r) => `${r.branchOfficeCode} / ${r.posCode}` },
          { key: 'range', header: 'Rango Autorizado', render: (r) => `${String(r.rangeStart).padStart(8,'0')} — ${String(r.rangeEnd).padStart(8,'0')}` },
          { key: 'currentNumber', header: 'Próximo N°', align: 'center', render: (r) => (
            <span className="font-mono">{String(r.currentNumber).padStart(8,'0')}</span>
          )},
          { key: 'remaining', header: 'Disponibles', align: 'center', render: (r) => {
            const remaining = r.rangeEnd - r.currentNumber + 1
            return <Badge variant={remaining <= 50 ? 'danger' : remaining <= 200 ? 'warning' : 'success'}>{remaining}</Badge>
          }},
          { key: 'expirationDate', header: 'Vence', render: (r) => {
            const days = daysUntil(r.expirationDate)
            return (
              <span className={days <= 15 ? 'text-yellow-400' : 'text-text-primary'}>
                {formatDate(r.expirationDate)}
                {days <= 15 && <span className="text-xs ml-1">({days}d)</span>}
              </span>
            )
          }},
          { key: 'isActive', header: 'Estado', align: 'center', render: (r) => (
            <button onClick={() => toggleActiveMutation.mutate({ id: r.id, isActive: !r.isActive })}>
              <Badge variant={r.isActive ? 'success' : 'neutral'} dot>
                {r.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </button>
          )},
          { key: 'actions', header: 'Acciones', align: 'center', render: (r) => (
            <div className="flex items-center justify-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditRange(r); reset({
                caiCode: r.caiCode, documentType: r.documentType, branchOfficeCode: r.branchOfficeCode,
                posCode: r.posCode, rangeStart: r.rangeStart, rangeEnd: r.rangeEnd,
                authorizationDate: r.authorizationDate.split('T')[0], expirationDate: r.expirationDate.split('T')[0],
              }); setShowForm(true) }}>
                <Edit size={15} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteRange(r)}>
                <Trash2 size={15} className="text-danger" />
              </Button>
            </div>
          )},
        ]}
        data={ranges}
        keyExtractor={(r) => r.id}
        emptyMessage="No hay rangos CAI registrados"
        emptyIcon={<FileText size={48} />}
      />

      {/* Modal formulario */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditRange(null); reset() }}
        title={editRange ? 'Editar Rango CAI' : 'Registrar Nuevo Rango CAI'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowForm(false); reset() }}>Cancelar</Button>
            <Button variant="primary" onClick={handleSubmit((d) => saveMutation.mutate(d))} loading={saveMutation.isPending} id="cai-form-submit-btn">
              {editRange ? 'Guardar Cambios' : 'Registrar Rango'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-accent-muted border border-accent-primary/30 rounded-lg">
            <p className="text-xs text-text-secondary">
              El número de factura se genera con el formato:{' '}
              <span className="font-mono text-accent-light">
                {watch_branch_sample()} — 000-001-01-00000001
              </span>
            </p>
          </div>
          <Input label="Código CAI (emitido por la SAR)" placeholder="A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6" error={errors.caiCode?.message} required {...register('caiCode')} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Tipo de Documento" options={[
              { value: 'FACTURA', label: 'Factura' },
              { value: 'NOTA_CREDITO', label: 'Nota de Crédito' },
              { value: 'NOTA_DEBITO', label: 'Nota de Débito' },
            ]} error={errors.documentType?.message} {...register('documentType')} />
            <Input label="Código Establecimiento" placeholder="000" maxLength={3} error={errors.branchOfficeCode?.message} required {...register('branchOfficeCode')} />
            <Input label="Código Punto Emisión" placeholder="001" maxLength={3} error={errors.posCode?.message} required {...register('posCode')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Correlativo Inicial" type="number" min="1" error={errors.rangeStart?.message} required {...register('rangeStart')} />
            <Input label="Correlativo Final" type="number" min="1" error={errors.rangeEnd?.message} required {...register('rangeEnd')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Fecha de Autorización" type="date" error={errors.authorizationDate?.message} required {...register('authorizationDate')} />
            <Input label="Fecha Límite de Emisión" type="date" error={errors.expirationDate?.message} required {...register('expirationDate')} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteRange}
        onClose={() => setDeleteRange(null)}
        onConfirm={() => deleteMutation.mutate(deleteRange!.id)}
        title="Eliminar Rango CAI"
        message={`¿Confirmas eliminar el rango CAI: ${deleteRange?.caiCode}? Las facturas ya emitidas no se afectarán.`}
        confirmText="Eliminar"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

function watch_branch_sample() {
  return 'branchCode-posCode-docType-correlativo'
}
