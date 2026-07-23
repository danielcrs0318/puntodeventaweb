import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search } from 'lucide-react'
import api from '@/lib/api'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { formatDateTime } from '@/lib/utils'

const PAGE_SIZE = 30

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ action: '', entity: '', from: '', to: '' })

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (filters.action) p.set('action', filters.action)
    if (filters.entity) p.set('entity', filters.entity)
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    return p.toString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, filters],
    queryFn: async () => (await api.get(`/audit?${buildQuery()}`)).data,
  })

  const logs: any[] = data?.data ?? []
  const total: number = data?.total ?? 0

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="page-subtitle">Registro de acciones críticas del sistema</p>
        </div>
      </div>

      <div className="card mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Acción"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            placeholder="LOGIN, SALE_VOIDED..."
            leftIcon={<Search size={14} />}
            fullWidth={false}
          />
          <Input
            label="Entidad"
            value={filters.entity}
            onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}
            placeholder="Sale, User, Inventory..."
            fullWidth={false}
          />
          <Input
            label="Desde"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            fullWidth={false}
          />
          <Input
            label="Hasta"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            fullWidth={false}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setFilters({ action: '', entity: '', from: '', to: '' })
              setPage(1)
            }}
          >
            Limpiar
          </Button>
        </div>
      </div>

      <Table
        columns={[
          {
            key: 'createdAt',
            header: 'Fecha',
            render: (l) => formatDateTime(l.createdAt),
          },
          {
            key: 'user',
            header: 'Usuario',
            render: (l) => l.user?.name ?? 'Sistema',
          },
          {
            key: 'action',
            header: 'Acción',
            render: (l) => <span className="font-mono text-xs text-accent-light">{l.action}</span>,
          },
          {
            key: 'entity',
            header: 'Entidad',
            render: (l) => (
              <span>
                {l.entity}
                {l.entityId != null ? ` #${l.entityId}` : ''}
              </span>
            ),
          },
          {
            key: 'details',
            header: 'Detalle',
            render: (l) => (
              <span className="text-xs text-text-secondary line-clamp-2 max-w-md">
                {l.details ? JSON.stringify(l.details) : '—'}
              </span>
            ),
          },
        ]}
        data={logs}
        loading={isLoading}
        keyExtractor={(l) => l.id}
        emptyMessage="No hay registros de auditoría"
        emptyIcon={<Shield size={48} />}
      />

      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
