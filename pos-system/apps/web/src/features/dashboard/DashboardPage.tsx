import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ShoppingCart,
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useActiveCashSession } from '@/hooks/useActiveCashSession'
import { formatCurrency, formatDateTime, statusLabel, statusClass } from '@/lib/utils'
import { StatCard } from '@/components/ui/index'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PageMotion, Stagger, StaggerItem } from '@/lib/motion'

interface DashboardStats {
  salesToday: number
  totalToday: number
  totalWeek: number
  productsLowStock: number
  activeSessions: number
  topProducts: { name: string; quantity: number }[]
  recentSales: {
    id: number
    invoiceNumber: string
    total: number
    status: string
    customerName: string | null
    createdAt: string
  }[]
  salesChart: { date: string; total: number }[]
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { session: activeSession } = useActiveCashSession()
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/reports/dashboard')
      return res.data
    },
    refetchInterval: 60000, // refrescar cada minuto
  })

  if (isLoading) return <PageLoader />

  const s = stats ?? {
    salesToday: 0,
    totalToday: 0,
    totalWeek: 0,
    productsLowStock: 0,
    activeSessions: 0,
    topProducts: [],
    recentSales: [],
    salesChart: [],
  }

  return (
    <PageMotion>
      {/* Encabezado */}
      <div className="page-header mb-8">
        <div>
          <h1 className="page-title">Resumen del negocio</h1>
          <p className="page-subtitle">
            Bienvenido, {user?.name} — {formatDateTime(new Date().toISOString())}
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<ShoppingCart size={16} />}
          onClick={() => navigate('/pos')}
          id="dashboard-new-sale-btn"
        >
          Nueva Venta
        </Button>
      </div>

      {/* Alerta de caja */}
      {!activeSession && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-700/40 bg-warning-muted mb-6">
          <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-300">Sin caja abierta</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              Abre una caja para comenzar a registrar ventas
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/cash-register')}
          >
            Abrir Caja
          </Button>
        </div>
      )}

      {/* Resumen al estilo BankDash, alimentado por el servicio actual */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StaggerItem>
          <StatCard
            label="Ventas Hoy"
            value={String(s.salesToday)}
            change="transacciones"
            icon={<ShoppingCart size={20} />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Ingresos Hoy"
            value={formatCurrency(s.totalToday)}
            change="total del día"
            changeType="positive"
            icon={<DollarSign size={20} />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Ingresos Semana"
            value={formatCurrency(s.totalWeek)}
            icon={<TrendingUp size={20} />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Stock Bajo"
            value={String(s.productsLowStock)}
            change={s.productsLowStock > 0 ? 'productos requieren atención' : 'todo OK'}
            changeType={s.productsLowStock > 0 ? 'negative' : 'positive'}
            icon={<Package size={20} />}
          />
        </StaggerItem>
      </Stagger>

      {/* Layout de dos columnas principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Gráfica de ventas — 2/3 */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Ventas — Últimos 7 días
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Ingresos diarios acumulados
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reports')}
              rightIcon={<ArrowRight size={14} />}
            >
              Ver Reportes
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={s.salesChart}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-accent-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-text-secondary)"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="var(--color-text-secondary)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v) => `L.${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary)',
                }}
                formatter={(value) => [formatCurrency(Number(value) || 0), 'Total']}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-accent-primary)"
                strokeWidth={3}
                fill="url(#colorTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Productos más vendidos — 1/3 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text-primary">
              Más Vendidos
            </h2>
            <BarChart3 size={16} className="text-text-secondary" />
          </div>
          {s.topProducts.length === 0 ? (
            <p className="text-text-secondary text-sm text-center py-8">
              Sin datos de ventas hoy
            </p>
          ) : (
            <div className="space-y-3">
              {s.topProducts.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-secondary w-4">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {p.name}
                    </p>
                    <div className="mt-1 h-1.5 rounded-full bg-bg-primary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-primary transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (p.quantity / (s.topProducts[0]?.quantity || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary font-medium flex-shrink-0">
                    {p.quantity} uds
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ventas recientes */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Ventas Recientes
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/sales')}
            rightIcon={<ArrowRight size={14} />}
          >
            Ver todas
          </Button>
        </div>
        {s.recentSales.length === 0 ? (
          <div className="empty-state py-10">
            <Clock size={40} className="text-text-secondary mb-3 opacity-40" />
            <p className="empty-state-title">Sin ventas hoy</p>
            <p className="empty-state-desc">Las ventas del día aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2">
            {s.recentSales.slice(0, 8).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
                onClick={() => navigate('/sales')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {sale.invoiceNumber}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {sale.customerName ?? 'Consumidor final'} •{' '}
                    {formatDateTime(sale.createdAt)}
                  </p>
                </div>
                <Badge variant={
                  sale.status === 'COMPLETADA' ? 'success' :
                  sale.status === 'ANULADA' ? 'danger' : 'warning'
                } dot>
                  {statusLabel(sale.status)}
                </Badge>
                <span className="text-sm font-semibold text-text-primary ml-2">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageMotion>
  )
}
