import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
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
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => (await api.post('/auth/forgot-password', data)).data,
    onSuccess: (data: { message: string; resetUrl?: string }) => {
      toast.success('Solicitud enviada', data.message)
      if (data.resetUrl) {
        console.info('[POS:password-reset] Enlace de desarrollo (Resend no configurado):', data.resetUrl)
        toast.info('Modo desarrollo', 'Resend no configurado: revisa la consola para el enlace de restablecimiento.')
      } else {
        toast.info('Revisa tu correo', 'Si la cuenta existe, el enlace llegará en unos minutos.')
      }
    },
    onError: (error) => toast.error('Error', getApiErrorMessage(error, 'No se pudo procesar la solicitud')),
  })

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
