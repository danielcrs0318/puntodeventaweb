import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { MailService } from '../mail/mail.service'

export interface StockChangeResult {
  productId: number
  branchId: number
  previousQuantity: number
  newQuantity: number
  minStockAlert: number
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async getStock(
    branchId: number,
    page = 1,
    limit = 20,
    search?: string,
    stockStatus?: 'bajo' | 'agotado' | 'ok',
  ) {
    const skip = (page - 1) * limit
    const searchTerm = search?.trim() || null

    await this.ensureBranchInventory(branchId)

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

  /**
   * Crea en 0 las filas de inventario faltantes de la sucursal. Necesario para
   * sucursales creadas después de los productos: sin fila el producto no aparece.
   */
  async ensureBranchInventory(branchId: number) {
    const missing = await this.prisma.product.findMany({
      where: { isActive: true, inventory: { none: { branchId } } },
      select: { id: true },
    })
    if (!missing.length) return 0

    const result = await this.prisma.inventory.createMany({
      data: missing.map((p) => ({
        productId: p.id,
        branchId,
        quantity: 0,
        minStockAlert: 5,
      })),
      skipDuplicates: true,
    })
    this.logger.log(
      `Inventario inicializado para sucursal ${branchId}: ${result.count} productos`,
    )
    return result.count
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

    const change = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ quantity: any; min_stock_alert: any }>>`
        SELECT quantity, min_stock_alert FROM inventory
        WHERE product_id = ${productId} AND branch_id = ${branchId}
        FOR UPDATE
      `
      if (!rows.length) throw new NotFoundException('Producto sin registro de inventario en esta sucursal')
      const previousQuantity = Number(rows[0].quantity)
      const minStockAlert = Number(rows[0].min_stock_alert)
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

      return {
        productId,
        branchId,
        previousQuantity,
        newQuantity: quantity,
        minStockAlert,
      } satisfies StockChangeResult
    })

    void this.notifyLowStockIfNeeded(change)
    return { ok: true, ...change }
  }

  async decreaseStock(
    productId: number,
    branchId: number,
    quantity: number,
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<StockChangeResult> {
    const db = tx ?? this.prisma
    await this.ensureInventoryRow(productId, branchId, db)

    const locked = await db.$queryRaw<Array<{ quantity: any; min_stock_alert: any }>>`
      SELECT quantity, min_stock_alert FROM inventory
      WHERE product_id = ${productId} AND branch_id = ${branchId}
      FOR UPDATE
    `
    if (!locked.length) {
      throw new NotFoundException('Producto sin registro de inventario en esta sucursal')
    }
    const previousQuantity = Number(locked[0].quantity)
    const minStockAlert = Number(locked[0].min_stock_alert)

    if (previousQuantity < quantity) {
      throw new BadRequestException(`Stock insuficiente para el producto ${productId} en esta sucursal`)
    }

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

    const newQuantity = previousQuantity - quantity
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

    const change: StockChangeResult = {
      productId,
      branchId,
      previousQuantity,
      newQuantity,
      minStockAlert,
    }

    // Si no hay transacción externa, notificar de inmediato
    if (!tx) {
      void this.notifyLowStockIfNeeded(change)
    }

    return change
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

  /**
   * Envía correo solo al cruzar el umbral (evitar spam mientras ya está bajo).
   * - AGOTADO: pasó de >0 a <=0
   * - BAJO: pasó de >min a <=min (y aún >0)
   */
  shouldNotifyLowStock(change: StockChangeResult): 'BAJO' | 'AGOTADO' | null {
    const { previousQuantity: prev, newQuantity: next, minStockAlert: min } = change
    if (next <= 0 && prev > 0) return 'AGOTADO'
    if (next > 0 && next <= min && prev > min) return 'BAJO'
    return null
  }

  async notifyLowStockIfNeeded(change: StockChangeResult): Promise<void> {
    const status = this.shouldNotifyLowStock(change)
    if (!status) return

    try {
      const [product, branch, settings, admins] = await Promise.all([
        this.prisma.product.findUnique({
          where: { id: change.productId },
          select: { name: true, sku: true },
        }),
        this.prisma.branch.findUnique({
          where: { id: change.branchId },
          select: { name: true },
        }),
        this.prisma.settings.findFirst(),
        this.prisma.user.findMany({
          where: {
            isActive: true,
            role: { name: { in: ['admin', 'supervisor'] } },
          },
          select: { email: true },
        }),
      ])

      if (!product || !branch) return

      const recipients = new Set<string>()
      if (settings?.email?.trim()) recipients.add(settings.email.trim())
      for (const u of admins) {
        if (u.email?.trim()) recipients.add(u.email.trim())
      }

      if (!recipients.size) {
        this.logger.warn(
          `Stock ${status} en producto ${change.productId} pero no hay destinatarios de correo`,
        )
        return
      }

      await this.mail.sendLowStockAlert({
        to: [...recipients],
        businessName: settings?.businessName ?? 'POS Honduras',
        productName: product.name,
        sku: product.sku ?? undefined,
        branchName: branch.name,
        quantity: change.newQuantity,
        minStockAlert: change.minStockAlert,
        status,
      })
    } catch (err: unknown) {
      this.logger.error(
        `Error enviando alerta de stock bajo (producto ${change.productId})`,
        err instanceof Error ? err.stack : String(err),
      )
    }
  }

  /** Notifica varios cambios (p. ej. tras una venta); no falla la operación principal. */
  notifyStockChanges(changes: StockChangeResult[]): void {
    for (const change of changes) {
      void this.notifyLowStockIfNeeded(change)
    }
  }
}
