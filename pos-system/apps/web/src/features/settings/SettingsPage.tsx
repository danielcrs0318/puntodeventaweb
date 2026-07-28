import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Store, Shield, Users, DollarSign, Bell,
  Save, Upload, Eye, EyeOff, Plus, Edit, Trash2, Lock, Search,
} from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog, Pagination } from '@/components/ui/index'
import { Table } from '@/components/ui/Table'
import { toast } from '@/components/ui/Toast'
import { PageLoader } from '@/components/ui/Spinner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type SettingsTab = 'negocio' | 'impuestos' | 'usuarios' | 'seguridad' | 'fiscal'

interface AppSettings {
  businessName: string
  taxId?: string
  currency: string
  currencySymbol: string
  taxRateDefault: number
  invoiceFooterText?: string
  address?: string
  phone?: string
  email?: string
  fiscalInvoicingEnabled: boolean
  lowStockThreshold: number
  caiAlertThreshold: number
  caiDaysAlertThreshold: number
}

interface UserBranchLink {
  branchId: number
  isDefault: boolean
  branch: { id: number; code: string; name: string; isActive?: boolean }
}

interface UserItem {
  id: number
  name: string
  email: string
  role: { id: number; name: string }
  isActive: boolean
  createdAt: string
  /** Prisma relation name on User */
  branches?: UserBranchLink[]
}

interface BranchItem {
  id: number
  code: string
  name: string
  isActive: boolean
  isMain?: boolean
}

const businessSchema = z.object({
  businessName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  taxId: z.string().optional(),
  currency: z.string().min(1),
  currencySymbol: z.string().min(1),
  taxRateDefault: z.coerce.number<number>().min(0).max(1),
  invoiceFooterText: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
})

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  roleId: z.coerce.number<number>().int().min(1),
  branchIds: z.array(z.number().int()).min(1, 'Asigna al menos una sucursal'),
  defaultBranchId: z.coerce.number<number>().int().optional(),
})

