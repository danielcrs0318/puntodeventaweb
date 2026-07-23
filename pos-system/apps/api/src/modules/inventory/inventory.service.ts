import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  getStock() {
    return this.prisma.inventory.findMany({
      include: { product: { include: { category: true } } },
      orderBy: { product: { name: 'asc' } },
    })
  }

  async getMovements(page = 1, limit = 30, productId?: number) {
    const skip = (page - 1) * limit
    const where: Prisma.InventoryMovementWhereInput = productId ? { productId } : {}
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: { product: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async adjust(productId: number, quantity: number, reason: string, userId: number) {
    const inv = await this.prisma.inventory.findUnique({ where: { productId } })
    if (!inv) throw new NotFoundException('Producto sin registro de inventario')
    const previousQuantity = Number(inv.quantity)
    const delta = quantity - previousQuantity

    return this.prisma.$transaction(async (tx) => {
      await tx.inventory.update({ where: { productId }, data: { quantity } })
      await tx.inventoryMovement.create({
        data: {
          productId,
          userId,
          type: 'AJUSTE',
          quantity: Math.abs(delta),
          reason,
        },
      })
      await tx.auditLog.create({
        data: {
          userId,
          action: 'INVENTORY_ADJUST',
          entity: 'Inventory',
          entityId: productId,
          details: { previousQuantity, newQuantity: quantity, reason },
        },
      })
    })
  }

  async decreaseStock(
    productId: number,
    quantity: number,
    userId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma
    const inv = await db.inventory.findUnique({ where: { productId } })
    if (!inv) throw new NotFoundException(`Inventario no encontrado para producto ${productId}`)
    if (Number(inv.quantity) < quantity) {
      throw new BadRequestException(`Stock insuficiente para el producto ${productId}`)
    }
    const newStock = Number(inv.quantity) - quantity
    await db.inventory.update({ where: { productId }, data: { quantity: newStock } })
    await db.inventoryMovement.create({
      data: {
        productId,
        userId,
        type: 'VENTA',
        quantity,
        reason: 'Venta',
      },
    })
    return newStock
  }

  async increaseStock(
    productId: number,
    quantity: number,
    userId: number,
    type: 'ENTRADA' | 'DEVOLUCION' | 'COMPRA' = 'ENTRADA',
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma
    const inv = await db.inventory.findUnique({ where: { productId } })
    if (!inv) throw new NotFoundException(`Inventario no encontrado para producto ${productId}`)
    const newStock = Number(inv.quantity) + quantity
    await db.inventory.update({ where: { productId }, data: { quantity: newStock } })
    await db.inventoryMovement.create({
      data: {
        productId,
        userId,
        type,
        quantity,
        reason: type === 'COMPRA' ? 'Compra a proveedor' : 'Entrada manual',
      },
    })
    return newStock
  }
}
