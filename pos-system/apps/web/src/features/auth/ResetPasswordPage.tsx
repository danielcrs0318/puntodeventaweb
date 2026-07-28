import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirma tu contraseña'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) =>
      (await api.post('/auth/reset-password', { token, password: data.password })).data,
    onSuccess: (data: { message: string }) => {
      toast.success('Contraseña actualizada', data.message)
      navigate('/login', { replace: true })
    },
    onError: (error) => toast.error('Error', getApiErrorMessage(error, 'No se pudo restablecer la contraseña')),
  })

  if (!token) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="card max-w-md p-8 text-center space-y-4">
          <p className="text-text-secondary">El enlace de recuperación no es válido.</p>
          <Link to="/forgot-password" className="text-accent-primary hover:text-accent-hover text-sm">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    )
  }

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      className="text-text-secondary hover:text-text-primary transition-colors p-0.5"
      aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nueva contraseña</h1>
          <p className="text-sm text-text-secondary mt-1">Elige una contraseña segura de al menos 8 caracteres.</p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Nueva contraseña"
            type={showPassword ? 'text' : 'password'}
            leftIcon={<Lock size={16} />}
            rightIcon={eyeBtn(showPassword, () => setShowPassword((s) => !s))}
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirmar contraseña"
            type={showConfirm ? 'text' : 'password'}
            leftIcon={<Lock size={16} />}
            rightIcon={eyeBtn(showConfirm, () => setShowConfirm((s) => !s))}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" variant="primary" fullWidth loading={mutation.isPending}>
            Guardar contraseña
          </Button>
        </form>
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-accent-primary hover:text-accent-hover">
          <ArrowLeft size={16} /> Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
