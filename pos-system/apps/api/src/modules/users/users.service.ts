import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import * as bcrypt from 'bcrypt'
import { randomInt } from 'crypto'

type CreateUserPayload = {
  name: string
  email: string
  passwordHash: string
  roleId: number
  branchIds: number[]
  defaultBranchId: number
}

const PIN_TTL_MS = 15 * 60_000
const PIN_MAX_ATTEMPTS = 5

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

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

  private async resolveBranches(branchIds?: number[], defaultBranchId?: number) {
    const mainBranch = await this.prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: [{ isMain: 'desc' }, { id: 'asc' }],
    })
    const ids = branchIds?.length
      ? branchIds
      : mainBranch
        ? [mainBranch.id]
        : []
    if (!ids.length) {
      throw new ConflictException('No hay sucursales activas para asignar al usuario')
    }
    const uniqueIds = [...new Set(ids)]
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
    })
    if (branches.length !== uniqueIds.length) {
      throw new ConflictException('Una o más sucursales no existen o están inactivas')
    }
    const defaultId =
      defaultBranchId && uniqueIds.includes(defaultBranchId)
        ? defaultBranchId
        : uniqueIds[0]
    return { branchIds: uniqueIds, defaultBranchId: defaultId }
  }

  /** Paso 1: envía PIN al correo del nuevo usuario; el admin lo confirma para crear. */
  async sendCreatePin(
    data: {
      name: string
      email: string
      password: string
      roleId: number
      branchIds?: number[]
      defaultBranchId?: number
    },
    admin?: { id: number; name?: string; email?: string },
  ) {
    const email = this.normalizeEmail(data.email)
    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) throw new ConflictException('El correo ya está registrado')

    const role = await this.prisma.role.findUnique({ where: { id: data.roleId } })
    if (!role) throw new BadRequestException('Rol inválido')

    const { branchIds, defaultBranchId } = await this.resolveBranches(
      data.branchIds,
      data.defaultBranchId,
    )

    const pin = String(randomInt(100000, 999999))
    const pinHash = await bcrypt.hash(pin, 10)
    const passwordHash = await bcrypt.hash(data.password, 12)
    const payload: CreateUserPayload = {
      name: data.name.trim(),
      email,
      passwordHash,
      roleId: data.roleId,
      branchIds,
      defaultBranchId,
    }

    await this.prisma.pendingUserCreation.upsert({
      where: { email },
      create: {
        email,
        pinHash,
        payload: payload as object,
        expiresAt: new Date(Date.now() + PIN_TTL_MS),
        attempts: 0,
      },
      update: {
        pinHash,
        payload: payload as object,
        expiresAt: new Date(Date.now() + PIN_TTL_MS),
        attempts: 0,
      },
    })

    const settings = await this.prisma.settings.findFirst()
    const businessName = settings?.businessName ?? 'POS Honduras'

    try {
      const mailResult = await this.mail.sendUserCreatePin({
        to: email,
        userName: payload.name,
        userEmail: email,
        pin,
        businessName,
        adminName: admin?.name,
        expiresMinutes: 15,
      })
      if (!mailResult.sent) {
        this.logger.log(`[user-create-pin] Resend off — email=${email} pin=${pin}`)
      }
    } catch (err: unknown) {
      this.logger.error(
        `Error enviando PIN de creación a ${email}`,
        err instanceof Error ? err.stack : String(err),
      )
      if (process.env.NODE_ENV === 'production' && this.mail.isConfigured()) {
        throw new BadRequestException('No se pudo enviar el PIN por correo. Intenta más tarde.')
      }
    }

    if (admin?.id) {
      await this.prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'USER_CREATE_PIN_SENT',
          entity: 'User',
          details: { email, mailConfigured: this.mail.isConfigured() },
        },
      })
    }

    return {
      message: `Se envió un PIN de verificación a ${email}. Ingrésalo para completar la creación.`,
      email,
      expiresInMinutes: 15,
      ...(process.env.NODE_ENV !== 'production' && !this.mail.isConfigured()
        ? { pin }
        : {}),
    }
  }

  async create(
    data: {
      name: string
      email: string
      password: string
      roleId: number
      branchIds?: number[]
      defaultBranchId?: number
      pin: string
    },
    admin?: { id: number },
  ) {
    const email = this.normalizeEmail(data.email)
    const pin = String(data.pin ?? '').trim()
    if (!/^\d{6}$/.test(pin)) {
      throw new BadRequestException('El PIN debe ser de 6 dígitos')
    }

    const pending = await this.prisma.pendingUserCreation.findUnique({ where: { email } })
    if (!pending || pending.expiresAt < new Date()) {
      if (pending) await this.prisma.pendingUserCreation.delete({ where: { email } }).catch(() => undefined)
      throw new BadRequestException('El PIN expiró o no se solicitó. Envía uno nuevo.')
    }

    if (pending.attempts >= PIN_MAX_ATTEMPTS) {
      await this.prisma.pendingUserCreation.delete({ where: { email } })
      throw new BadRequestException('Demasiados intentos fallidos. Solicita un nuevo PIN.')
    }

    const pinOk = await bcrypt.compare(pin, pending.pinHash)
    if (!pinOk) {
      await this.prisma.pendingUserCreation.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      })
      throw new BadRequestException('PIN incorrecto')
    }

    const payload = pending.payload as unknown as CreateUserPayload
    const passwordMatches = await bcrypt.compare(data.password, payload.passwordHash)
    if (!passwordMatches || payload.email !== email || payload.roleId !== data.roleId) {
      throw new BadRequestException(
        'Los datos no coinciden con la solicitud del PIN. Vuelve a enviar el PIN.',
      )
    }

    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) {
      await this.prisma.pendingUserCreation.delete({ where: { email } })
      throw new ConflictException('El correo ya está registrado')
    }

    const { branchIds, defaultBranchId } = await this.resolveBranches(
      data.branchIds?.length ? data.branchIds : payload.branchIds,
      data.defaultBranchId ?? payload.defaultBranchId,
    )

    const userId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name.trim() || payload.name,
          email,
          passwordHash: payload.passwordHash,
          roleId: payload.roleId,
        },
      })
      await tx.userBranch.createMany({
        data: branchIds.map((branchId) => ({
          userId: user.id,
          branchId,
          isDefault: branchId === defaultBranchId,
        })),
      })
      await tx.pendingUserCreation.delete({ where: { email } })
      return user.id
    })

    if (admin?.id) {
      await this.prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: userId,
          details: { email },
        },
      })
    }

    return this.findOne(userId)
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

    const { password, branchIds, defaultBranchId, email, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12)
    if (email) updateData.email = this.normalizeEmail(email)

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: updateData })

      if (branchIds?.length) {
        const { branchIds: uniqueIds, defaultBranchId: defaultId } = await this.resolveBranches(
          branchIds,
          defaultBranchId,
        )
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
