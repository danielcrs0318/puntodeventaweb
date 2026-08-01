import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, Store, Lock, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { getHomePath } from '@/lib/access'
import { easeOut, motionDur } from '@/lib/motion'
import { preloadEntryPages } from '@/lib/prefetch'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  // Los chunks de entrada se bajan mientras el usuario escribe: al entrar no hay espera.
  useEffect(() => preloadEntryPages(), [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await api.post('/auth/login', data)
      return res.data
    },
    onSuccess: (data) => {
      setAuth(
        data.user,
        data.accessToken,
        data.refreshToken,
        data.branches ?? [],
        data.activeBranch ?? null,
      )
      navigate(getHomePath(), { replace: true })
      // Se aplaza para no montar el toast (spring + layout) en el mismo cuadro
      // en que se monta todo el layout privado.
      window.setTimeout(() => {
        toast.success('Bienvenido', `Hola, ${data.user.name}`)
      }, 400)
    },
    onError: (error: unknown) => {
      const err = error as { response?: { status?: number } }
      if (err.response?.status === 401) {
        setError('password', { message: 'Correo o contraseña incorrectos' })
      } else if (err.response?.status === 429) {
        toast.error('Cuenta bloqueada', 'Demasiados intentos fallidos. Intenta más tarde.')
      } else {
        toast.error('Error', getApiErrorMessage(error, 'Error al conectar con el servidor'))
      }
    },
  })

  const auroraPaused = loginMutation.isPending || loginMutation.isSuccess

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className={`login-aurora login-aurora--a ${auroraPaused ? 'login-aurora--paused' : ''}`} />
        <div className={`login-aurora login-aurora--b ${auroraPaused ? 'login-aurora--paused' : ''}`} />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: motionDur.slow, ease: easeOut }}
      >
        <motion.div
          className="text-center mb-8"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: motionDur.base, ease: easeOut }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-primary mb-4 shadow-glow-accent"
            whileHover={reduce ? undefined : { scale: 1.04 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
          >
            <Store size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-text-primary">POS Honduras</h1>
          <p className="text-text-secondary mt-1 text-sm">Sistema de Punto de Venta</p>
        </motion.div>

        <motion.div
          className="card p-8"
          initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: motionDur.slow, ease: easeOut }}
        >
          <h2 className="text-lg font-semibold text-text-primary mb-6">Iniciar Sesión</h2>

          <form
            onSubmit={handleSubmit((data) => loginMutation.mutate(data))}
            className="space-y-5"
            id="login-form"
          >
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="usuario@negocio.hn"
              autoComplete="email"
              autoFocus
              leftIcon={<Mail size={16} />}
              error={errors.email?.message}
              required
              {...register('email')}
            />

            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              leftIcon={<Lock size={16} />}
              rightIcon={
                <button
                  type="button"
                  tabIndex={0}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowPassword((s) => !s)
                  }}
                  className="text-text-secondary hover:text-text-primary transition-colors p-0.5"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              error={errors.password?.message}
              required
              {...register('password')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loginMutation.isPending}
              id="login-submit-btn"
            >
              Ingresar al Sistema
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-subtle text-center">
            <p className="text-xs text-text-secondary">
              ¿Olvidaste tu contraseña?{' '}
              <Link
                to="/forgot-password"
                className="text-accent-primary hover:text-accent-hover underline transition-colors"
              >
                Recuperar acceso
              </Link>
            </p>
          </div>
        </motion.div>

        <p className="text-center text-xs text-text-secondary mt-6">
          POS Honduras &copy; {new Date().getFullYear()} — Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  )
}
