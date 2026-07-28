import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, Package, Users, Download, FileText, Search } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { downloadApiFile, formatCurrency } from '@/lib/utils'
import { getApiErrorMessageAsync } from '@/lib/errors'
import { toast } from '@/components/ui/Toast'
import { PageLoader } from '@/components/ui/Spinner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type ReportTab = 'ventas' | 'productos' | 'cajeros' | 'inventario' | 'ganancia'

const tabLabels: Record<ReportTab, string> = {
  ventas: 'Ventas',
  productos: 'Productos',
  cajeros: 'Cajeros',
  inventario: 'Inventario',
  ganancia: 'Ganancia bruta',
}

const PAGE_SIZE = 20

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
  rank?: number
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
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const dateParams = new URLSearchParams()
  if (from) dateParams.set('from', from)
  if (to) dateParams.set('to', to)
  const dateQuery = dateParams.toString()
  const withDatesAnd = dateQuery ? `&${dateQuery}` : ''

  const listParams = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  })
  if (from) listParams.set('from', from)
  if (to) listParams.set('to', to)
  if (debouncedSearch) listParams.set('search', debouncedSearch)
  const listQuery = listParams.toString()

  const { data: salesReport, isLoading: loadingSales } = useQuery<{
    count: number
    totalRevenue: number
    totalTax: number
    sales: SaleReportItem[]
    page?: number
    limit?: number
  }>({
    queryKey: ['report-sales', from, to, page, debouncedSearch],
    queryFn: async () => (await api.get(`/reports/sales?${listQuery}`)).data,
    enabled: tab === 'ventas',
  })

  const { data: productsReport, isLoading: loadingProducts } = useQuery<{
    data: ProductReportItem[]
    total: number
  }>({
    queryKey: ['report-products', from, to, page, debouncedSearch],
    queryFn: async () => (await api.get(`/reports/products?${listQuery}`)).data,
    enabled: tab === 'productos',
  })

  const { data: cashiersReport = [], isLoading: loadingCashiers } = useQuery<CashierReportItem[]>({
    queryKey: ['report-cashiers', from, to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const q = params.toString()
      return (await api.get(`/reports/cashiers${q ? `?${q}` : ''}`)).data
    },
    enabled: tab === 'cajeros',
  })

  const { data: inventoryReport, isLoading: loadingInventory } = useQuery<{
    data: InventoryReportItem[]
    total: number
  }>({
    queryKey: ['report-inventory', page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      return (await api.get(`/reports/inventory?${params}`)).data
    },
    enabled: tab === 'inventario',
  })

  const { data: profitReport, isLoading: loadingProfit } = useQuery<{
    revenue: number
    cost: number
    profit: number
    margin: number
    salesCount: number
    products: GrossProfitItem[]
    total: number
  }>({
    queryKey: ['report-gross-profit', from, to, page, debouncedSearch],
    queryFn: async () => (await api.get(`/reports/gross-profit?${listQuery}`)).data,
    enabled: tab === 'ganancia',
  })

  const handleExport = async (format: 'pdf' | 'excel') => {
    const type = tab === 'ganancia' ? 'ganancia' : tab
    const ext = format === 'pdf' ? 'pdf' : 'csv'
    const path = `/reports/export/${format === 'pdf' ? 'pdf' : 'excel'}?type=${type}${withDatesAnd}`
    const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8'

    try {
      setExporting(format)
      await downloadApiFile(path, `reporte-${type}.${ext}`, mime)
      toast.success('Descarga lista', `Reporte de ${tabLabels[tab]} (${ext.toUpperCase()})`)
    } catch (error: unknown) {
      toast.error('No se pudo descargar', await getApiErrorMessageAsync(error, 'Intenta de nuevo'))
    } finally {
      setExporting(null)
    }
  }

  const productsWithRank = (productsReport?.data ?? []).map((p, idx) => ({
    ...p,
    rank: (page - 1) * PAGE_SIZE + idx + 1,
  }))

  const salesChartData = salesReport?.sales?.reduce((acc: { date: string; total: number }[], s) => {
    const day = s.createdAt?.slice(0, 10)?.slice(5) ?? ''
    const existing = acc.find((d) => d.date === day)
    if (existing) existing.total += Number(s.total)
    else acc.push({ date: day, total: Number(s.total) })
    return acc
  }, []) ?? []

  const showSearch = tab !== 'cajeros'
  const listTotal =
    tab === 'ventas' ? (salesReport?.count ?? 0)
      : tab === 'productos' ? (productsReport?.total ?? 0)
        : tab === 'inventario' ? (inventoryReport?.total ?? 0)
          : tab === 'ganancia' ? (profitReport?.total ?? 0)
            : 0

  const changeTab = (t: ReportTab) => {
    setTab(t)
    setPage(1)
    setSearch('')
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Analiza el rendimiento de tu negocio</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            leftIcon={<FileText size={16} />}
            onClick={() => handleExport('pdf')}
            loading={exporting === 'pdf'}
            disabled={!!exporting}
            id="export-pdf-btn"
            className="w-full sm:w-auto"
          >
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Download size={16} />}
            onClick={() => handleExport('excel')}
            loading={exporting === 'excel'}
            disabled={!!exporting}
            id="export-excel-btn"
            className="w-full sm:w-auto"
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="card mb-5 flex flex-wrap items-end gap-4">
        <Input label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} fullWidth={false} />
        <Input label="Hasta" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} fullWidth={false} />
        {showSearch && (
          <Input
            label="Buscar"
            placeholder="Factura, producto, SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={<Search size={16} />}
            className="w-full sm:min-w-[220px]"
            fullWidth={false}
          />
        )}
        <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setSearch(''); setPage(1) }}>Limpiar</Button>
      </div>

      <div className="tabs mb-6">
        {(['ventas', 'productos', 'cajeros', 'inventario', 'ganancia'] as ReportTab[]).map((t) => (
          <button key={t} type="button" onClick={() => changeTab(t)} className={`tab ${tab === t ? 'active' : ''}`}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {tab === 'ventas' && (
        <div className="space-y-6">
          {loadingSales ? <PageLoader /> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <h3 className="text-sm font-semibold text-text-secondary mb-4">Ventas por día (página actual)</h3>
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
                minWidth="880px"
                columns={[
                  { key: 'invoiceNumber', header: 'Factura', render: (s) => <span className="font-mono text-xs">{s.invoiceNumber}</span> },
                  { key: 'createdAt', header: 'Fecha', render: (s) => s.createdAt?.slice(0, 10) },
                  { key: 'customer', header: 'Cliente', render: (s) => s.customer?.name ?? 'Consumidor Final' },
                  { key: 'user', header: 'Cajero', render: (s) => s.user?.name },
                  { key: 'total', header: 'Total', align: 'right', render: (s) => formatCurrency(s.total) },
                  { key: 'status', header: 'Estado', align: 'center', render: (s) => <Badge variant={s.status === 'COMPLETADA' ? 'success' : 'danger'}>{s.status}</Badge> },
                ]}
                data={salesReport?.sales ?? []}
                keyExtractor={(s) => s.id}
                emptyMessage="Sin ventas en el período"
              />
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(listTotal / PAGE_SIZE)}
                totalItems={listTotal}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}

      {tab === 'productos' && (
        <>
          <Table
            minWidth="720px"
            columns={[
              { key: 'rank', header: '#', render: (p) => <span className="text-text-secondary">{p.rank}</span> },
              { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.product?.sku}</span> },
              { key: 'name', header: 'Producto', render: (p) => p.product?.name ?? '—' },
              { key: 'quantitySold', header: 'Unidades Vendidas', align: 'center', render: (p) => <span className="font-bold">{p.quantitySold}</span> },
              { key: 'revenue', header: 'Ingresos', align: 'right', render: (p) => formatCurrency(p.revenue) },
            ]}
            data={productsWithRank}
            loading={loadingProducts}
            keyExtractor={(p) => p.product?.id ?? p.rank ?? 0}
            emptyMessage="Sin datos de productos"
            emptyIcon={<Package size={48} />}
          />
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(listTotal / PAGE_SIZE)}
            totalItems={listTotal}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {tab === 'cajeros' && (
        <Table
          columns={[
            { key: 'userName', header: 'Cajero' },
            { key: 'salesCount', header: 'Ventas', align: 'center', render: (c) => <span className="font-bold">{c.salesCount}</span> },
            { key: 'totalRevenue', header: 'Total Vendido', align: 'right', render: (c) => formatCurrency(c.totalRevenue) },
            { key: 'average', header: 'Promedio/Venta', align: 'right', render: (c) => formatCurrency(c.average) },
          ]}
          data={cashiersReport}
          loading={loadingCashiers}
          keyExtractor={(c) => c.userId}
          emptyMessage="Sin datos de cajeros"
          emptyIcon={<Users size={48} />}
        />
      )}

      {tab === 'inventario' && (
        <>
          <Table
            minWidth="900px"
            columns={[
              { key: 'sku', header: 'SKU', render: (i) => <span className="font-mono text-xs">{i.product?.sku}</span> },
              { key: 'name', header: 'Producto', render: (i) => <div><p>{i.product?.name}</p><p className="text-xs text-text-secondary">{i.product?.category?.name}</p></div> },
              { key: 'quantity', header: 'Stock', align: 'center', render: (i) => <Badge variant={i.status === 'AGOTADO' ? 'danger' : i.status === 'BAJO' ? 'warning' : 'success'} dot>{i.quantity}</Badge> },
              { key: 'costPrice', header: 'Costo Unit.', align: 'right', render: (i) => formatCurrency(i.product?.costPrice) },
              { key: 'costValue', header: 'Valor en Costo', align: 'right', render: (i) => formatCurrency(i.costValue) },
              { key: 'saleValue', header: 'Valor en Venta', align: 'right', render: (i) => formatCurrency(i.saleValue) },
              { key: 'status', header: 'Estado', align: 'center', render: (i) => <Badge variant={i.status === 'AGOTADO' ? 'danger' : i.status === 'BAJO' ? 'warning' : 'success'}>{i.status}</Badge> },
            ]}
            data={inventoryReport?.data ?? []}
            loading={loadingInventory}
            keyExtractor={(i) => `${i.product?.id ?? i.product?.sku ?? 'row'}-${i.quantity}`}
            emptyMessage="Sin datos de inventario"
          />
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(listTotal / PAGE_SIZE)}
            totalItems={listTotal}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
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
                minWidth="860px"
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
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(listTotal / PAGE_SIZE)}
                totalItems={listTotal}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
