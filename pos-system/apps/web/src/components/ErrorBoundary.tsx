import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Error de renderizado' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[POS:ErrorBoundary]', error.message, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
          <div className="card max-w-md w-full text-center p-8 space-y-4">
            <AlertTriangle size={48} className="mx-auto text-warning" />
            <h1 className="text-xl font-bold text-text-primary">Algo salió mal</h1>
            <p className="text-sm text-text-secondary">{this.state.errorMessage}</p>
            <Button variant="primary" leftIcon={<RefreshCw size={16} />} onClick={this.handleReload}>
              Recargar aplicación
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
