import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Plus, Minus, Lock, Unlock, History, TrendingUp, FileText } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { toast } from '@/components/ui/Toast'
import { StatCard } from '@/components/ui/index'
import { formatCurrency, formatDateTime, openCashCloseReport } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/errors'
import { useCashRegisterStore } from '@/store/cashRegisterStore'
import { useActiveCashSession } from '@/hooks/useActiveCashSession'
import { useAuthStore } from '@/store/authStore'
import { PageLoader } from '@/components/ui/Spinner'

interface CashSession {
  id: number
  userId: number
  openingAmount: number
  openedAt: string
  closedAt?: string | null
  expectedAmount?: number | null
  closingAmount?: number | null
  difference?: number | null
  status: 'ABIERTA' | 'CERRADA'
  user?: { name: string }
}

interface CashMovement {
  id: number
  createdAt: string
  type: string
  amount: number
  reason: string
  user?: { name: string }
}

export default function CashRegisterPage() {
  const [tab, setTab] = useState<'caja' | 'movimientos' | 'historial'>('caja')
  const [openAmount, setOpenAmount] = useState('')
  const [closeAmount, setCloseAmount] = useState('')
  const [showMovModal, setShowMovModal] = useState(false)
  const [movType, setMovType] = useState<'INGRESO' | 'EGRESO'>('INGRESO')
  const [movAmount, setMovAmount] = useState('')
  const [movReason, setMovReason] = useState('')
  const [lastClosedSessionId, setLastClosedSessionId] = useState<number | null>(null)
  const [histPage, setHistPage] = useState(1)
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const { session, isLoading } = useActiveCashSession()
  const closeSession = useCashRegisterStore((s) => s.closeSession)

  const { data: movements = [], isLoading: loadingMov } = useQuery<CashMovement[]>({
    queryKey: ['cash-movements', session?.id],
    queryFn: async () => (await api.get(`/cash-register/movements?sessionId=${session!.id}`)).data,
    enabled: !!session?.id && tab === 'movimientos',
  })

  const { data: sessions } = useQuery<{ data: CashSession[]; total: number }>({
    queryKey: ['cash-sessions', histPage],
    queryFn: async () => (await api.get(`/cash-register/sessions?page=${histPage}&limit=15`)).data,
    enabled: tab === 'historial',
  })

  const openMutation = useMutation({
    mutationFn: () => api.post('/cash-register/open', { openingAmount: Number(openAmount) }),
    onSuccess: () => {
      toast.success('Caja abierta')
      qc.invalidateQueries({ queryKey: ['active-session'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al abrir caja')),
  })

  const closeMutation = useMutation({
    mutationFn: async () => {
      const before = session?.id
      const res = await api.post('/cash-register/close', { closingAmount: Number(closeAmount) })
      return { ...res.data, previousSessionId: before }
    },
    onSuccess: (data) => {
      closeSession()
      if (data?.id) setLastClosedSessionId(data.id)
      else if (data?.previousSessionId) setLastClosedSessionId(data.previousSessionId)
      toast.success('Caja cerrada')
      qc.invalidateQueries({ queryKey: ['active-session'] })
      qc.invalidateQueries({ queryKey: ['cash-sessions'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al cerrar caja')),
  })

  const movMutation = useMutation({
    mutationFn: () => api.post('/cash-register/movements', { sessionId: session!.id, type: movType, amount: Number(movAmount), reason: movReason }),
    onSuccess: () => { toast.success('Movimiento registrado'); qc.invalidateQueries({ queryKey: ['cash-movements'] }); setShowMovModal(false); setMovAmount(''); setMovReason('') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al registrar movimiento')),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Caja Registradora</h1>
          <p className="page-subtitle">
            {session ? <span className="text-green-400">Caja abierta</span> : <span className="text-red-400">Sin caja activa</span>}
          </p>
        </div>
        {session && (
          <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setShowMovModal(true)} id="add-movement-btn">
            Agregar Movimiento
          </Button>
        )}
      </div>

      <div className="tabs mb-6">
        {(['caja', 'movimientos', 'historial'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
            {t === 'caja' ? 'Estado de Caja' : t === 'movimientos' ? 'Movimientos' : 'Historial'}
          </button>
        ))}
      </div>

      {tab === 'caja' && (
        <div className="max-w-xl mx-auto space-y-6">
          {!session ? (
            <div className="card text-center space-y-5">
              <div className="w-16 h-16 mx-auto bg-accent-muted rounded-full flex items-center justify-center">
                <Unlock size={32} className="text-accent-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">Apertura de Caja</h2>
                <p className="text-sm text-text-secondary mt-1">Ingresa el monto inicial en efectivo</p>
              </div>
              <Input label="Monto inicial (L.)" type="number" min="0" step="0.01" value={openAmount}
                onChange={(e) => setOpenAmount(e.target.value)} placeholder="0.00" />
              <Button variant="primary" fullWidth size="lg" onClick={() => openMutation.mutate()}
                loading={openMutation.isPending} disabled={!openAmount || Number(openAmount) < 0} id="open-cash-btn">
                Abrir Caja
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard label="Cajero" value={session.user?.name ?? user?.name ?? '—'} icon={<DollarSign size={18} />} />
                <StatCard label="Apertura" value={formatDateTime(session.openedAt).split(' ')[1] ?? '—'} />
                <StatCard label="Monto Inicial" value={formatCurrency(session.openingAmount)} changeType="neutral" />
                <StatCard label="Estado" value="ABIERTA" changeType="positive" />
              </div>
              <div className="card space-y-4">
                <h3 className="font-semibold text-text-primary">Cierre de Caja</h3>
                <p className="text-sm text-text-secondary">Ingresa el monto contado físicamente en caja.</p>
                <Input label="Monto contado (L.)" type="number" min="0" step="0.01"
                  value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} placeholder="0.00" />
                <Button variant="danger" fullWidth onClick={() => closeMutation.mutate()}
                  loading={closeMutation.isPending} disabled={!closeAmount}
                  leftIcon={<Lock size={16} />} id="close-cash-btn">
                  Cerrar Caja
                </Button>
                {lastClosedSessionId && (
                  <Button
                    variant="secondary"
                    fullWidth
                    leftIcon={<FileText size={16} />}
                    onClick={() => openCashCloseReport(lastClosedSessionId)}
                  >
                    Ver reporte de cierre (PDF)
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'movimientos' && (
        <Table
          columns={[
            { key: 'createdAt', header: 'Fecha', render: (m) => formatDateTime(m.createdAt) },
            { key: 'type', header: 'Tipo', render: (m) => <Badge variant={m.type === 'INGRESO' ? 'success' : 'danger'}>{m.type}</Badge> },
            { key: 'amount', header: 'Monto', align: 'right', render: (m) => <span className={Number(m.amount) >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(Math.abs(m.amount))}</span> },
            { key: 'reason', header: 'Motivo', render: (m) => m.reason },
            { key: 'user', header: 'Usuario', render: (m) => m.user?.name ?? '—' },
          ]}
          data={movements} loading={loadingMov}
          keyExtractor={(m) => m.id}
          emptyMessage={session ? 'Sin movimientos en esta sesión' : 'No hay caja activa'}
        />
      )}

      {tab === 'historial' && (
        <>
          <Table
            minWidth="980px"
            columns={[
              { key: 'openedAt', header: 'Apertura', render: (s) => formatDateTime(s.openedAt) },
              { key: 'closedAt', header: 'Cierre', render: (s) => s.closedAt ? formatDateTime(s.closedAt) : '—' },
              { key: 'user', header: 'Cajero', render: (s) => s.user?.name ?? '—' },
              { key: 'openingAmount', header: 'Monto Inicial', align: 'right', render: (s) => formatCurrency(s.openingAmount) },
              { key: 'expectedAmount', header: 'Monto Esperado', align: 'right', render: (s) => s.expectedAmount != null ? formatCurrency(s.expectedAmount) : '—' },
              { key: 'closingAmount', header: 'Monto Contado', align: 'right', render: (s) => s.closingAmount != null ? formatCurrency(s.closingAmount) : '—' },
              { key: 'difference', header: 'Diferencia', align: 'right', render: (s) => {
                if (s.difference == null) return '—'
                const d = Number(s.difference)
                return <span className={d === 0 ? 'text-text-secondary' : d > 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(d)}</span>
              }},
              { key: 'status', header: 'Estado', align: 'center', render: (s) => <Badge variant={s.status === 'ABIERTA' ? 'success' : 'neutral'}>{s.status}</Badge> },
              { key: 'actions', header: 'Reporte', align: 'center', render: (s) => s.status === 'CERRADA' ? (
                <Button variant="ghost" size="sm" leftIcon={<FileText size={14} />} onClick={() => openCashCloseReport(s.id)}>
                  PDF
                </Button>
              ) : '—' },
            ]}
            data={sessions?.data ?? []} keyExtractor={(s) => s.id}
            emptyMessage="Sin sesiones anteriores" emptyIcon={<History size={48} />}
          />
          <Pagination currentPage={histPage} totalPages={Math.ceil((sessions?.total ?? 0) / 15)} totalItems={sessions?.total ?? 0} itemsPerPage={15} onPageChange={setHistPage} />
        </>
      )}

      {/* Modal Movimiento */}
      <Modal isOpen={showMovModal} onClose={() => setShowMovModal(false)} title="Registrar Movimiento" size="sm"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => setShowMovModal(false)}>Cancelar</Button>
          <Button variant="primary" onClick={() => movMutation.mutate()} loading={movMutation.isPending}
            disabled={!movAmount || !movReason} id="save-movement-btn">
            Registrar
          </Button></div>}>
        <div className="space-y-4">
          <Select label="Tipo" value={movType} onChange={(e) => setMovType(e.target.value as any)}
            options={[{ value: 'INGRESO', label: 'Ingreso' }, { value: 'EGRESO', label: 'Egreso' }]} />
          <Input label="Monto (L.)" type="number" min="0.01" step="0.01" value={movAmount} onChange={(e) => setMovAmount(e.target.value)} />
          <Input label="Motivo" value={movReason} onChange={(e) => setMovReason(e.target.value)} placeholder="Ej: Pago de servicio, fondo de cambio..." />
        </div>
      </Modal>
    </div>
  )
}
