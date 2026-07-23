import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: number) {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { role: true } })
    if (!u) throw new NotFoundException('Usuario no encontrado')
    return u
  }

  async create(data: { name: string; email: string; password: string; roleId: number }) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } })
    if (exists) throw new ConflictException('El correo ya está registrado')
    const passwordHash = await bcrypt.hash(data.password, 12)
    return this.prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, roleId: data.roleId },
      include: { role: true },
    })
  }

  async update(id: number, data: { name?: string; email?: string; password?: string; roleId?: number; isActive?: boolean }) {
    const { password, ...rest } = data
    const updateData: Record<string, unknown> = { ...rest }
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12)
    return this.prisma.user.update({ where: { id }, data: updateData, include: { role: true } })
  }

  remove(id: number) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } })
  }
}
