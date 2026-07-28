import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Spinner } from './Spinner'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  /** Ocultar en vista móvil de tarjetas */
  hideOnMobile?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  keyExtractor: (row: T) => string | number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onRowClick?: (row: T) => void
  /** Ancho mínimo de la tabla (scroll horizontal si hace falta) */
  minWidth?: string
}

function alignText(align?: 'left' | 'center' | 'right') {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

function alignFlex(align?: 'left' | 'center' | 'right') {
  if (align === 'right') return 'justify-end'
  if (align === 'center') return 'justify-center'
  return 'justify-start'
}

export function Table<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos para mostrar',
  emptyIcon,
  keyExtractor,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  minWidth = '720px',
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        {emptyIcon && <div className="empty-state-icon">{emptyIcon}</div>}
        <p className="empty-state-title">{emptyMessage}</p>
        <p className="empty-state-desc text-text-secondary text-sm mt-1">
          Ajusta los filtros o agrega nuevos registros
        </p>
      </div>
    )
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile)

  return (
    <>
      {/* Vista móvil: tarjetas */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            className={`card p-4 space-y-2.5 ${onRowClick ? 'cursor-pointer active:bg-bg-hover' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {mobileColumns.map((col) => (
              <div key={col.key} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-text-secondary shrink-0 font-medium">{col.header}</span>
                <span className={`text-text-primary min-w-0 break-words ${alignText(col.align)}`}>
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Vista desktop: tabla ancha con scroll */}
      <div className="table-container hidden md:block">
        <table className="table" style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  className={alignText(col.align)}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex w-full items-center gap-1 hover:text-text-primary transition-colors ${alignFlex(col.align)}`}
                    >
                      <span>{col.header}</span>
                      {sortBy === col.key ? (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : (
                        <ChevronsUpDown size={14} className="opacity-40 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <span className={`inline-flex w-full items-center ${alignFlex(col.align)}`}>
                      {col.header}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {columns.map((col) => {
                  const content = col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '—')
                  const needsFlexAlign = col.align === 'center' || col.align === 'right'

                  return (
                    <td key={col.key} className={alignText(col.align)}>
                      {needsFlexAlign ? (
                        <div className={`flex w-full items-center ${alignFlex(col.align)}`}>
                          {content}
                        </div>
                      ) : (
                        content
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
