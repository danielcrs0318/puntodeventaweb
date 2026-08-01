import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'

const schema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) =>
      (await api.post('/auth/forgot-password', { email: data.email.trim().toLowerCase() })).data,
    onSuccess: (data: { message: string; resetUrl?: string }, variables) => {
      const email = variables.email.trim().toLowerCase()
      setSentEmail(email)
      setDevResetUrl(data.resetUrl ?? null)
      toast.success('Correo enviado', data.message || 'Revisa tu bandeja de entrada')
      if (data.resetUrl) {
        console.info('[POS:password-reset] Enlace de desarrollo (Resend no configurado):', data.resetUrl)
        toast.info('Modo desarrollo', 'Resend no configurado: revisa la consola o el enlace en pantalla.')
      }
    },
    onError: (error) => toast.error('Error', getApiErrorMessage(error, 'No se pudo procesar la solicitud')),
  })

  if (sentEmail) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="w-full max-w-md card p-8 space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-success-muted flex items-center justify-center">
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Revisa tu correo</h1>
            <p className="text-sm text-text-secondary mt-2">
              Si existe una cuenta con <strong className="text-text-primary">{sentEmail}</strong>,
              recibirás un enlace para restablecer tu contraseña.
            </p>
          </div>
          {devResetUrl && (
            <div className="rounded-xl border border-border-subtle bg-bg-secondary p-3 text-left">
              <p className="text-xs text-text-secondary mb-1">Enlace de desarrollo (Resend off):</p>
              <a
                href={devResetUrl}
                className="text-sm text-accent-primary break-all hover:underline"
              >
                {devResetUrl}
              </a>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setSentEmail(null)
                setDevResetUrl(null)
              }}
            >
              Enviar de nuevo
            </Button>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-sm text-accent-primary hover:text-accent-hover"
            >
              <ArrowLeft size={16} /> Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Recuperar contraseña</h1>
          <p className="text-sm text-text-secondary mt-1">
            Ingresa tu correo y te enviaremos instrucciones si la cuenta existe.
          </p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            leftIcon={<Mail size={16} />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" variant="primary" fullWidth loading={mutation.isPending}>
            Enviar instrucciones
          </Button>
        </form>
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-accent-primary hover:text-accent-hover">
          <ArrowLeft size={16} /> Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
