import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import PDFDocument from 'pdfkit'

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  async getDashboard() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    const [salesTodayCount, totalToday, totalWeek, productsLowStock, topProducts, recentSales] =
      await Promise.all([
        this.prisma.sale.count({ where: { createdAt: { gte: todayStart }, status: 'COMPLETADA' } }),
        this.prisma.sale.aggregate({
          where: { createdAt: { gte: todayStart }, status: 'COMPLETADA' },
          _sum: { total: true },
        }),
        this.prisma.sale.aggregate({
          where: { createdAt: { gte: weekStart }, status: 'COMPLETADA' },
          _sum: { total: true },
        }),
        this.prisma.inventory.count({ where: { quantity: { lte: this.prisma.inventory.fields.minStockAlert as any } } }),
        this.prisma.saleItem.groupBy({
          by: ['productId'],
          where: { sale: { createdAt: { gte: weekStart }, status: 'COMPLETADA' } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 8,
        }),
        this.prisma.sale.findMany({
          where: { status: 'COMPLETADA' },
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

    // Enriquecer top productos
    const productIds = topProducts.map((p) => p.productId)
    const productNames = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(productNames.map((p) => [p.id, p.name]))

    // Gráfica de ventas por día (últimos 7 días)
    const salesChart = await this.buildSalesChart(weekStart)

    // Stock bajo real
    const lowStockCount = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_stock_alert
    `

    return {
      salesToday: salesTodayCount,
      totalToday: Number(totalToday._sum.total ?? 0),
      totalWeek: Number(totalWeek._sum.total ?? 0),
      productsLowStock: Number(lowStockCount[0]?.count ?? 0),
      topProducts: topProducts.map((p) => ({
        name: nameMap.get(p.productId) ?? `Producto ${p.productId}`,
        quantity: Number(p._sum.quantity ?? 0),
      })),
      recentSales: recentSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        total: Number(s.total),
        status: s.status,
        customerName: s.customer?.name ?? null,
        createdAt: s.createdAt,
      })),
      salesChart,
    }
  }

  private async buildSalesChart(from: Date) {
    const sales = await this.prisma.sale.findMany({
      where: { createdAt: { gte: from }, status: 'COMPLETADA' },
      select: { createdAt: true, total: true },
    })
    const byDay = new Map<string, number>()
    for (const s of sales) {
      const day = s.createdAt.toISOString().slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + Number(s.total))
    }
    const result: { date: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      result.push({ date: key.slice(5), total: byDay.get(key) ?? 0 })
    }
    return result
  }

  async getSalesReport(from?: string, to?: string) {
    const where: any = { status: 'COMPLETADA' }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }
    const sales = await this.prisma.sale.findMany({
      where,
      include: { user: { select: { id: true, name: true } }, customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
    })
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0)
    const totalTax = sales.reduce((sum, s) => sum + Number(s.taxTotal), 0)
    return { sales, totalRevenue, totalTax, count: sales.length }
  }

  async getProductsReport(from?: string, to?: string) {
    const where: any = {}
    if (from || to) {
      where.sale = { createdAt: {}, status: 'COMPLETADA' }
      if (from) where.sale.createdAt.gte = new Date(from)
      if (to) where.sale.createdAt.lte = new Date(to)
    } else {
      where.sale = { status: 'COMPLETADA' }
    }
    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where,
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 50,
    })
    const ids = grouped.map((g) => g.productId)
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, sku: true },
    })
    const nameMap = new Map(products.map((p) => [p.id, p]))
    return grouped.map((g) => ({
      product: nameMap.get(g.productId),
      quantitySold: Number(g._sum.quantity ?? 0),
      revenue: Number(g._sum.subtotal ?? 0),
    }))
  }

  async getCashiersReport(from?: string, to?: string) {
    const where: any = { status: 'COMPLETADA' }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }
    const grouped = await this.prisma.sale.groupBy({
      by: ['userId'],
      where,
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
    })
    const userIds = grouped.map((g) => g.userId)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u.name]))
    return grouped.map((g) => ({
      userId: g.userId,
      userName: userMap.get(g.userId) ?? `Usuario ${g.userId}`,
      salesCount: g._count.id,
      totalRevenue: Number(g._sum.total ?? 0),
      average: g._count.id > 0 ? Number(g._sum.total ?? 0) / g._count.id : 0,
    }))
  }

  async getInventoryReport() {
    const inventory = await this.prisma.inventory.findMany({
      include: { product: { include: { category: true } } },
      orderBy: { product: { name: 'asc' } },
    })
    return inventory.map((inv) => ({
      product: inv.product,
      quantity: inv.quantity,
      minStockAlert: inv.minStockAlert,
      costValue: Number(inv.product.costPrice) * Number(inv.quantity),
      saleValue: Number(inv.product.salePrice) * Number(inv.quantity),
      status: Number(inv.quantity) <= 0 ? 'AGOTADO' : Number(inv.quantity) <= Number(inv.minStockAlert) ? 'BAJO' : 'OK',
    }))
  }

  async getGrossProfitReport(from?: string, to?: string) {
    const where: any = { status: 'COMPLETADA' }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, costPrice: true } } } },
      },
    })

    let revenue = 0
    let cost = 0
    const byProduct = new Map<
      number,
      { productId: number; name: string; sku: string; quantity: number; revenue: number; cost: number; profit: number }
    >()

    for (const sale of sales) {
      for (const item of sale.items) {
        const qty = Number(item.quantity)
        const lineRevenue = Number(item.subtotal)
        const lineCost = Number(item.product.costPrice) * qty
        revenue += lineRevenue
        cost += lineCost

        const existing = byProduct.get(item.productId)
        if (existing) {
          existing.quantity += qty
          existing.revenue += lineRevenue
          existing.cost += lineCost
          existing.profit = existing.revenue - existing.cost
        } else {
          byProduct.set(item.productId, {
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            quantity: qty,
            revenue: lineRevenue,
            cost: lineCost,
            profit: lineRevenue - lineCost,
          })
        }
      }
    }

    const products = Array.from(byProduct.values()).sort((a, b) => b.profit - a.profit)
    const profit = revenue - cost
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0

    return {
      revenue,
      cost,
      profit,
      margin,
      salesCount: sales.length,
      products,
    }
  }

  async exportPdf(type: string, from?: string, to?: string): Promise<Buffer> {
    const settings = await this.settingsService.get()

    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' })
      const buffers: Buffer[] = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      doc.fontSize(18).font('Helvetica-Bold').text(settings.businessName ?? 'POS Honduras', { align: 'center' })
      doc.fontSize(12).font('Helvetica').text(
        `Reporte: ${type.toUpperCase()} — ${from ?? 'inicio'} al ${to ?? 'hoy'}`,
        { align: 'center' },
      )
      doc.moveDown()

      if (type === 'ventas') {
        const report = await this.getSalesReport(from, to)
        doc.fontSize(10).text(`Total ventas: ${report.count}`)
        doc.text(`Ingresos: L. ${Number(report.totalRevenue).toFixed(2)}`)
        doc.text(`ISV: L. ${Number(report.totalTax).toFixed(2)}`)
        doc.moveDown()
        for (const s of report.sales.slice(0, 100)) {
          doc.fontSize(8).text(`${s.invoiceNumber} | ${s.customer?.name ?? 'Consumidor'} | L. ${Number(s.total).toFixed(2)} | ${s.status}`)
        }
      } else if (type === 'inventario') {
        const inv = await this.getInventoryReport()
        doc.fontSize(10)
        for (const i of inv) {
          doc.fontSize(8).text(`${i.product.name} | Stock: ${i.quantity} | Valor: L. ${i.costValue.toFixed(2)} | ${i.status}`)
        }
      } else if (type === 'ganancia') {
        const report = await this.getGrossProfitReport(from, to)
        doc.fontSize(10).text(`Ingresos: L. ${report.revenue.toFixed(2)}`)
        doc.text(`Costo: L. ${report.cost.toFixed(2)}`)
        doc.text(`Ganancia bruta: L. ${report.profit.toFixed(2)} (${report.margin.toFixed(1)}%)`)
        doc.moveDown()
        for (const p of report.products.slice(0, 80)) {
          doc.fontSize(8).text(
            `${p.sku} | ${p.name} | Cant: ${p.quantity} | Ganancia: L. ${p.profit.toFixed(2)}`,
          )
        }
      }

      doc.end()
    })
  }

  async exportExcel(type: string, from?: string, to?: string): Promise<string> {
    if (type === 'ventas') {
      const report = await this.getSalesReport(from, to)
      const header = 'Factura,Fecha,Cliente,Cajero,Total,Estado\n'
      const rows = report.sales.map((s) =>
        `${s.invoiceNumber},${s.createdAt.toISOString().slice(0, 10)},${s.customer?.name ?? 'Consumidor'},${(s as any).user?.name ?? ''},${Number(s.total).toFixed(2)},${s.status}`,
      )
      return header + rows.join('\n')
    } else if (type === 'inventario') {
      const inv = await this.getInventoryReport()
      const header = 'SKU,Nombre,Stock,Costo Unitario,Valor Total,Estado\n'
      const rows = inv.map((i) =>
        `${i.product.sku},${i.product.name},${i.quantity},${Number(i.product.costPrice).toFixed(2)},${i.costValue.toFixed(2)},${i.status}`,
      )
      return header + rows.join('\n')
    } else if (type === 'productos') {
      const prods = await this.getProductsReport(from, to)
      const header = 'SKU,Nombre,Unidades Vendidas,Ingresos\n'
      const rows = prods.map((p) =>
        `${p.product?.sku ?? ''},${p.product?.name ?? ''},${p.quantitySold},${p.revenue.toFixed(2)}`,
      )
      return header + rows.join('\n')
    } else if (type === 'ganancia') {
      const report = await this.getGrossProfitReport(from, to)
      const header = 'SKU,Nombre,Cantidad,Ingresos,Costo,Ganancia\n'
      const rows = report.products.map(
        (p) =>
          `${p.sku},${p.name},${p.quantity},${p.revenue.toFixed(2)},${p.cost.toFixed(2)},${p.profit.toFixed(2)}`,
      )
      return `RESUMEN,Ingresos,${report.revenue.toFixed(2)},Costo,${report.cost.toFixed(2)},Ganancia,${report.profit.toFixed(2)}\n` + header + rows.join('\n')
    }
    return 'tipo,de,reporte\n'
  }
}
