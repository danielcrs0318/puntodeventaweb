import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Resuelve la sucursal activa desde el header X-Branch-Id (o query branchId).
 * Valida que el usuario tenga acceso (admin = todas las activas).
 */
@Injectable()
export class BranchInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest()
    const user = req.user as { id: number; role?: { name: string } } | undefined

    if (!user?.id) {
      return next.handle()
    }

    const raw =
      req.headers['x-branch-id'] ??
      req.headers['X-Branch-Id'] ??
      req.query?.branchId

    if (raw === undefined || raw === null || raw === '') {
      // Endpoints públicos de auth ya pasaron sin user; con user sin header: sucursal por defecto
      const defaultBranch = await this.resolveDefaultBranch(user.id, user.role?.name)
      if (defaultBranch) {
        req.branchId = defaultBranch.id
        req.branch = defaultBranch
      }
      return next.handle()
    }

    const branchId = Number(raw)
    if (!Number.isFinite(branchId) || branchId <= 0) {
      throw new BadRequestException('X-Branch-Id inválido')
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
    })
    if (!branch) {
      throw new BadRequestException('Sucursal no encontrada o inactiva')
    }

    const isAdmin = user.role?.name === 'admin'
    if (!isAdmin) {
      const membership = await this.prisma.userBranch.findUnique({
        where: { userId_branchId: { userId: user.id, branchId } },
      })
      if (!membership) {
        throw new ForbiddenException('No tienes acceso a esta sucursal')
      }
    }

    req.branchId = branch.id
    req.branch = branch
    return next.handle()
  }

  private async resolveDefaultBranch(userId: number, roleName?: string) {
    if (roleName === 'admin') {
      return this.prisma.branch.findFirst({
        where: { isActive: true },
        orderBy: [{ isMain: 'desc' }, { id: 'asc' }],
      })
    }
    const link = await this.prisma.userBranch.findFirst({
      where: { userId, branch: { isActive: true } },
      include: { branch: true },
      orderBy: [{ isDefault: 'desc' }, { branchId: 'asc' }],
    })
    return link?.branch ?? null
  }
}
