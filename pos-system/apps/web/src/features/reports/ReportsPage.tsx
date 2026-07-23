import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, Package, Users, Download, FileText } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'

type ReportTab = 'ventas' | 'productos' | 'cajeros' | 'inventario' | 'ganancia'

interface SaleReportItem {
  id: number
  invoiceNumber: string
  createdAt: string
  total: number
  status: string
  customer?: { name: string }
  user?: { name: string }
}

interface ProductReportItem {
  product?: { id?: number; sku?: string; name?: string }
  quantitySold: number
  revenue: number
}

interface CashierReportItem {
  userId: number
  userName: string
  salesCount: number
  totalRevenue: number
  average: number
}

interface InventoryReportItem {
  quantity: number
  status: string
  costValue: number
  saleValue: number
  product?: { id?: number; sku?: string; name?: string; costPrice?: number; category?: { name: string } }
}

interface GrossProfitItem {
  productId: number
  name: string
  sku: string
  quantity: number
  revenue: number
  cost: number
  profit: number
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('ventas')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const queryParams = `from=${from}&to=${to}`

  const { data: salesReport, isLoading: loadingSales } = useQuery<{
    count: number
    totalRevenue: number
    totalTax: number
    sales: SaleReportItem[]
  }>({
    queryKey: ['report-sales', from, to],
    queryFn: async () => (await api.get(`/reports/sales?${queryParams}`)).data,
    enabled: tab === 'ventas',
  })

  const { data: productsReport = [], isLoading: loadingProducts } = useQuery<ProductReportItem[]>({
    queryKey: ['report-products', from, to],
    queryFn: async () => (await api.get(`/reports/products?${queryParams}`)).data,
    enabled: tab === 'productos',
  })

  const { data: cashiersReport = [], isLoading: loadingCashiers } = useQuery<CashierReportItem[]>({
    queryKey: ['report-cashiers', from, to],
    queryFn: async () => (await api.get(`/reports/cashiers?${queryParams}`)).data,
    enabled: tab === 'cajeros',
  })

  const { data: inventoryReport = [], isLoading: loadingInventory } = useQuery<InventoryReportItem[]>({
    queryKey: ['report-inventory'],
    queryFn: async () => (await api.get('/reports/inventory')).data,
    enabled: tab === 'inventario',
  })

  const { data: profitReport, isLoading: loadingProfit } = useQuery<{
    revenue: number
    cost: number
    profit: number
    margin: number
    salesCount: number
    products: GrossProfitItem[]
  }>({
    queryKey: ['report-gross-profit', from, to],
    queryFn: async () => (await api.get(`/reports/gross-profit?${queryParams}`)).data,
    enabled: tab === 'ganancia',
  })

