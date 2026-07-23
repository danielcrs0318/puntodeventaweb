import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, User, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'

interface Customer {
  id: number
  name: string
  identificationNumber?: string
  phone?: string
}

interface CustomerSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (id: number, name: string) => void
}

export function CustomerSearchModal({ isOpen, onClose, onSelect }: CustomerSearchModalProps) {
  const [search, setSearch] = useState('')

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers-search', search],
    queryFn: async () => {
      const res = await api.get(`/customers/search?q=${encodeURIComponent(search)}&limit=10`)
      return res.data
    },
    enabled: isOpen,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Cliente" size="sm">
      <div className="space-y-4">
        <Input
          placeholder="Buscar por nombre, RTN o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          autoFocus
          id="customer-search-input"
        />

        {/* Consumidor final */}
        <button
          onClick={() => { onSelect(0, 'Consumidor Final'); setSearch('') }}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-accent-primary hover:bg-bg-hover transition-all text-left"
        >
          <div className="w-9 h-9 rounded-full bg-bg-secondary flex items-center justify-center">
            <User size={16} className="text-text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Consumidor Final</p>
            <p className="text-xs text-text-secondary">Sin identificación</p>
          </div>
        </button>

        {/* Lista */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : customers.length === 0 && search ? (
            <p className="text-center text-sm text-text-secondary py-6">
              No se encontraron clientes
            </p>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id, c.name); setSearch('') }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-accent-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                  <p className="text-xs text-text-secondary">
                    {c.identificationNumber ?? ''} {c.phone ? `· ${c.phone}` : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
