import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, XCircle, Receipt, Eye, Mail, RotateCcw, Search } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDateTime, statusLabel, statusClass, paymentMethodLabel, openSaleReceipt } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { Textarea } from '@/components/ui/Textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 20

export default function SalesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ from: '', to: '', status: '', paymentMethod: '' })
  const [detailSale, setDetailSale] = useState<any>(null)
  const [voidSale, setVoidSale] = useState<any>(null)
  const [voidReason, setVoidReason] = useState('')
  const [emailSale, setEmailSale] = useState<any>(null)
  const [emailTo, setEmailTo] = useState('')
  const [returnSale, setReturnSale] = useState<any>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({})
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const debouncedSearch = useDebouncedValue(search)

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) p.set('search', debouncedSearch)
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    if (filters.status) p.set('status', filters.status)
    if (filters.paymentMethod) p.set('paymentMethod', filters.paymentMethod)
    return p.toString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, filters, debouncedSearch],
    queryFn: async () => (await api.get(`/sales?${buildQuery()}`)).data,
  })
  const sales: any[] = data?.data ?? []
  const total: number = data?.total ?? 0

  const { data: saleDetail } = useQuery({
    queryKey: ['sale-detail', detailSale?.id],
    queryFn: async () => (await api.get(`/sales/${detailSale.id}`)).data,
    enabled: !!detailSale,
  })

  const { data: returnDetail } = useQuery({
    queryKey: ['sale-return-detail', returnSale?.id],
    queryFn: async () => (await api.get(`/sales/${returnSale.id}`)).data,
    enabled: !!returnSale,
  })

  const voidMutation = useMutation({
    mutationFn: () => api.post(`/sales/${voidSale.id}/void`, { reason: voidReason }),
    onSuccess: () => {
      toast.success('Venta anulada')
      qc.invalidateQueries({ queryKey: ['sales'] })
      setVoidSale(null); setVoidReason('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Error al anular la venta'),
  })

  const emailMutation = useMutation({
    mutationFn: () => api.post(`/sales/${emailSale.id}/send-receipt`, { email: emailTo || undefined }),
    onSuccess: (res) => {
      toast.success(res.data?.sent ? 'Correo enviado' : 'Aviso', res.data?.message)
      setEmailSale(null)
      setEmailTo('')
    },
    onError: (e) => toast.error('Error', getApiErrorMessage(e, 'No se pudo enviar el comprobante')),
  })

  const returnMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(returnQtys)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) }))
      return api.post(`/sales/${returnSale.id}/return`, { reason: returnReason, items })
    },
    onSuccess: (res) => {
      toast.success('Devolución procesada', res.data?.message)
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      setReturnSale(null)
      setReturnReason('')
      setReturnQtys({})
    },
    onError: (e) => toast.error('Error', getApiErrorMessage(e, 'No se pudo procesar la devolución')),
  })

  const handlePrint = (id: number) => {
    void openSaleReceipt(id)
  }

  const openEmail = (sale: any) => {
    setEmailSale(sale)
    setEmailTo(sale.customer?.email ?? '')
  }

  const openReturn = (sale: any) => {
    setReturnSale(sale)
    setReturnReason('')
    setReturnQtys({})
  }

  const canVoid = user?.role.name === 'admin' || user?.role.name === 'supervisor'

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de Ventas</h1>
          <p className="page-subtitle">{total} registros</p>
        </div>
      </div>

      <div className="card mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            placeholder="Factura, cliente o cajero..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={<Search size={16} />}
            className="w-full sm:min-w-[220px]"
            fullWidth={false}
          />
          <Input label="Desde" type="date" value={filters.from}
            onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPage(1) }} fullWidth={false} />
          <Input label="Hasta" type="date" value={filters.to}
            onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setPage(1) }} fullWidth={false} />
          <Select label="Estado" value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }}
            options={[{ value: '', label: 'Todos' }, { value: 'COMPLETADA', label: 'Completada' }, { value: 'ANULADA', label: 'Anulada' }]} />
          <Select label="Método de Pago" value={filters.paymentMethod}
            onChange={(e) => { setFilters((f) => ({ ...f, paymentMethod: e.target.value })); setPage(1) }}
            options={[{ value: '', label: 'Todos' }, { value: 'EFECTIVO', label: 'Efectivo' }, { value: 'TARJETA', label: 'Tarjeta' }, { value: 'MIXTO', label: 'Mixto' }, { value: 'TRANSFERENCIA', label: 'Transferencia' }]} />
          <Button variant="secondary" onClick={() => { setFilters({ from: '', to: '', status: '', paymentMethod: '' }); setSearch(''); setPage(1) }}>
            Limpiar
          </Button>
        </div>
      </div>

      <Table
        minWidth="980px"
        columns={[
          { key: 'invoiceNumber', header: 'N° Factura', render: (s) => (
            <button className="font-mono text-accent-light hover:underline" onClick={() => setDetailSale(s)}>{s.invoiceNumber}</button>
          )},
          { key: 'createdAt', header: 'Fecha y Hora', render: (s) => formatDateTime(s.createdAt) },
          { key: 'customer', header: 'Cliente', render: (s) => s.customer?.name ?? 'Consumidor Final' },
          { key: 'user', header: 'Cajero', render: (s) => s.user?.name ?? '—' },
          { key: 'paymentMethod', header: 'Pago', render: (s) => paymentMethodLabel(s.paymentMethod) },
          { key: 'total', header: 'Total', align: 'right', render: (s) => <span className="font-semibold">{formatCurrency(s.total)}</span> },
          { key: 'status', header: 'Estado', align: 'center', render: (s) => <Badge variant={statusClass(s.status)}>{statusLabel(s.status)}</Badge> },
          { key: 'actions', header: '', align: 'center', render: (s) => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setDetailSale(s)} title="Ver detalle"><Eye size={15} /></Button>
              <Button variant="ghost" size="icon" onClick={() => handlePrint(s.id)} title="Reimprimir"><Printer size={15} /></Button>
              <Button variant="ghost" size="icon" onClick={() => openEmail(s)} title="Enviar por correo"><Mail size={15} /></Button>
              {s.status !== 'ANULADA' && (
                <Button variant="ghost" size="icon" onClick={() => openReturn(s)} title="Devolución">
                  <RotateCcw size={15} />
                </Button>
              )}
              {canVoid && s.status !== 'ANULADA' && (
                <Button variant="ghost" size="icon" onClick={() => { setVoidSale(s); setVoidReason('') }} title="Anular">
                  <XCircle size={15} className="text-danger" />
                </Button>
              )}
            </div>
          )},
        ]}
        data={sales} loading={isLoading}
        keyExtractor={(s) => s.id}
        emptyMessage="No hay ventas con esos filtros"
        emptyIcon={<Receipt size={48} />}
      />
      <Pagination currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} totalItems={total} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />

      <Modal isOpen={!!detailSale && !!saleDetail} onClose={() => setDetailSale(null)}
        title={`Detalle — ${saleDetail?.invoiceNumber ?? ''}`} size="lg">
        {saleDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-text-secondary">Fecha</p><p className="font-medium">{formatDateTime(saleDetail.createdAt)}</p></div>
              <div><p className="text-text-secondary">Estado</p><Badge variant={statusClass(saleDetail.status)}>{statusLabel(saleDetail.status)}</Badge></div>
              <div><p className="text-text-secondary">Cliente</p><p className="font-medium">{saleDetail.customer?.name ?? 'Consumidor Final'}</p></div>
              <div><p className="text-text-secondary">Cajero</p><p className="font-medium">{saleDetail.user?.name}</p></div>
              {saleDetail.fiscalInvoice && (
                <div className="col-span-2"><p className="text-text-secondary">N° Factura Fiscal</p>
                  <p className="font-mono text-accent-light">{saleDetail.fiscalInvoice.fullInvoiceNumber}</p></div>
              )}
            </div>
            <hr className="border-border-subtle" />
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[320px]">
              <thead><tr className="text-text-secondary text-xs border-b border-border-subtle">
                <th className="text-left pb-2">Producto</th>
                <th className="text-center pb-2">Cant.</th>
                <th className="text-right pb-2">P.U.</th>
                <th className="text-right pb-2">Total</th>
              </tr></thead>
              <tbody>
                {saleDetail.items?.map((i: any) => (
                  <tr key={i.id} className="border-b border-border-subtle/50">
                    <td className="py-2">{i.product?.name}</td>
                    <td className="text-center py-2">{i.quantity}</td>
                    <td className="text-right py-2">{formatCurrency(i.unitPrice)}</td>
                    <td className="text-right py-2">{formatCurrency(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="space-y-1 text-sm text-right">
              <p>Subtotal: {formatCurrency(saleDetail.subtotal)}</p>
              {Number(saleDetail.discountTotal) > 0 && <p className="text-red-400">Descuento: -{formatCurrency(saleDetail.discountTotal)}</p>}
              <p>ISV: {formatCurrency(saleDetail.taxTotal)}</p>
              <p className="text-base font-bold text-text-primary">Total: {formatCurrency(saleDetail.total)}</p>
            </div>
            <div className="pt-2 flex flex-col gap-2 sm:flex-row">
              <Button fullWidth variant="secondary" leftIcon={<Printer size={15} />} onClick={() => handlePrint(saleDetail.id)}>
                Reimprimir Recibo
              </Button>
              <Button fullWidth variant="primary" leftIcon={<Mail size={15} />} onClick={() => openEmail(saleDetail)}>
                Enviar por correo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!voidSale} onClose={() => setVoidSale(null)}
        title={`Anular Venta — ${voidSale?.invoiceNumber}`} size="sm"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => setVoidSale(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => voidMutation.mutate()} loading={voidMutation.isPending}
            disabled={!voidReason.trim()} id="void-sale-btn">
            Confirmar Anulación
          </Button></div>}>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Esta acción revertirá el stock de los productos vendidos y anulará la factura fiscal si aplica.
          </p>
          <Textarea label="Motivo de anulación" required value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Describe el motivo de la anulación..." rows={3} />
        </div>
      </Modal>

      <Modal
        isOpen={!!emailSale}
        onClose={() => setEmailSale(null)}
        title={`Enviar comprobante — ${emailSale?.invoiceNumber ?? ''}`}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEmailSale(null)}>Cancelar</Button>
            <Button
              variant="primary"
              leftIcon={<Mail size={15} />}
              loading={emailMutation.isPending}
              disabled={!emailTo.trim()}
              onClick={() => emailMutation.mutate()}
            >
              Enviar
            </Button>
          </div>
        }
      >
        <Input
          label="Correo del cliente"
          type="email"
          required
          value={emailTo}
          onChange={(e) => setEmailTo(e.target.value)}
          placeholder="cliente@correo.com"
        />
        <p className="text-xs text-text-secondary mt-2">
          Se adjuntará el PDF del recibo/factura. Requiere Resend configurado en el servidor.
        </p>
      </Modal>

      <Modal
        isOpen={!!returnSale && !!returnDetail}
        onClose={() => setReturnSale(null)}
        title={`Devolución — ${returnSale?.invoiceNumber ?? ''}`}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setReturnSale(null)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={returnMutation.isPending}
              disabled={
                !returnReason.trim() ||
                !Object.values(returnQtys).some((q) => Number(q) > 0)
              }
              onClick={() => returnMutation.mutate()}
            >
              Procesar devolución
            </Button>
          </div>
        }
      >
        {returnDetail && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Indica las cantidades a devolver. El stock se reingresa automáticamente.
              Si devuelves todos los productos, la venta se anula.
            </p>
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[280px]">
              <thead>
                <tr className="text-text-secondary text-xs border-b border-border-subtle">
                  <th className="text-left pb-2">Producto</th>
                  <th className="text-center pb-2">Vendidos</th>
                  <th className="text-center pb-2">Devolver</th>
                </tr>
              </thead>
              <tbody>
                {returnDetail.items?.map((item: any) => (
                  <tr key={item.id} className="border-b border-border-subtle/50">
                    <td className="py-2">{item.product?.name}</td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="py-2">
                      <Input
                        type="number"
                        min={0}
                        max={Number(item.quantity)}
                        step="0.001"
                        value={returnQtys[item.productId] ?? 0}
                        onChange={(e) =>
                          setReturnQtys((prev) => ({
                            ...prev,
                            [item.productId]: Number(e.target.value),
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Textarea
              label="Motivo de devolución"
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              placeholder="Producto defectuoso, equívoco de cliente, etc."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
