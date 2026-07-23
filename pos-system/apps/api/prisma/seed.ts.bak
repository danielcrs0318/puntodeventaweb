import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed de base de datos...')

  // Permisos
  const permissions = [
    'sales:create', 'sales:read', 'sales:void',
    'products:create', 'products:read', 'products:update', 'products:delete',
    'inventory:read', 'inventory:adjust',
    'customers:create', 'customers:read', 'customers:update',
    'suppliers:read', 'suppliers:create', 'purchases:create',
    'reports:read', 'cash-register:manage',
    'settings:read', 'settings:update',
    'users:manage', 'fiscal:manage',
  ]

  for (const action of permissions) {
    await prisma.permission.upsert({
      where: { action },
      create: { action, description: action.replace(':', ' ').replace('-', ' ') },
      update: {},
    })
  }
  console.log(`✓ ${permissions.length} permisos creados`)

  // Roles
  const allPermIds = await prisma.permission.findMany({ select: { id: true } })
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    create: { name: 'admin', description: 'Administrador del sistema' },
    update: {},
  })
  // Admin tiene todos los permisos
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
  const supervisorPerms = ['sales:create', 'sales:read', 'sales:void', 'products:read', 'products:update', 'inventory:read', 'inventory:adjust', 'customers:create', 'customers:read', 'customers:update', 'reports:read', 'cash-register:manage', 'settings:read', 'suppliers:read', 'purchases:create']
  for (const action of supervisorPerms) {
    const perm = await prisma.permission.findUnique({ where: { action } })
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: supervisorRole.id, permissionId: perm.id } },
        create: { roleId: supervisorRole.id, permissionId: perm.id },
        update: {},
      })
    }
  }

  const cajeroRole = await prisma.role.upsert({
    where: { name: 'cajero' },
    create: { name: 'cajero', description: 'Cajero de punto de venta' },
    update: {},
  })
  const cajeroPerms = ['sales:create', 'sales:read', 'products:read', 'customers:read', 'cash-register:manage']
  for (const action of cajeroPerms) {
    const perm = await prisma.permission.findUnique({ where: { action } })
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: cajeroRole.id, permissionId: perm.id } },
        create: { roleId: cajeroRole.id, permissionId: perm.id },
        update: {},
      })
    }
  }

  const inventarioRole = await prisma.role.upsert({
    where: { name: 'inventario' },
    create: { name: 'inventario', description: 'Encargado de inventario' },
    update: {},
  })
  const inventarioPerms = ['products:create', 'products:read', 'products:update', 'inventory:read', 'inventory:adjust', 'suppliers:read', 'suppliers:create', 'purchases:create']
  for (const action of inventarioPerms) {
    const perm = await prisma.permission.findUnique({ where: { action } })
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: inventarioRole.id, permissionId: perm.id } },
        create: { roleId: inventarioRole.id, permissionId: perm.id },
        update: {},
      })
    }
  }
  console.log('✓ Roles creados: admin, supervisor, cajero, inventario')

  // Usuario administrador por defecto
  const passwordHash = await bcrypt.hash('Admin1234!', 12)
  await prisma.user.upsert({
    where: { email: 'admin@pos.hn' },
    create: {
      name: 'Administrador',
      email: 'admin@pos.hn',
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
    update: { passwordHash, roleId: adminRole.id },
  })
  console.log('✓ Usuario admin creado: admin@pos.hn / Admin1234!')

  // Configuración inicial
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      businessName: 'Mi Negocio Honduras',
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
  console.log('✓ Configuración inicial creada')

  // Categorías de ejemplo
  const categories = ['Abarrotes', 'Bebidas', 'Lácteos', 'Carnes', 'Frutas y Verduras', 'Limpieza', 'Higiene Personal', 'Electrónica', 'Varios']
  for (const name of categories) {
    const exists = await prisma.category.findFirst({ where: { name } })
    if (!exists) {
      await prisma.category.create({ data: { name } })
    }
  }
  console.log(`✓ ${categories.length} categorías creadas`)

  // Productos de ejemplo
  const abarrotesCat = await prisma.category.findFirst({ where: { name: 'Abarrotes' } })
  const bebCat = await prisma.category.findFirst({ where: { name: 'Bebidas' } })

  const sampleProducts = [
    { sku: 'ARR-001', name: 'Arroz Blanquita 1kg', costPrice: 25, salePrice: 32, barcode: '7423490100012', categoryId: abarrotesCat?.id, stock: 100 },
    { sku: 'FRJ-001', name: 'Frijoles Rojos 1lb', costPrice: 18, salePrice: 24, barcode: '7423490100013', categoryId: abarrotesCat?.id, stock: 80 },
    { sku: 'AZU-001', name: 'Azúcar Cristal 1lb', costPrice: 12, salePrice: 16, barcode: '7423490100014', categoryId: abarrotesCat?.id, stock: 120 },
    { sku: 'AGU-001', name: 'Agua Pura 600ml', costPrice: 8, salePrice: 12, barcode: '7423490100015', categoryId: bebCat?.id, stock: 200 },
    { sku: 'COK-001', name: 'Coca-Cola 600ml', costPrice: 14, salePrice: 20, barcode: '7423490100016', categoryId: bebCat?.id, stock: 150 },
  ]

  for (const p of sampleProducts) {
    const { stock, ...productData } = p
    const existingProduct = await prisma.product.findFirst({ where: { sku: productData.sku } })
    if (!existingProduct) {
      const product = await prisma.product.create({
        data: { ...productData, taxRate: 0.15, unitType: 'UNIDAD' },
      })
      await prisma.inventory.create({
        data: { productId: product.id, quantity: stock, minStockAlert: 10 },
      })
    }
  }
  console.log(`✓ ${sampleProducts.length} productos de ejemplo creados`)

  // Proveedor de ejemplo
  await prisma.supplier.upsert({
    where: { id: 1 },
    create: {
      name: 'Distribuidora Central',
      contactName: 'Juan Pérez',
      phone: '2222-3333',
      email: 'ventas@distribcentral.hn',
    },
    update: {},
  }).catch(async () => {
    // If upsert by id fails because id doesn't exist, fallback to find/create by name
    const s = await prisma.supplier.findFirst({ where: { name: 'Distribuidora Central' } })
    if (!s) {
      await prisma.supplier.create({ data: {
        name: 'Distribuidora Central', contactName: 'Juan Pérez', phone: '2222-3333', email: 'ventas@distribcentral.hn',
      } })
    }
  })
  console.log('✓ Proveedor de ejemplo creado')

  console.log('\n✅ Seed completado exitosamente')
  console.log('   Acceso: admin@pos.hn / Admin1234!')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error('Error en seed:', e); prisma.$disconnect(); process.exit(1) })
