import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getStock(
    branchId: number,
    page = 1,
    limit = 20,
    search?: string,
    stockStatus?: 'bajo' | 'agotado' | 'ok',
  ) {
    const skip = (page - 1) * limit
    const searchTerm = search?.trim() || null

    // Comparar quantity vs min_stock_alert requiere SQL (Prisma no compara columnas)
    if (stockStatus) {
      const statusSql =
        stockStatus === 'agotado'
          ? Prisma.sql`AND i.quantity <= 0`
          : stockStatus === 'bajo'
            ? Prisma.sql`AND i.quantity > 0 AND i.quantity <= i.min_stock_alert`
            : Prisma.sql`AND i.quantity > i.min_stock_alert`

      const searchSql = searchTerm
        ? Prisma.sql`AND (p.name LIKE ${`%${searchTerm}%`} OR p.sku LIKE ${`%${searchTerm}%`} OR IFNULL(p.barcode, '') LIKE ${`%${searchTerm}%`})`
        : Prisma.empty

      const ids = await this.prisma.$queryRaw<Array<{ id: number }>>`
        SELECT i.id FROM inventory i
        INNER JOIN products p ON p.id = i.product_id
        WHERE i.branch_id = ${branchId}
        ${statusSql}
        ${searchSql}
        ORDER BY p.name ASC
        LIMIT ${limit} OFFSET ${skip}
      `
      const totalRows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) as total FROM inventory i
        INNER JOIN products p ON p.id = i.product_id
        WHERE i.branch_id = ${branchId}
        ${statusSql}
        ${searchSql}
      `
      const total = Number(totalRows[0]?.total ?? 0)
      if (!ids.length) return { data: [], total, page, limit }

      const data = await this.prisma.inventory.findMany({
        where: { id: { in: ids.map((r) => r.id) } },
        include: { product: { include: { category: true } }, branch: true },
      })
      const order = new Map(ids.map((r, idx) => [r.id, idx]))
      data.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      return { data, total, page, limit }
    }

    const where: Prisma.InventoryWhereInput = {
      branchId,
      ...(searchTerm
        ? {
            product: {
              OR: [
                { name: { contains: searchTerm } },
                { sku: { contains: searchTerm } },
                { barcode: { contains: searchTerm } },
              ],
            },
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        include: { product: { include: { category: true } }, branch: true },
        orderBy: { product: { name: 'asc' } },
        skip,
        take: limit,
      }),
      this.prisma.inventory.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async getMovements(
    branchId: number,
    page = 1,
    limit = 30,
    productId?: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit
    const where: Prisma.InventoryMovementWhereInput = {
      branchId,
      ...(productId ? { productId } : {}),
      ...(search
        ? {
            product: {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
              ],
            },
          }
        : {}),
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