  const handleExport = async (format: 'pdf' | 'excel') => {
    const ext = format === 'pdf' ? 'pdf' : 'csv'
    const type = tab === 'ganancia' ? 'ganancia' : tab
    const url = `/api/reports/export/${format === 'pdf' ? 'pdf' : 'excel'}?type=${type}&${queryParams}`
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-${type}.${ext}`
    link.click()
  }

  const productsWithRank = productsReport.map((p, idx) => ({ ...p, rank: idx + 1 }))

  const salesChartData = salesReport?.sales?.slice(0, 30).reduce((acc: { date: string; total: number }[], s) => {
    const day = s.createdAt?.slice(0, 10)?.slice(5) ?? ''
    const existing = acc.find((d) => d.date === day)
    if (existing) existing.total += Number(s.total)
    else acc.push({ date: day, total: Number(s.total) })
    return acc
  }, []) ?? []

  const tabLabels: Record<ReportTab, string> = {
    ventas: 'Ventas',
    productos: 'Productos',
    cajeros: 'Cajeros',
    inventario: 'Inventario',
    ganancia: 'Ganancia bruta',
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Analiza el rendimiento de tu negocio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<FileText size={16} />} onClick={() => handleExport('pdf')} id="export-pdf-btn">
            Exportar PDF
          </Button>
          <Button variant="secondary" leftIcon={<Download size={16} />} onClick={() => handleExport('excel')} id="export-excel-btn">
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="card mb-5 flex flex-wrap items-end gap-4">
        <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} fullWidth={false} />
        <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} fullWidth={false} />
        <Button variant="ghost" onClick={() => { setFrom(''); setTo('') }}>Limpiar fechas</Button>
      </div>

      <div className="tabs mb-6">
        {(['ventas', 'productos', 'cajeros', 'inventario', 'ganancia'] as ReportTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Tab: Ventas */}
      {tab === 'ventas' && (
        <div className="space-y-6">
          {loadingSales ? <PageLoader /> : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">Total Ventas</p>
                  <p className="text-3xl font-bold text-accent-light">{salesReport?.count ?? 0}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">Ingresos</p>
                  <p className="text-3xl font-bold text-green-400">{formatCurrency(salesReport?.totalRevenue ?? 0)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">ISV Total</p>
                  <p className="text-3xl font-bold text-text-primary">{formatCurrency(salesReport?.totalTax ?? 0)}</p>
                </div>
              </div>

              {salesChartData.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-text-secondary mb-4">Ventas por día</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: '#8B92A5', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8B92A5', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `L.${v}`} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} labelStyle={{ color: '#E2E8F0' }} contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                      <Bar dataKey="total" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <Table
                columns={[
                  { key: 'invoiceNumber', header: 'Factura', render: (s) => <span className="font-mono text-xs">{s.invoiceNumber}</span> },
                  { key: 'createdAt', header: 'Fecha', render: (s) => s.createdAt?.slice(0, 10) },
                  { key: 'customer', header: 'Cliente', render: (s) => s.customer?.name ?? 'Consumidor Final' },
                  { key: 'user', header: 'Cajero', render: (s) => s.user?.name },
                  { key: 'total', header: 'Total', align: 'right', render: (s) => formatCurrency(s.total) },
                  { key: 'status', header: 'Estado', align: 'center', render: (s) => <Badge variant={s.status === 'COMPLETADA' ? 'success' : 'danger'}>{s.status}</Badge> },
                ]}
                data={salesReport?.sales?.slice(0, 50) ?? []}
                keyExtractor={(s) => s.id} emptyMessage="Sin ventas en el período"
              />
            </>
          )}
        </div>
      )}

      {/* Tab: Productos */}
      {tab === 'productos' && (
        <Table
          columns={[
            { key: 'rank', header: '#', render: (p) => <span className="text-text-secondary">{p.rank}</span> },
            { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.product?.sku}</span> },
            { key: 'name', header: 'Producto', render: (p) => p.product?.name ?? '—' },
            { key: 'quantitySold', header: 'Unidades Vendidas', align: 'center', render: (p) => <span className="font-bold">{p.quantitySold}</span> },
            { key: 'revenue', header: 'Ingresos', align: 'right', render: (p) => formatCurrency(p.revenue) },
          ]}
          data={productsWithRank} loading={loadingProducts}
          keyExtractor={(p) => p.product?.id ?? p.rank}
          emptyMessage="Sin datos de productos" emptyIcon={<Package size={48} />}
        />
      )}

      {/* Tab: Cajeros */}
      {tab === 'cajeros' && (
        <Table
          columns={[
            { key: 'userName', header: 'Cajero' },
            { key: 'salesCount', header: 'Ventas', align: 'center', render: (c) => <span className="font-bold">{c.salesCount}</span> },
            { key: 'totalRevenue', header: 'Total Vendido', align: 'right', render: (c) => formatCurrency(c.totalRevenue) },
            { key: 'average', header: 'Promedio/Venta', align: 'right', render: (c) => formatCurrency(c.average) },
          ]}
          data={cashiersReport} loading={loadingCashiers}
          keyExtractor={(c) => c.userId}
          emptyMessage="Sin datos de cajeros" emptyIcon={<Users size={48} />}
        />
      )}

      {/* Tab: Inventario */}
      {tab === 'inventario' && (
        <Table
          columns={[
            { key: 'sku', header: 'SKU', render: (i) => <span className="font-mono text-xs">{i.product?.sku}</span> },
            { key: 'name', header: 'Producto', render: (i) => <div><p>{i.product?.name}</p><p className="text-xs text-text-secondary">{i.product?.category?.name}</p></div> },
            { key: 'quantity', header: 'Stock', align: 'center', render: (i) => <Badge variant={i.status === 'AGOTADO' ? 'danger' : i.status === 'BAJO' ? 'warning' : 'success'} dot>{i.quantity}</Badge> },
            { key: 'costPrice', header: 'Costo Unit.', align: 'right', render: (i) => formatCurrency(i.product?.costPrice) },
            { key: 'costValue', header: 'Valor en Costo', align: 'right', render: (i) => formatCurrency(i.costValue) },
            { key: 'saleValue', header: 'Valor en Venta', align: 'right', render: (i) => formatCurrency(i.saleValue) },
            { key: 'status', header: 'Estado', align: 'center', render: (i) => <Badge variant={i.status === 'AGOTADO' ? 'danger' : i.status === 'BAJO' ? 'warning' : 'success'}>{i.status}</Badge> },
          ]}
          data={inventoryReport} loading={loadingInventory}
          keyExtractor={(i) => i.product?.id ?? Math.random()}
          emptyMessage="Sin datos de inventario"
        />
      )}

      {tab === 'ganancia' && (
        <div className="space-y-6">
          {loadingProfit ? <PageLoader /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">Ingresos</p>
                  <p className="text-2xl font-bold text-accent-light">{formatCurrency(profitReport?.revenue ?? 0)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">Costo</p>
                  <p className="text-2xl font-bold text-text-primary">{formatCurrency(profitReport?.cost ?? 0)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">Ganancia bruta</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(profitReport?.profit ?? 0)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-text-secondary text-xs uppercase tracking-wide mb-1">Margen</p>
                  <p className="text-2xl font-bold text-text-primary">{(profitReport?.margin ?? 0).toFixed(1)}%</p>
                </div>
              </div>
              <Table
                columns={[
                  { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
                  { key: 'name', header: 'Producto' },
                  { key: 'quantity', header: 'Cant.', align: 'center' },
                  { key: 'revenue', header: 'Ingresos', align: 'right', render: (p) => formatCurrency(p.revenue) },
                  { key: 'cost', header: 'Costo', align: 'right', render: (p) => formatCurrency(p.cost) },
                  { key: 'profit', header: 'Ganancia', align: 'right', render: (p) => (
                    <span className={p.profit >= 0 ? 'text-green-400 font-semibold' : 'text-danger font-semibold'}>
                      {formatCurrency(p.profit)}
                    </span>
                  )},
                ]}
                data={profitReport?.products ?? []}
                keyExtractor={(p) => p.productId}
                emptyMessage="Sin datos de ganancia en el período"
                emptyIcon={<TrendingUp size={48} />}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
