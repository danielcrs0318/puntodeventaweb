import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Image, DollarSign, Package, Tag } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/components/ui/Toast'
import api from '@/lib/api'

const schema = z.object({
  sku: z.string().min(1, 'El SKU es requerido'),
  barcode: z.string().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  costPrice: z.coerce.number<number>().min(0, 'El costo debe ser positivo'),
  salePrice: z.coerce.number<number>().min(0.01, 'El precio de venta debe ser mayor a 0'),
  taxRate: z.coerce.number<number>().min(0).max(1, 'La tasa debe estar entre 0 y 1'),
  unitType: z.string().min(1),
  minStockAlert: z.coerce.number<number>().min(0),
  initialStock: z.coerce.number<number>().min(0).optional(),
})

type FormData = z.infer<typeof schema>

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  product: {
    id: number
    sku: string
    name: string
    barcode?: string
    description?: string
    categoryId?: number
    costPrice?: number
    salePrice?: number
    taxRate?: number
    unitType?: string
    minStockAlert?: number
    imageUrl?: string
  } | null
  onSuccess: () => void
}

const unitOptions = [
  { value: 'UNIDAD', label: 'Unidad' },
  { value: 'KG', label: 'Kilogramo (Kg)' },
  { value: 'LB', label: 'Libra (Lb)' },
  { value: 'LITRO', label: 'Litro' },
  { value: 'METRO', label: 'Metro' },
  { value: 'DOCENA', label: 'Docena' },
  { value: 'CAJA', label: 'Caja' },
  { value: 'PAQUETE', label: 'Paquete' },
]

const TAX_OPTIONS = [
  { value: '0.15', label: '15% — ISV Estándar (Honduras)' },
  { value: '0.18', label: '18% — Turismo' },
  { value: '0', label: '0% — Exento' },
]

