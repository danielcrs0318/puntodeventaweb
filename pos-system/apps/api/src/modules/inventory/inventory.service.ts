import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  getStock(branchId: number) {
    return this.prisma.inventory.findMany({
      where: { branchId },
      include: { product: { include: { category: true } }, branch: true },
      orderBy: { product: { name: 'asc' } },
    })
  }

  async getMovements(branchId: number, page = 1, limit = 30, productId?: number) {
    const skip = (page - 1) * limit
    const where: Prisma.InventoryMovementWhereInput = {
      branchId,
      ...(productId ? { productId } : {}),
    }
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

  async ensureInventoryRow(
    productId: number,
    branchId: number,
    tx?: Prisma.TransactionClient,
    minStockAlert = 5,
  ) {
    const db = tx ?? this.prisma
    return db.inventory.upsert({
      where: { productId_branchId: { productId, branchId } },
      create: { productId, branchId, quantity: 0, minStockAlert },
      update: {},
    })
  }

  async adjust(productId: number, branchId: number, quantity: number, reason: string, userId: number) {
    await this.ensureInventoryRow(productId, branchId)

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ quantity: any }>>`
        SELECT quantity FROM inventory
        WHERE product_id = ${productId} AND branch_id = ${branchId}
        FOR UPDATE
      `
      if (!rows.length) throw new NotFoundException('Producto sin registro de inventario en esta sucursal')
      const previousQuantity = Number(rows[0].quantity)
      const delta = quantity - previousQuantity

      await tx.inventory.update({
        where: { productId_branchId: { productId, branchId } },
        data: { quantity },
      })
      await tx.inventoryMovement.create({
        data: {
          productId,
          branchId,
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
          details: { previousQuantity, newQuantity: quantity, reason, branchId },
        },
      })
    })
  }

  async decreaseStock(
    productId: number,
    branchId: number,
    quantity: number,
    userId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma
    await this.ensureInventoryRow(productId, branchId, db)

    // Decremento atómico para concurrencia (varias cajas a la vez)
    const result = await db.$executeRaw`
      UPDATE inventory
      SET quantity = quantity - ${quantity}
      WHERE product_id = ${productId}
        AND branch_id = ${branchId}
        AND quantity >= ${quantity}
    `
    if (Number(result) === 0) {
      throw new BadRequestException(`Stock insuficiente para el producto ${productId} en esta sucursal`)
    }

    const inv = await db.inventory.findUnique({
      where: { productId_branchId: { productId, branchId } },
    })
    await db.inventoryMovement.create({
      data: {
        productId,
        branchId,
        userId,
        type: 'VENTA',
        quantity,
        reason: 'Venta',
      },
    })
    return Number(inv?.quantity ?? 0)
  }

  async increaseStock(
    productId: number,
    branchId: number,
    quantity: number,
    userId: number,
    type: 'ENTRADA' | 'DEVOLUCION' | 'COMPRA' = 'ENTRADA',
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma
    await this.ensureInventoryRow(productId, branchId, db)
    await db.$executeRaw`
      UPDATE inventory
      SET quantity = quantity + ${quantity}
      WHERE product_id = ${productId} AND branch_id = ${branchId}
    `
    const inv = await db.inventory.findUnique({
      where: { productId_branchId: { productId, branchId } },
    })
    await db.inventoryMovement.create({
      data: {
        productId,
        branchId,
        userId,
        type,
        quantity,
        reason: type === 'COMPRA' ? 'Compra a proveedor' : type === 'DEVOLUCION' ? 'Devolución' : 'Entrada manual',
      },
    })
    return Number(inv?.quantity ?? 0)
  }
}
