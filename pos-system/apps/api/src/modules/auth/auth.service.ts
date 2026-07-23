import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
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
  ) {}

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
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
    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: { id: user.role.id, name: user.role.name, permissions },
      },
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
    const user = await this.prisma.user.findUnique({ where: { email } })
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

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`

    try {
      const mailResult = await this.mailService.sendPasswordReset(user.email, user.name, resetUrl)
      if (!mailResult.sent) {
        this.logger.log(
          `[password-reset] Resend off — userId=${user.id} email=${email} resetUrl=${resetUrl}`,
        )
      }
    } catch (err: unknown) {
      this.logger.error(
        `Error enviando correo de recuperación a ${email}`,
        err instanceof Error ? err.stack : String(err),
      )
      // En desarrollo sin Resend seguimos devolviendo el enlace
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
        details: { email, mailConfigured: this.mailService.isConfigured() },
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
    const hashedToken = this.hashResetToken(token)
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
    })

    // Compatibilidad con tokens en texto plano generados antes del hash
    const legacyUser =
      user ??
      (await this.prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
          isActive: true,
        },
      }))

    if (!legacyUser) {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado')
    }
    const targetUser = legacyUser

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({
      where: { id: targetUser.id },
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
        userId: targetUser.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'User',
        entityId: targetUser.id,
        details: {},
      },
    })

    return { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' }
  }
}
