import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface UserBranchView {
  id: number
  code: string
  name: string
  isMain: boolean
  isDefault: boolean
}

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  findAll(activeOnly = false) {
    return this.prisma.branch.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { users: true } },
      },
    })
  }

  async findOne(id: number) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        users: {
          include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
        },
      },
    })
    if (!branch) throw new NotFoundException('Sucursal no encontrada')
    return branch
  }

  async create(data: {
    code: string
    name: string
    address?: string
    phone?: string
    email?: string
    isMain?: boolean
  }) {
    const code = data.code.trim().toUpperCase()
    const exists = await this.prisma.branch.findUnique({ where: { code } })
    if (exists) throw new BadRequestException('Ya existe una sucursal con ese código')

    return this.prisma.$transaction(async (tx) => {
      if (data.isMain) {
        await tx.branch.updateMany({ data: { isMain: false } })
      }
      const branch = await tx.branch.create({
        data: {
          code,
          name: data.name.trim(),
          address: data.address,
          phone: data.phone,
          email: data.email,
          isMain: data.isMain ?? false,
        },
      })
      await tx.documentSequence.create({
        data: { branchId: branch.id, type: 'RECIBO', nextNumber: 1 },
      })

      // Crear filas de inventario en 0 para productos existentes
      const products = await tx.product.findMany({ select: { id: true } })
      if (products.length) {
        await tx.inventory.createMany({
          data: products.map((p) => ({
            productId: p.id,
            branchId: branch.id,
            quantity: 0,
            minStockAlert: 5,
          })),
          skipDuplicates: true,
        })
      }
      return branch
    })
  }

  async update(
    id: number,
    data: {
      code?: string
      name?: string
      address?: string
      phone?: string
      email?: string
      isActive?: boolean
      isMain?: boolean
    },
  ) {
    await this.findOne(id)
    return this.prisma.$transaction(async (tx) => {
      if (data.isMain) {
        await tx.branch.updateMany({ data: { isMain: false } })
      }
      return tx.branch.update({
        where: { id },
        data: {
          ...(data.code !== undefined ? { code: data.code.trim().toUpperCase() } : {}),
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.isMain !== undefined ? { isMain: data.isMain } : {}),
        },
      })
    })
  }

  async setUserBranches(userId: number, branchIds: number[], defaultBranchId?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    const uniqueIds = [...new Set(branchIds)]
    if (!uniqueIds.length) {
      throw new BadRequestException('El usuario debe tener al menos una sucursal')
    }

    const branches = await this.prisma.branch.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
    })
    if (branches.length !== uniqueIds.length) {
      throw new BadRequestException('Una o más sucursales no existen o están inactivas')
    }

    const defaultId = defaultBranchId && uniqueIds.includes(defaultBranchId)
      ? defaultBranchId
      : uniqueIds[0]

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranch.deleteMany({ where: { userId } })
      await tx.userBranch.createMany({
        data: uniqueIds.map((branchId) => ({
          userId,
          branchId,
          isDefault: branchId === defaultId,
        })),
      })
    })

    return this.getUserBranches(userId)
  }

  /**
   * Sucursales visibles para un usuario, con autoreparación:
   * admin = todas las activas; un usuario sin ninguna asignación recibe la matriz
   * (sin asignación no puede operar en ningún módulo).
   * Si tiene asignaciones pero todas están inactivas, no se reasigna nada.
   */
  async resolveUserBranches(userId: number, roleName?: string): Promise<UserBranchView[]> {
    if (roleName === 'admin') {
      const all = await this.prisma.branch.findMany({
        where: { isActive: true },
        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      })
      return all.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        isMain: b.isMain,
        isDefault: b.isMain,
      }))
    }

    const links = await this.prisma.userBranch.findMany({
      where: { userId, branch: { isActive: true } },
      include: { branch: true },
      orderBy: [{ isDefault: 'desc' }, { branchId: 'asc' }],
    })
    if (links.length) {
      return links.map((l) => ({
        id: l.branch.id,
        code: l.branch.code,
        name: l.branch.name,
        isMain: l.branch.isMain,
        isDefault: l.isDefault,
      }))
    }

    const hasAnyLink = await this.prisma.userBranch.count({ where: { userId } })
    if (hasAnyLink > 0) return []

    const fallback = await this.prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: [{ isMain: 'desc' }, { id: 'asc' }],
    })
    if (!fallback) return []

    await this.prisma.userBranch.upsert({
      where: { userId_branchId: { userId, branchId: fallback.id } },
      create: { userId, branchId: fallback.id, isDefault: true },
      update: { isDefault: true },
    })

    return [
      {
        id: fallback.id,
        code: fallback.code,
        name: fallback.name,
        isMain: fallback.isMain,
        isDefault: true,
      },
    ]
  }

  async getUserBranches(userId: number) {
    const links = await this.prisma.userBranch.findMany({
      where: { userId, branch: { isActive: true } },
      include: { branch: true },
      orderBy: [{ isDefault: 'desc' }, { branchId: 'asc' }],
    })
    return links.map((l) => ({
      ...l.branch,
      isDefault: l.isDefault,
    }))
  }

  async assertUserCanAccess(userId: number, branchId: number, roleName: string) {
    if (roleName === 'admin') {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, isActive: true } })
      if (!branch) throw new ForbiddenException('Sucursal no disponible')
      return branch
    }
    const link = await this.prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
      include: { branch: true },
    })
    if (!link || !link.branch.isActive) {
      throw new ForbiddenException('No tienes acceso a esta sucursal')
    }
    return link.branch
  }

  /** Asigna el siguiente correlativo de recibo de forma atómica por sucursal */
  async nextReceiptNumber(branchId: number, tx: { documentSequence: any }) {
    const seq = await tx.documentSequence.upsert({
      where: { branchId_type: { branchId, type: 'RECIBO' } },
      create: { branchId, type: 'RECIBO', nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    })
    // upsert create starts at 2 after first use; for create path nextNumber becomes 2 meaning we used 1
    const used = seq.nextNumber - 1
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } })
    const code = (branch?.code ?? 'SUC').replace(/[^A-Z0-9]/gi, '').slice(0, 6) || 'SUC'
    return `${code}-REC-${String(used).padStart(8, '0')}`
  }
}
