import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { BranchesService } from '../branches/branches.service'
import * as bcrypt from 'bcrypt'
import { createHash, randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
    private branchesService: BranchesService,
  ) {}

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  private frontendBaseUrl() {
    return (this.config.get<string>('FRONTEND_URL', 'http://localhost:3000') || 'http://localhost:3000')
      .trim()
      .replace(/\/$/, '')
  }

  async validateUser(email: string, password: string) {
    const normalized = this.normalizeEmail(email)
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    })
    if (!user) throw new UnauthorizedException('Credenciales incorrectas')
    if (!user.isActive) throw new ForbiddenException('Cuenta desactivada')
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Cuenta bloqueada temporalmente. Intenta en 15 minutos.')
    }
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1
      const lockData = attempts >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60_000) } : {}
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, ...lockData } })
      throw new UnauthorizedException('Credenciales incorrectas')
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } })
    return user
  }

  async login(user: any) {
    const permissions = user.role.permissions.map((rp: any) => rp.permission.action)
    const payload = { sub: user.id, email: user.email, role: user.role.name }
    const accessToken = this.jwtService.sign(payload)
    const rawRefresh = uuidv4()
    const hashedRefresh = await bcrypt.hash(rawRefresh, 10)
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshToken: hashedRefresh } })
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, details: {} },
    })

    const branches = await this.branchesService.resolveUserBranches(user.id, user.role.name)
    const activeBranch = branches.find((b) => b.isDefault) ?? branches[0] ?? null

    if (!activeBranch) {
      this.logger.warn(
        `Usuario ${user.email} inició sesión sin sucursal activa asignada (rol ${user.role.name})`,
      )
    }

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: { id: user.role.id, name: user.role.name, permissions },
      },
      branches,
      activeBranch,
    }
  }

  async refresh(rawRefreshToken: string) {
    const users = await this.prisma.user.findMany({
      where: { refreshToken: { not: null }, isActive: true },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    })
    for (const user of users) {
      if (user.refreshToken && (await bcrypt.compare(rawRefreshToken, user.refreshToken))) {
        return this.login(user)
      }
    }
    throw new UnauthorizedException('Refresh token inválido o expirado')
  }

  async logout(userId: number) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } })
    await this.prisma.auditLog.create({
      data: { userId, action: 'LOGOUT', entity: 'User', entityId: userId, details: {} },
    })
  }

  async forgotPassword(email: string) {
    const genericMessage =
      'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.'
    const normalized = this.normalizeEmail(email)
    const user = await this.prisma.user.findUnique({ where: { email: normalized } })
    if (!user || !user.isActive) {
      return { message: genericMessage }
    }

    const token = randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000)

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: this.hashResetToken(token),
        passwordResetExpires: expires,
      },
    })

    const resetUrl = `${this.frontendBaseUrl()}/reset-password?token=${token}`

    try {
      const settings = await this.prisma.settings.findFirst()
      const mailResult = await this.mailService.sendPasswordReset(
        user.email,
        user.name,
        resetUrl,
        settings?.businessName ?? 'POS Honduras',
      )
      if (!mailResult.sent) {
        this.logger.log(
          `[password-reset] Resend off — userId=${user.id} email=${normalized} resetUrl=${resetUrl}`,
        )
      }
    } catch (err: unknown) {
      this.logger.error(
        `Error enviando correo de recuperación a ${normalized}`,
        err instanceof Error ? err.stack : String(err),
      )
      if (process.env.NODE_ENV === 'production' && this.mailService.isConfigured()) {
        throw new BadRequestException('No se pudo enviar el correo de recuperación. Intenta más tarde.')
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: user.id,
        details: { email: normalized, mailConfigured: this.mailService.isConfigured() },
      },
    })

    return {
      message: genericMessage,
      ...(process.env.NODE_ENV !== 'production' && !this.mailService.isConfigured()
        ? { resetUrl }
        : {}),
    }
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token?.trim()) {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado')
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres')
    }

    const hashedToken = this.hashResetToken(token.trim())
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
    })

    const legacyUser =
      user ??
      (await this.prisma.user.findFirst({
        where: {
          passwordResetToken: token.trim(),
          passwordResetExpires: { gt: new Date() },
          isActive: true,
        },
      }))

    if (!legacyUser) {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado')
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({
      where: { id: legacyUser.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        refreshToken: null,
      },
    })

    await this.prisma.auditLog.create({
      data: {
        userId: legacyUser.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'User',
        entityId: legacyUser.id,
        details: {},
      },
    })

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' }
  }
}
