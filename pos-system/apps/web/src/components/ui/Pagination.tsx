import { type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)
  const pages = getPageNumbers(currentPage, totalPages)
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-sm text-text-secondary">Mostrando {start}–{end} de {totalItems} registros</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Página anterior">
          <ChevronLeft size={16} />
        </Button>
        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`e-${i}`} className="px-2 text-text-secondary text-sm">...</span>
          ) : (
            <Button key={page} variant={page === currentPage ? 'primary' : 'ghost'} size="sm"
              onClick={() => onPageChange(page as number)}>
              {page}
            </Button>
          ),
        )}
        <Button variant="ghost" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Página siguiente">
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
