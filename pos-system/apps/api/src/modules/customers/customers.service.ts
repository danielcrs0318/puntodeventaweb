import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit
    const where: any = { isActive: true }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { identificationNumber: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.customer.count({ where }),
    ])
    return { data, total, page, limit }
  }

  search(q: string, limit = 10) {
    return this.prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { identificationNumber: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: number) {
    const c = await this.prisma.customer.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Cliente no encontrado')
    return c
  }

  async getSales(id: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    await this.findOne(id)
    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where: { customerId: id },
        include: { items: true, payments: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where: { customerId: id } }),
    ])
    return { data, total }
  }

  create(data: {
    name: string; identificationNumber?: string; phone?: string
    email?: string; address?: string; creditLimit?: number
  }) {
    return this.prisma.customer.create({ data })
  }

  async update(id: number, data: {
    name?: string; identificationNumber?: string; phone?: string
    email?: string; address?: string; creditLimit?: number; isActive?: boolean
  }) {
    await this.findOne(id)
    return this.prisma.customer.update({ where: { id }, data })
  }

  remove(id: number) {
    return this.prisma.customer.update({ where: { id }, data: { isActive: false } })
  }
}