export function ProductFormModal({ isOpen, onClose, product, onSuccess }: ProductFormModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'precios' | 'inventario' | 'imagen'>('general')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const isEdit = !!product

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories?active=true')
      return (res.data?.data ?? res.data) as { id: number; name: string }[]
    },
    enabled: isOpen,
  })

  const {
    register, handleSubmit, reset, formState: { errors },
    setValue, watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      taxRate: 0.15,
      unitType: 'UNIDAD',
      minStockAlert: 5,
      initialStock: 0,
    },
  })

  useEffect(() => {
    if (product && isOpen) {
      reset({
        sku: product.sku as string,
        name: product.name as string,
        barcode: (product.barcode as string) ?? '',
        description: (product.description as string) ?? '',
        categoryId: product.categoryId ? String(product.categoryId) : '',
        costPrice: product.costPrice as number,
        salePrice: product.salePrice as number,
        taxRate: product.taxRate as number,
        unitType: (product.unitType as string) ?? 'UNIDAD',
        minStockAlert: (product as { inventory?: { minStockAlert?: number } }).inventory?.minStockAlert ?? 5,
      })
      if (product.imageUrl) setImagePreview(product.imageUrl as string)
    } else if (!product && isOpen) {
      reset({ taxRate: 0.15, unitType: 'UNIDAD', minStockAlert: 5, initialStock: 0 })
      setImagePreview(null)
    }
    setActiveTab('general')
  }, [product, isOpen, reset])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let imageUrl: string | undefined
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const imgRes = await api.post('/products/upload-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        imageUrl = imgRes.data.url
      }

      const payload = {
        ...data,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
        ...(imageUrl ? { imageUrl } : {}),
      }

      if (isEdit) {
        return api.patch(`/products/${product!.id}`, payload)
      }
      return api.post('/products', payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado')
      onSuccess()
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string | string[] } } }
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response!.data!.message!.join(', ')
        : err.response?.data?.message ?? 'Error al guardar el producto'
      toast.error('Error', msg)
    },
  })

  const tabs = [
    { key: 'general', label: 'Información General', icon: <Package size={14} /> },
    { key: 'precios', label: 'Precios e Impuestos', icon: <DollarSign size={14} /> },
    { key: 'inventario', label: 'Inventario', icon: <Tag size={14} /> },
    { key: 'imagen', label: 'Imagen', icon: <Image size={14} /> },
  ] as const

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar Producto' : 'Nuevo Producto'}
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleSubmit((d) => mutation.mutate(d))}
            loading={mutation.isPending}
            id="product-form-submit-btn"
          >
            {isEdit ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="tabs mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`tab flex items-center gap-1.5 ${activeTab === t.key ? 'active' : ''}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <form className="space-y-4" id="product-form">
        {/* Tab: General */}
        {activeTab === 'general' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="SKU" placeholder="GEN-PROD-0001" error={errors.sku?.message} required {...register('sku')} />
              <Input label="Código de barras" placeholder="7890000000000" {...register('barcode')} />
            </div>
            <Input label="Nombre del producto" placeholder="Ej. Arroz Blanquita 1kg" error={errors.name?.message} required {...register('name')} />
            <Textarea label="Descripción" placeholder="Descripción opcional del producto..." rows={3} {...register('description')} />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Categoría"
                options={[
                  { value: '', label: 'Sin categoría' },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
                {...register('categoryId')}
              />
              <Select label="Unidad de medida" options={unitOptions} {...register('unitType')} />
            </div>
          </>
        )}

        {/* Tab: Precios */}
        {activeTab === 'precios' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Precio de costo (L.)" type="number" step="0.01" min="0" error={errors.costPrice?.message} required {...register('costPrice')} />
              <Input label="Precio de venta (L.)" type="number" step="0.01" min="0.01" error={errors.salePrice?.message} required {...register('salePrice')} />
            </div>
            <Select
              label="Tasa de impuesto (ISV)"
              options={TAX_OPTIONS}
              error={errors.taxRate?.message}
              {...register('taxRate')}
            />
            {watch('salePrice') > 0 && watch('costPrice') > 0 && (
              <div className="p-3 bg-bg-primary rounded-lg border border-border-subtle">
                <p className="text-xs text-text-secondary">Margen de ganancia estimado</p>
                <p className="text-lg font-bold text-green-400 mt-1">
                  {(((watch('salePrice') - watch('costPrice')) / watch('costPrice')) * 100).toFixed(1)}%
                  <span className="text-sm font-normal text-text-secondary ml-2">
                    ({formatCurrency(watch('salePrice') - watch('costPrice'))} por unidad)
                  </span>
                </p>
              </div>
            )}
          </>
        )}

        {/* Tab: Inventario */}
        {activeTab === 'inventario' && (
          <>
            <Input
              label="Alerta de stock mínimo"
              type="number"
              min="0"
              step="1"
              helperText="Recibirás una alerta cuando el stock llegue a esta cantidad"
              error={errors.minStockAlert?.message}
              {...register('minStockAlert')}
            />
            {!isEdit && (
              <Input
                label="Stock inicial"
                type="number"
                min="0"
                step="0.001"
                helperText="Cantidad de unidades disponibles al crear el producto"
                {...register('initialStock')}
              />
            )}
          </>
        )}

        {/* Tab: Imagen */}
        {activeTab === 'imagen' && (
          <div className="space-y-4">
            {imagePreview && (
              <div className="relative w-48 h-48 rounded-xl overflow-hidden border border-border-subtle mx-auto">
                <img src={imagePreview} alt="Vista previa" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-danger hover:bg-danger-muted transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
            <label className="block">
              <div className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center hover:border-accent-primary transition-colors cursor-pointer">
                <Image size={32} className="mx-auto text-text-secondary mb-3 opacity-40" />
                <p className="text-sm text-text-secondary">
                  Haz clic para seleccionar una imagen
                </p>
                <p className="text-xs text-text-secondary mt-1 opacity-60">
                  PNG, JPG, WEBP — máx. 5 MB
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                id="product-image-input"
              />
            </label>
          </div>
        )}
      </form>
    </Modal>
  )
}

// Importar helper de formatCurrency
function formatCurrency(amount: number) {
  return `L. ${amount.toFixed(2)}`
}
