import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, CreditCard, ArrowLeftRight, Plus, Minus, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, calculateChange, openSaleReceipt } from '@/lib/utils'
import api from '@/lib/api'

type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'MIXTO'

interface CartItem {
  productId: number
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  total: number
  items: CartItem[]
  customerId: number | null
  sessionId: number
  userId: number
  onSuccess: () => void
}

export function PaymentModal({
  isOpen,
  onClose,
  total,
  items,
  customerId,
  sessionId,
  onSuccess,
}: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO')
  const [amountPaid, setAmountPaid] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [receiptEmail, setReceiptEmail] = useState('')
  const queryClient = useQueryClient()

  const change = method === 'EFECTIVO' ? calculateChange(Number(amountPaid) || 0, total) : 0

  const saleMutation = useMutation({
    mutationFn: async () => {
      const payments: { method: PaymentMethod; amount: number }[] = []

      if (method === 'EFECTIVO') {
        payments.push({ method: 'EFECTIVO', amount: total })
      } else if (method === 'TARJETA') {
        payments.push({ method: 'TARJETA', amount: total })
      } else if (method === 'TRANSFERENCIA') {
        payments.push({ method: 'TRANSFERENCIA', amount: total })
      } else if (method === 'MIXTO') {
        const cash = Number(cashAmount) || 0
        const card = Number(cardAmount) || 0
        payments.push({ method: 'EFECTIVO', amount: cash })
        payments.push({ method: 'TARJETA', amount: card })
      }

      const payload = {
        customerId: customerId || null,
        cashRegisterSessionId: sessionId,
        paymentMethod: method,
        payments,
        notes,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
      }

      const res = await api.post('/sales', payload)
      return res.data
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['products-pos'] })
      toast.success('Venta completada', `Factura ${data.invoiceNumber} generada`)
      onSuccess()

      if (data.id) {
        void openSaleReceipt(data.id)
      }

      if (sendEmail && receiptEmail.trim() && data.id) {
        try {
          const mailRes = await api.post(`/sales/${data.id}/send-receipt`, { email: receiptEmail.trim() })
          toast.success(mailRes.data?.sent ? 'Comprobante enviado' : 'Aviso', mailRes.data?.message)
        } catch {
          toast.error('La venta se guardó, pero no se pudo enviar el correo')
        }
      }
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error('Error al procesar venta', err.response?.data?.message ?? 'Intenta de nuevo')
    },
  })

  const isValid = () => {
    if (sendEmail && !receiptEmail.trim()) return false
    if (method === 'EFECTIVO') return Number(amountPaid) >= total
    if (method === 'MIXTO') {
      return Number(cashAmount) + Number(cardAmount) >= total
    }
    return true
  }

  const methodButtons: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: <Banknote size={18} /> },
    { value: 'TARJETA', label: 'Tarjeta', icon: <CreditCard size={18} /> },
    { value: 'TRANSFERENCIA', label: 'Transferencia', icon: <ArrowLeftRight size={18} /> },
    { value: 'MIXTO', label: 'Mixto', icon: <Plus size={18} /> },
  ]

  const quickAmounts = [50, 100, 200, 500, 1000]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Procesar Pago"
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => saleMutation.mutate()}
            loading={saleMutation.isPending}
            disabled={!isValid()}
            fullWidth
            leftIcon={<Check size={16} />}
            id="payment-confirm-btn"
          >
            Confirmar Venta
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Total */}
        <div className="bg-bg-primary rounded-xl p-4 text-center border border-border-subtle">
          <p className="text-sm text-text-secondary mb-1">Total a cobrar</p>
          <p className="text-4xl font-bold text-accent-light">{formatCurrency(total)}</p>
        </div>

        {/* Método de pago */}
        <div>
          <p className="label mb-2">Método de pago</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {methodButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setMethod(btn.value)}
                className={[
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all',
                  method === btn.value
                    ? 'border-accent-primary bg-accent-muted text-accent-light'
                    : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-accent-primary/50',
                ].join(' ')}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Monto efectivo */}
        {method === 'EFECTIVO' && (
          <div>
            <Input
              label="Monto recibido (L.)"
              type="number"
              min={total}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              autoFocus
              id="payment-cash-amount"
            />
            {/* Montos rápidos */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {quickAmounts
                .filter((a) => a >= Math.ceil(total / 50) * 50 - 50 || a === 50)
                .slice(0, 5)
                .map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAmountPaid(String(amount))}
                    className="px-3 py-1 rounded-full border border-border-subtle text-xs text-text-secondary hover:border-accent-primary hover:text-accent-light transition-all"
                  >
                    L. {amount}
                  </button>
                ))}
            </div>
            {Number(amountPaid) >= total && (
              <div className="mt-3 p-3 bg-success-muted border border-green-700/40 rounded-lg flex justify-between">
                <span className="text-sm text-green-300">Cambio a devolver</span>
                <span className="text-lg font-bold text-green-300">{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Pago mixto */}
        {method === 'MIXTO' && (
          <div className="space-y-3">
            <Input
              label="Monto en efectivo (L.)"
              type="number"
              min="0"
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="0.00"
              id="payment-mixed-cash"
            />
            <Input
              label="Monto en tarjeta (L.)"
              type="number"
              min="0"
              step="0.01"
              value={cardAmount}
              onChange={(e) => setCardAmount(e.target.value)}
              placeholder="0.00"
              id="payment-mixed-card"
            />
            {Number(cashAmount) + Number(cardAmount) > 0 && (
              <p className={[
                'text-sm font-medium',
                Number(cashAmount) + Number(cardAmount) >= total ? 'text-green-400' : 'text-red-400',
              ].join(' ')}>
                Registrado: {formatCurrency(Number(cashAmount) + Number(cardAmount))} / {formatCurrency(total)}
              </p>
            )}
          </div>
        )}

        {/* Notas */}
        <Input
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Referencia de pago, número de autorización, etc."
          id="payment-notes"
        />

        <div className="space-y-2 border-t border-border-subtle pt-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-border-subtle"
            />
            Enviar comprobante por correo al cliente
          </label>
          {sendEmail && (
            <Input
              label="Correo del cliente"
              type="email"
              value={receiptEmail}
              onChange={(e) => setReceiptEmail(e.target.value)}
              placeholder="cliente@correo.com"
              required
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