type BusinessFormData = z.infer<typeof businessSchema>
type UserFormData = z.infer<typeof userSchema>

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('negocio')
  const [showUserForm, setShowUserForm] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [showUserPassword, setShowUserPassword] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const qc = useQueryClient()
  const debouncedUserSearch = useDebouncedValue(userSearch)
  const USER_PAGE_SIZE = 15

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users', userPage, debouncedUserSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(userPage),
        limit: String(USER_PAGE_SIZE),
      })
      if (debouncedUserSearch) params.set('search', debouncedUserSearch)
      return (await api.get(`/users?${params}`)).data
    },
    enabled: activeTab === 'usuarios',
  })
  const users: UserItem[] = usersData?.data ?? []
  const usersTotal: number = usersData?.total ?? 0

  const { data: roles = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/roles')).data,
  })

  const { data: branches = [] } = useQuery<BranchItem[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
    enabled: activeTab === 'usuarios' || showUserForm,
  })

  const activeBranches = branches.filter((b) => b.isActive !== false)

  const {
    register: regBiz, handleSubmit: handleBiz, formState: { errors: bizErrors }, reset: resetBiz,
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    values: settings as BusinessFormData | undefined,
  })

  const {
    register: regUser,
    handleSubmit: handleUser,
    control: userControl,
    watch: watchUser,
    setValue: setUserValue,
    formState: { errors: userErrors },
    reset: resetUser,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { branchIds: [], password: '' },
  })

  const selectedBranchIds = watchUser('branchIds') ?? []

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: BusinessFormData) => {
      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return api.patch('/settings', data)
    },
    onSuccess: () => {
      toast.success('Configuración guardada')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error('Error al guardar la configuración'),
  })

  const toggleFiscalMutation = useMutation({
    mutationFn: (enabled: boolean) => api.patch('/settings', { fiscalInvoicingEnabled: enabled }),
    onSuccess: () => { toast.success('Configuración actualizada'); qc.invalidateQueries({ queryKey: ['settings'] }) },
  })

  const saveUserMutation = useMutation({
    mutationFn: (data: UserFormData) => {
      const branchIds = data.branchIds
      const defaultId =
        data.defaultBranchId && branchIds.includes(Number(data.defaultBranchId))
          ? Number(data.defaultBranchId)
          : branchIds[0]
      const payload = {
        name: data.name,
        email: data.email,
        roleId: Number(data.roleId),
        branchIds,
        defaultBranchId: defaultId,
        ...(data.password ? { password: data.password } : {}),
      }
      if (editUser) return api.patch(`/users/${editUser.id}`, payload)
      if (!data.password) throw new Error('La contraseña es requerida')
      return api.post('/users', { ...payload, password: data.password })
    },
    onSuccess: () => {
      toast.success(editUser ? 'Usuario actualizado' : 'Usuario creado')
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowUserForm(false)
      setEditUser(null)
      setShowUserPassword(false)
      resetUser({ branchIds: [], password: '' })
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      toast.error('Error', e.response?.data?.message ?? e.message ?? 'No se pudo guardar el usuario')
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('Usuario eliminado'); qc.invalidateQueries({ queryKey: ['users'] }); setDeleteUser(null) },
  })

  const toggleUserMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const openNewUser = () => {
    setEditUser(null)
    setShowUserPassword(false)
    const mainId = activeBranches.find((b) => b.isMain)?.id ?? activeBranches[0]?.id
    resetUser({
      name: '',
      email: '',
      password: '',
      roleId: roles[0]?.id,
      branchIds: mainId ? [mainId] : [],
      defaultBranchId: mainId,
    })
    setShowUserForm(true)
  }

  const openEditUser = (u: UserItem) => {
    setEditUser(u)
    setShowUserPassword(false)
    const ids = (u.branches ?? []).map((ub) => ub.branchId)
    const def = u.branches?.find((ub) => ub.isDefault)?.branchId ?? ids[0]
    resetUser({
      name: u.name,
      email: u.email,
      roleId: u.role.id,
      password: '',
      branchIds: ids,
      defaultBranchId: def,
    })
    setShowUserForm(true)
  }

  if (isLoading) return <PageLoader />

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'negocio', label: 'Datos del Negocio', icon: <Store size={16} /> },
    { key: 'impuestos', label: 'Impuestos', icon: <DollarSign size={16} /> },
    { key: 'fiscal', label: 'Facturación Fiscal', icon: <Shield size={16} /> },
    { key: 'usuarios', label: 'Usuarios y Roles', icon: <Users size={16} /> },
    { key: 'seguridad', label: 'Notificaciones', icon: <Bell size={16} /> },
  ]

  return (
    <div className={`animate-fade-in ${activeTab === 'usuarios' ? 'w-full max-w-none' : 'max-w-4xl'}`}>
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Ajustes generales del sistema POS</p>
        </div>
      </div>

      {/* Tabs verticales */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="flex-shrink-0 lg:w-52">
          <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0 -mx-1 px-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={[
                  'flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg text-sm font-medium text-left transition-all whitespace-nowrap flex-shrink-0',
                  activeTab === t.key
                    ? 'bg-accent-muted text-accent-light border border-accent-primary/30'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                ].join(' ')}
              >
                {t.icon}<span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Tab: Negocio */}
          {activeTab === 'negocio' && (
            <div className="card space-y-5">
              <h2 className="text-base font-semibold text-text-primary">Datos del Negocio</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nombre del Negocio" error={bizErrors.businessName?.message} required {...regBiz('businessName')} />
                <Input label="RTN (Número Tributario)" placeholder="0801199900000" {...regBiz('taxId')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Teléfono" {...regBiz('phone')} />
                <Input label="Correo electrónico" type="email" {...regBiz('email')} />
              </div>
              <Input label="Dirección" {...regBiz('address')} />
              <Input label="Texto de pie de factura" {...regBiz('invoiceFooterText')}
                helperText='Ej. "La factura es beneficio del cliente. Exíjala."' />

              {/* Logo */}
              <div>
                <label className="label">Logo del Negocio</label>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded border border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-accent-primary transition-all text-sm">
                  <Upload size={14} /> Cargar Logo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} id="settings-logo-input" />
                </label>
                {logoFile && <span className="text-xs text-text-secondary ml-2">{logoFile.name}</span>}
              </div>

              <div className="flex justify-end">
                <Button variant="primary" leftIcon={<Save size={16} />}
                  onClick={handleBiz((d) => saveSettingsMutation.mutate(d))}
                  loading={saveSettingsMutation.isPending} id="settings-save-business-btn">
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}

          {/* Tab: Impuestos */}
          {activeTab === 'impuestos' && (
            <div className="card space-y-5">
              <h2 className="text-base font-semibold text-text-primary">Configuración de Impuestos y Moneda</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Moneda" options={[
                  { value: 'HNL', label: 'Lempira Hondureño (HNL)' },
                  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
                ]} {...regBiz('currency')} />
                <Input label="Símbolo de moneda" placeholder="L." {...regBiz('currencySymbol')} />
              </div>
              <Select label="Tasa de ISV por defecto" options={[
                { value: '0.15', label: '15% — Estándar (Honduras)' },
                { value: '0.18', label: '18% — Turismo' },
                { value: '0', label: '0% — Exento' },
              ]} {...regBiz('taxRateDefault')} />
              <div className="flex justify-end">
                <Button variant="primary" leftIcon={<Save size={16} />}
                  onClick={handleBiz((d) => saveSettingsMutation.mutate(d))}
                  loading={saveSettingsMutation.isPending} id="settings-save-tax-btn">
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}

          {/* Tab: Fiscal */}
          {activeTab === 'fiscal' && (
            <div className="card space-y-5">
              <h2 className="text-base font-semibold text-text-primary">Facturación Fiscal CAI</h2>
              <p className="text-sm text-text-secondary">
                Activa este módulo si tu negocio está autorizado por la SAR para emitir facturas fiscales con número CAI.
                Si está desactivado, el sistema emite recibos internos normales.
              </p>
              <div className="flex flex-col gap-4 p-4 bg-bg-primary rounded-lg border border-border-subtle sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">Facturación Fiscal Habilitada</p>
                  <p className="text-xs text-text-secondary mt-0.5 leading-5">
                    {settings?.fiscalInvoicingEnabled
                      ? 'Las ventas generarán facturas fiscales con numeración CAI'
                      : 'Las ventas generarán recibos internos sin datos fiscales'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFiscalMutation.mutate(!settings?.fiscalInvoicingEnabled)}
                  aria-pressed={Boolean(settings?.fiscalInvoicingEnabled)}
                  className={[
                    'relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200',
                    settings?.fiscalInvoicingEnabled ? 'bg-accent-primary' : 'bg-border-subtle',
                  ].join(' ')}
                  id="settings-fiscal-toggle"
                >
                  <span className={[
                    'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200',
                    settings?.fiscalInvoicingEnabled ? 'translate-x-7' : 'translate-x-1',
                  ].join(' ')} />
                </button>
              </div>
              {settings?.fiscalInvoicingEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Alertar cuando queden (facturas)" type="number" defaultValue={50}
                      {...regBiz('caiAlertThreshold' as any)} />
                    <Input label="Alertar con (días) de anticipación" type="number" defaultValue={15}
                      {...regBiz('caiDaysAlertThreshold' as any)} />
                  </div>
                  <Button variant="secondary" onClick={() => window.location.href = '/fiscal'}>
                    Gestionar Rangos CAI
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tab: Usuarios */}
          {activeTab === 'usuarios' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-text-primary">Usuarios del Sistema</h2>
                <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}
                  onClick={openNewUser} id="settings-new-user-btn">
                  Nuevo Usuario
                </Button>
              </div>
              <Input
                placeholder="Buscar por nombre, correo o rol..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }}
                leftIcon={<Search size={16} />}
                className="w-full sm:max-w-sm"
              />
              <Table
                minWidth="960px"
                columns={[
                  { key: 'name', header: 'Nombre', width: '180px' },
                  { key: 'email', header: 'Correo', width: '220px' },
                  { key: 'role', header: 'Rol', width: '120px', render: (u) => <Badge variant="accent">{u.role.name}</Badge> },
                  {
                    key: 'branches',
                    header: 'Sucursales',
                    width: '220px',
                    render: (u) => {
                      const links = u.branches ?? []
                      if (!links.length) return <span className="text-text-secondary text-xs">—</span>
                      return (
                        <div className="flex flex-wrap gap-1">
                          {links.map((ub) => (
                            <Badge key={ub.branchId} variant={ub.isDefault ? 'accent' : 'neutral'}>
                              {ub.branch?.code ?? ub.branchId}
                            </Badge>
                          ))}
                        </div>
                      )
                    },
                  },
                  { key: 'isActive', header: 'Estado', align: 'center', width: '110px', render: (u) => (
                    <button type="button" onClick={() => toggleUserMutation.mutate({ id: u.id, isActive: !u.isActive })}>
                      <Badge variant={u.isActive ? 'success' : 'neutral'} dot>{u.isActive ? 'Activo' : 'Inactivo'}</Badge>
                    </button>
                  )},
                  { key: 'actions', header: 'Acciones', align: 'center', width: '100px', hideOnMobile: false, render: (u) => (
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditUser(u)} aria-label="Editar"><Edit size={15} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteUser(u)} aria-label="Eliminar">
                        <Trash2 size={15} className="text-danger" />
                      </Button>
                    </div>
                  )},
                ]}
                data={users}
                keyExtractor={(u) => u.id}
                emptyMessage="No hay usuarios"
                emptyIcon={<Users size={40} />}
              />
              <Pagination
                currentPage={userPage}
                totalPages={Math.ceil(usersTotal / USER_PAGE_SIZE)}
                totalItems={usersTotal}
                itemsPerPage={USER_PAGE_SIZE}
                onPageChange={setUserPage}
              />
            </div>
          )}

          {/* Tab: Notificaciones */}
          {activeTab === 'seguridad' && (
            <div className="space-y-6">
              <div className="card space-y-5">
                <h2 className="text-base font-semibold text-text-primary">Alertas y Notificaciones</h2>
                <Input
                  label="Umbral de alerta de stock mínimo"
                  type="number"
                  min="1"
                  helperText="Se mostrará alerta cuando el stock de un producto llegue a esta cantidad"
                  defaultValue={settings?.lowStockThreshold}
                  {...regBiz('lowStockThreshold' as any)}
                />
                <div className="flex justify-end">
                  <Button variant="primary" leftIcon={<Save size={16} />}
                    onClick={handleBiz((d) => saveSettingsMutation.mutate(d))}
                    loading={saveSettingsMutation.isPending} id="settings-save-alerts-btn">
                    Guardar Cambios
                  </Button>
                </div>
              </div>

              <div className="card space-y-4">
                <h2 className="text-base font-semibold text-text-primary">Respaldo de datos</h2>
                <p className="text-sm text-text-secondary">
                  Exporta un archivo JSON con configuración, usuarios, productos, ventas y datos fiscales.
                </p>
                <Button
                  variant="secondary"
                  leftIcon={<Upload size={16} />}
                  onClick={async () => {
                    try {
                      const res = await api.get('/settings/backup', { responseType: 'blob' })
                      const url = window.URL.createObjectURL(new Blob([res.data]))
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`
                      a.click()
                      window.URL.revokeObjectURL(url)
                      toast.success('Respaldo generado', 'El archivo se descargó correctamente')
                    } catch (error) {
                      const { getApiErrorMessage } = await import('@/lib/errors')
                      toast.error('Error', getApiErrorMessage(error, 'No se pudo generar el respaldo'))
                    }
                  }}
                  id="settings-backup-btn"
                >
                  Descargar respaldo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal usuario */}
      <Modal isOpen={showUserForm} onClose={() => { setShowUserForm(false); setEditUser(null); setShowUserPassword(false); resetUser({ branchIds: [], password: '' }) }}
        title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'} size="md"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowUserForm(false); setShowUserPassword(false); resetUser({ branchIds: [], password: '' }) }}>Cancelar</Button>
            <Button variant="primary" onClick={handleUser((d) => saveUserMutation.mutate(d))}
              loading={saveUserMutation.isPending} id="user-form-submit-btn">
              {editUser ? 'Guardar' : 'Crear Usuario'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Nombre completo" error={userErrors.name?.message} required {...regUser('name')} />
          <Input label="Correo electrónico" type="email" error={userErrors.email?.message} required {...regUser('email')} />
          <Input
            label={editUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
            type={showUserPassword ? 'text' : 'password'}
            error={userErrors.password?.message}
            helperText="Mínimo 8 caracteres"
            required={!editUser}
            leftIcon={<Lock size={16} />}
            rightIcon={
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowUserPassword((s) => !s)
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="text-text-secondary hover:text-text-primary transition-colors p-0.5"
                aria-label={showUserPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            {...regUser('password')}
          />
          <Select label="Rol" options={roles.map((r) => ({ value: r.id, label: r.name }))}
            error={userErrors.roleId?.message} required {...regUser('roleId')} />

          <div>
            <p className="label mb-2">
              Sucursales asignadas <span className="text-danger">*</span>
            </p>
            {activeBranches.length === 0 ? (
              <p className="text-sm text-text-secondary">No hay sucursales activas. Crea una en Sucursales.</p>
            ) : (
              <Controller
                name="branchIds"
                control={userControl}
                render={({ field }) => (
                  <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-border-subtle p-3 bg-bg-primary">
                    {activeBranches.map((b) => {
                      const checked = field.value?.includes(b.id)
                      return (
                        <label key={b.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-border-subtle"
                            checked={!!checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...(field.value ?? []), b.id]
                                : (field.value ?? []).filter((id) => id !== b.id)
                              field.onChange(next)
                              const currentDefault = watchUser('defaultBranchId')
                              if (e.target.checked && (!currentDefault || !(field.value ?? []).includes(Number(currentDefault)))) {
                                setUserValue('defaultBranchId', b.id)
                              }
                              if (!e.target.checked && Number(currentDefault) === b.id) {
                                setUserValue('defaultBranchId', next[0])
                              }
                            }}
                          />
                          <span className="font-mono text-xs text-accent-light">{b.code}</span>
                          <span>{b.name}</span>
                          {b.isMain && <Badge variant="neutral">Principal</Badge>}
                        </label>
                      )
                    })}
                  </div>
                )}
              />
            )}
            {userErrors.branchIds?.message && (
              <p className="field-error" role="alert">{userErrors.branchIds.message}</p>
            )}
          </div>

          {selectedBranchIds.length > 0 && (
            <Select
              label="Sucursal por defecto"
              options={activeBranches
                .filter((b) => selectedBranchIds.includes(b.id))
                .map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
              error={userErrors.defaultBranchId?.message}
              {...regUser('defaultBranchId')}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUserMutation.mutate(deleteUser!.id)}
        title="Eliminar Usuario"
        message={`¿Eliminar al usuario "${deleteUser?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        loading={deleteUserMutation.isPending}
      />
    </div>
  )
}
