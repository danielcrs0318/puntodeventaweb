import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, search?: string, active?: boolean) {
    const skip = (page - 1) * limit
    const where: any = {}
    if (active !== undefined) where.isActive = active
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { role: { name: { contains: search } } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          role: true,
          branches: {
            include: { branch: { select: { id: true, code: true, name: true, isActive: true } } },
            orderBy: [{ isDefault: 'desc' }, { branchId: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async findOne(id: number) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        branches: {
          include: { branch: { select: { id: true, code: true, name: true, isActive: true } } },
        },
      },
    })
    if (!u) throw new NotFoundException('Usuario no encontrado')
    return u
  }

  async create(data: {
    name: string
    email: string
    password: string
    roleId: number
    branchIds?: number[]
    defaultBranchId?: number
  }) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } })
    if (exists) throw new ConflictException('El correo ya está registrado')
    const passwordHash = await bcrypt.hash(data.password, 12)

    const mainBranch = await this.prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: [{ isMain: 'desc' }, { id: 'asc' }],
    })
    const branchIds = data.branchIds?.length
      ? data.branchIds
      : mainBranch
        ? [mainBranch.id]
        : []
    if (!branchIds.length) {
      throw new ConflictException('No hay sucursales activas para asignar al usuario')
    }
    const defaultBranchId =
      data.defaultBranchId && branchIds.includes(data.defaultBranchId)
        ? data.defaultBranchId
        : branchIds[0]

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          roleId: data.roleId,
        },
      })
      await tx.userBranch.createMany({
        data: branchIds.map((branchId) => ({
          userId: user.id,
          branchId,
          isDefault: branchId === defaultBranchId,
        })),
      })
      return user.id
    }).then((userId) => this.findOne(userId))
  }

  async update(
    id: number,
    data: {
      name?: string
      email?: string
      password?: string
      roleId?: number
      isActive?: boolean
      branchIds?: number[]
      defaultBranchId?: number
    },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Usuario no encontrado')

    const { password, branchIds, defaultBranchId, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12)

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: updateData })

      if (branchIds?.length) {
        const uniqueIds = [...new Set(branchIds)]
        const branches = await tx.branch.findMany({
          where: { id: { in: uniqueIds }, isActive: true },
        })
        if (branches.length !== uniqueIds.length) {
          throw new ConflictException('Una o más sucursales no existen o están inactivas')
        }
        const defaultId =
          defaultBranchId && uniqueIds.includes(defaultBranchId)
            ? defaultBranchId
            : uniqueIds[0]
        await tx.userBranch.deleteMany({ where: { userId: id } })
        await tx.userBranch.createMany({
          data: uniqueIds.map((branchId) => ({
            userId: id,
            branchId,
            isDefault: branchId === defaultId,
          })),
        })
      }
    })

    return this.findOne(id)
  }

  remove(id: number) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } })
  }
}
