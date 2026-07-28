import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { InventoryService } from '../inventory/inventory.service'

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  async findAll(page = 1, limit = 20, search?: string, active?: boolean) {
    const skip = (page - 1) * limit
    const where: any = {}
    if (active !== undefined) where.isActive = active
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { taxId: { contains: search } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.supplier.count({ where }),
    ])
    return { data, total, page, limit }
  }

  create(data: { name: string; contactName?: string; phone?: string; email?: string; address?: string; taxId?: string }) {
    return this.prisma.supplier.create({ data })
  }

  async update(id: number, data: { name?: string; contactName?: string; phone?: string; email?: string; address?: string; taxId?: string; isActive?: boolean }) {
    const s = await this.prisma.supplier.findUnique({ where: { id } })
    if (!s) throw new NotFoundException('Proveedor no encontrado')
    return this.prisma.supplier.update({ where: { id }, data })
  }

  remove(id: number) {
    return this.prisma.supplier.update({ where: { id }, data: { isActive: false } })
  }

  async getPurchases(
    page = 1,
    limit = 20,
    supplierId?: number,
    branchId?: number,
    search?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit
    const where: any = {}
    if (supplierId) where.supplierId = supplierId
    if (branchId) where.branchId = branchId
    if (status) where.status = status
    if (search) {
      const asId = Number(search.replace(/\D/g, ''))
      where.OR = [
        { supplier: { name: { contains: search } } },
        { notes: { contains: search } },
        ...(Number.isFinite(asId) && asId > 0 ? [{ id: asId }] : []),
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          user: { select: { id: true, name: true } },
          items: { include: { product: true } },
          branch: { select: { id: true, code: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchase.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async createPurchase(
    supplierId: number,
    userId: number,
    branchId: number,
    items: { productId: number; quantity: number; unitCost: number }[],
    notes?: string,
  ) {
    const total = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId,
          branchId,
          userId,
          total,
          status: 'PENDIENTE',
          notes,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              subtotal: i.quantity * i.unitCost,
            })),
          },
        },
        include: { items: { include: { product: true } }, supplier: true },
      })

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PURCHASE_CREATED',
          entity: 'Purchase',
          entityId: purchase.id,
          details: { supplierId, total, itemCount: items.length, status: 'PENDIENTE', branchId },
        },
      })

      return purchase
    })
  }

  async completePurchase(purchaseId: number, userId: number, branchId: number) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, branchId },
      include: { items: true },
    })
    if (!purchase) throw new NotFoundException('Compra no encontrada')
    if (purchase.status === 'COMPLETADA') {
      throw new BadRequestException('La compra ya está completada')
    }
    if (purchase.status === 'ANULADA') {
      throw new BadRequestException('No se puede completar una compra anulada')
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchase.updateMany({
        where: { id: purchaseId, status: 'PENDIENTE', branchId },
        data: { status: 'COMPLETADA' },
      })
      if (claimed.count === 0) {
        throw new BadRequestException('La compra ya fue completada o no está pendiente')
      }

      for (const item of purchase.items) {
        await this.inventoryService.increaseStock(
          item.productId,
          purchase.branchId,
          Number(item.quantity),
          userId,
          'COMPRA',
          tx,
        )
        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: item.unitCost },
        })
      }

      const updated = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { items: { include: { product: true } }, supplier: true },
      })

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PURCHASE_COMPLETED',
          entity: 'Purchase',
          entityId: purchaseId,
          details: {
            itemCount: purchase.items.length,
            total: Number(purchase.total),
            branchId: purchase.branchId,
          },
        },
      })

      return updated
    })
  }
}
