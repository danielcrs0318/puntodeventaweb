import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(active?: boolean) {
    const where = active !== undefined ? { isActive: active } : {}
    const data = await this.prisma.category.findMany({ where, orderBy: { name: 'asc' } })
    return { data, total: data.length }
  }

  create(data: { name: string; description?: string }) {
    return this.prisma.category.create({ data })
  }

  async update(id: number, data: { name?: string; description?: string; isActive?: boolean }) {
    const cat = await this.prisma.category.findUnique({ where: { id } })
    if (!cat) throw new NotFoundException('Categoría no encontrada')
    return this.prisma.category.update({ where: { id }, data })
  }

  remove(id: number) {
    return this.prisma.category.update({ where: { id }, data: { isActive: false } })
  }
}
