/**
 * Bootstrap de producción: sucursal, permisos, roles, settings y usuario admin.
 * NO crea categorías, productos ni proveedores de ejemplo.
 *
 * Uso (con DATABASE_URL de Aiven en el entorno):
 *   npm run prisma:seed:prod
 *
 * Variables opcionales:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, BUSINESS_NAME
 */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const PERMISSIONS = [
  'sales:create', 'sales:read', 'sales:void',
  'products:create', 'products:read', 'products:update', 'products:delete',
  'inventory:read', 'inventory:adjust',
  'customers:create', 'customers:read', 'customers:update',
  'suppliers:read', 'suppliers:create', 'purchases:create',
  'reports:read', 'cash-register:manage',
  'settings:read', 'settings:update',
  'users:manage', 'fiscal:manage',
]

const SUPERVISOR_PERMS = [
  'sales:create', 'sales:read', 'sales:void', 'products:read', 'products:update',
  'inventory:read', 'inventory:adjust', 'customers:create', 'customers:read',
  'customers:update', 'reports:read', 'cash-register:manage', 'settings:read',
  'suppliers:read', 'purchases:create',
]

const CAJERO_PERMS = [
  'sales:create', 'sales:read', 'products:read', 'customers:read', 'cash-register:manage',
]

const INVENTARIO_PERMS = [
  'products:create', 'products:read', 'products:update', 'inventory:read',
  'inventory:adjust', 'suppliers:read', 'suppliers:create', 'purchases:create',
]

async function assignPerms(roleId: number, actions: string[]) {
  for (const action of actions) {
    const perm = await prisma.permission.findUnique({ where: { action } })
    if (!perm) continue
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: perm.id } },
      create: { roleId, permissionId: perm.id },
      update: {},
    })
  }
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@pos.hn').trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD ?? ''
  const adminName = (process.env.ADMIN_NAME ?? 'Administrador').trim()
  const businessName = (process.env.BUSINESS_NAME ?? 'Mi Negocio Honduras').trim()

  if (!adminPassword || adminPassword.length < 10) {
    throw new Error(
      'ADMIN_PASSWORD es obligatorio para seed de producción (mín. 10 caracteres).\n' +
        'Ejemplo (PowerShell): $env:ADMIN_PASSWORD="TuClaveSegura!"; npm run prisma:seed:prod',
    )
  }

  console.log('Bootstrap de producción (sin datos de ejemplo)...')

  const mainBranch = await prisma.branch.upsert({
    where: { code: 'MATRIZ' },
    create: {
      code: 'MATRIZ',
      name: 'Sucursal Matriz',
      isMain: true,
      isActive: true,
    },
    update: { isMain: true, isActive: true },
  })
  await prisma.documentSequence.upsert({
    where: { branchId_type: { branchId: mainBranch.id, type: 'RECIBO' } },
    create: { branchId: mainBranch.id, type: 'RECIBO', nextNumber: 1 },
    update: {},
  })
  console.log(`✓ Sucursal MATRIZ (id=${mainBranch.id})`)

  for (const action of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { action },
      create: { action, description: action.replace(':', ' ').replace('-', ' ') },
      update: {},
    })
  }
  console.log(`✓ ${PERMISSIONS.length} permisos`)

  const allPermIds = await prisma.permission.findMany({ select: { id: true } })
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    create: { name: 'admin', description: 'Administrador del sistema' },
    update: {},
  })
  for (const perm of allPermIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      create: { roleId: adminRole.id, permissionId: perm.id },
      update: {},
    })
  }

  const supervisorRole = await prisma.role.upsert({
    where: { name: 'supervisor' },
    create: { name: 'supervisor', description: 'Supervisor de tienda' },
    update: {},
  })
  await assignPerms(supervisorRole.id, SUPERVISOR_PERMS)

  const cajeroRole = await prisma.role.upsert({
    where: { name: 'cajero' },
    create: { name: 'cajero', description: 'Cajero de punto de venta' },
    update: {},
  })
  await assignPerms(cajeroRole.id, CAJERO_PERMS)

  const inventarioRole = await prisma.role.upsert({
    where: { name: 'inventario' },
    create: { name: 'inventario', description: 'Encargado de inventario' },
    update: {},
  })
  await assignPerms(inventarioRole.id, INVENTARIO_PERMS)
  console.log('✓ Roles: admin, supervisor, cajero, inventario')

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingAdmin) {
    console.log(`✓ Usuario admin ya existe (${adminEmail}) — no se modifica la contraseña`)
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: existingAdmin.id, branchId: mainBranch.id } },
      create: { userId: existingAdmin.id, branchId: mainBranch.id, isDefault: true },
      update: { isDefault: true },
    })
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    const adminUser = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
      },
    })
    await prisma.userBranch.create({
      data: { userId: adminUser.id, branchId: mainBranch.id, isDefault: true },
    })
    console.log(`✓ Usuario admin creado: ${adminEmail}`)
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      businessName,
      currency: 'HNL',
      currencySymbol: 'L.',
      taxRateDefault: 0.15,
      fiscalInvoicingEnabled: false,
      lowStockThreshold: 5,
      caiAlertThreshold: 50,
      caiDaysAlertThreshold: 15,
      invoiceFooterText: 'La factura es beneficio del cliente. Exíjala.',
    },
    update: {},
  })
  console.log('✓ Settings iniciales')

  console.log('\n✅ Bootstrap de producción listo (sin datos de ejemplo)')
  console.log(`   Login: ${adminEmail}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error en seed de producción:', e)
    prisma.$disconnect()
    process.exit(1)
  })
