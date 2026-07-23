import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    page?: number
    limit?: number
    action?: string
    entity?: string
    userId?: number
    from?: string
    to?: string
  }) {
    const { page = 1, limit = 30, action, entity, userId, from, to } = filters
    const skip = (page - 1) * limit
    const where: Prisma.AuditLogWhereInput = {}

    if (action) where.action = { contains: action }
    if (entity) where.entity = entity
    if (userId) where.userId = userId
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return { data, total, page, limit }
  }
}
