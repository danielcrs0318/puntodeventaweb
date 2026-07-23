import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import api from '@/lib/api'

interface ImportProductsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportProductsModal({ isOpen, onClose, onSuccess }: ImportProductsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecciona un archivo')
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/products/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success('Importación completada', `${data.imported} productos importados`)
      onSuccess()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error('Error de importación', e.response?.data?.message ?? 'Formato inválido')
    },
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar Productos desde CSV" size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button
            variant="primary"
            leftIcon={<Upload size={16} />}
            onClick={() => importMutation.mutate()}
            loading={importMutation.isPending}
            disabled={!file}
            id="import-products-btn"
          >
            Importar Archivo
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Instrucciones */}
        <div className="p-3 bg-accent-muted border border-accent-primary/30 rounded-lg">
          <p className="text-sm font-medium text-accent-light mb-2">Formato requerido del CSV:</p>
          <p className="text-xs text-text-secondary font-mono">
            sku, nombre, precio_costo, precio_venta, stock, categoria, codigo_barras
          </p>
        </div>

        {/* Drop zone */}
        <label className="block cursor-pointer">
          <div className={[
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            file ? 'border-accent-primary bg-accent-muted/20' : 'border-border-subtle hover:border-accent-primary/50',
          ].join(' ')}>
            {file ? (
              <>
                <FileText size={32} className="mx-auto text-accent-primary mb-2" />
                <p className="text-sm font-medium text-text-primary">{file.name}</p>
                <p className="text-xs text-text-secondary mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <Upload size={32} className="mx-auto text-text-secondary mb-2 opacity-40" />
                <p className="text-sm text-text-secondary">Arrastra un archivo CSV o haz clic para seleccionar</p>
              </>
            )}
          </div>
          <input
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
            id="import-file-input"
          />
        </label>

        {/* Resultado */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-success-muted border border-green-700/40 rounded-lg">
              <CheckCircle size={16} className="text-green-400" />
              <p className="text-sm text-green-300">{result.imported} productos importados exitosamente</p>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 bg-warning-muted border border-yellow-700/40 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-yellow-400" />
                  <p className="text-sm font-medium text-yellow-300">{result.errors.length} filas con errores:</p>
                </div>
                <ul className="text-xs text-yellow-400/80 space-y-1 max-h-24 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
