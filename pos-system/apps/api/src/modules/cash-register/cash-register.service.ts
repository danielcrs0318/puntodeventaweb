import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import PDFDocument from 'pdfkit'

@Injectable()
export class CashRegisterService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  async getActiveSession(userId?: number, branchId?: number) {
    const where: any = { status: 'ABIERTA' }
    if (userId) where.userId = userId
    if (branchId) where.branchId = branchId
    return this.prisma.cashRegisterSession.findFirst({
      where,
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    })
  }

  async openSession(userId: number, branchId: number, openingAmount: number) {
    const existing = await this.prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: 'ABIERTA' },
    })
    if (existing) throw new BadRequestException('Ya tienes una caja abierta en esta sucursal')

    const session = await this.prisma.cashRegisterSession.create({
      data: { userId, branchId, openingAmount, status: 'ABIERTA' },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    })
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CASH_OPEN',
        entity: 'CashRegisterSession',
        entityId: session.id,
        details: { openingAmount, branchId },
      },
    })
    return session
  }

  async closeSession(userId: number, branchId: number, closingAmount: number) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: 'ABIERTA' },
    })
    if (!session) throw new NotFoundException('No hay caja abierta en esta sucursal')

    // Calcular ventas en efectivo durante la sesión
    const salesCash = await this.prisma.salePayment.aggregate({
      where: {
        method: 'EFECTIVO',
        sale: { cashRegisterSessionId: session.id, status: 'COMPLETADA' },
      },
      _sum: { amount: true },
    })

    // Movimientos manuales
    const movements = await this.prisma.cashMovement.aggregate({
      where: { cashRegisterSessionId: session.id },
      _sum: { amount: true },
    })

    const cashIn = salesCash._sum.amount ?? 0
    const moveDelta = movements._sum.amount ?? 0
    const expectedAmount = Number(session.openingAmount) + Number(cashIn) + Number(moveDelta)
    const difference = Number(closingAmount) - expectedAmount

    const closed = await this.prisma.cashRegisterSession.update({
      where: { id: session.id },
      data: {
        closingAmount,
        expectedAmount,
        difference,
        closedAt: new Date(),
        status: 'CERRADA',
      },
    })

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CASH_CLOSE',
        entity: 'CashRegisterSession',
        entityId: session.id,
        details: { closingAmount, expectedAmount, difference, branchId },
      },
    })

    return closed
  }

  getMovements(sessionId: number, branchId: number, userId?: number, role?: string) {
    return this.assertSessionAccess(sessionId, branchId, userId, role).then(() =>
      this.prisma.cashMovement.findMany({
        where: { cashRegisterSessionId: sessionId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    )
  }

  async addMovement(
    sessionId: number,
    userId: number,
    type: 'INGRESO' | 'EGRESO',
    amount: number,
    reason: string,
    branchId: number,
    role?: string,
  ) {
    const session = await this.assertSessionAccess(sessionId, branchId, userId, role)
    if (session.status !== 'ABIERTA') {
      throw new BadRequestException('No hay caja abierta con ese ID')
    }
    const signedAmount = type === 'EGRESO' ? -Math.abs(amount) : Math.abs(amount)
    const movement = await this.prisma.cashMovement.create({
      data: { cashRegisterSessionId: sessionId, userId, type, amount: signedAmount, reason },
    })
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: type === 'INGRESO' ? 'CASH_IN' : 'CASH_OUT',
        entity: 'CashMovement',
        entityId: movement.id,
        details: { sessionId, amount: signedAmount, reason, branchId },
      },
    })
    return movement
  }

  private async assertSessionAccess(
    sessionId: number,
    branchId: number,
    userId?: number,
    role?: string,
  ) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: {
        id: sessionId,
        branchId,
        ...(role === 'admin' || role === 'supervisor' ? {} : userId ? { userId } : {}),
      },
    })
    if (!session) throw new NotFoundException('Sesión de caja no encontrada en esta sucursal')
    return session
  }

  async getSessions(page = 1, limit = 20, userId?: number, branchId?: number) {
    const skip = (page - 1) * limit
    const where: any = {}
    if (userId) where.userId = userId
    if (branchId) where.branchId = branchId
    const [data, total] = await Promise.all([
      this.prisma.cashRegisterSession.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.cashRegisterSession.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async generateCloseReport(sessionId: number, branchId: number): Promise<Buffer> {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: sessionId, branchId },
      include: {
        user: { select: { name: true } },
        cashMovements: { orderBy: { createdAt: 'asc' } },
        sales: {
          where: { status: 'COMPLETADA' },
          include: { payments: true },
        },
      },
    })
    if (!session) throw new NotFoundException('Sesión de caja no encontrada')
    if (session.status !== 'CERRADA') {
      throw new BadRequestException('Solo se puede generar reporte de sesiones cerradas')
    }

    const settings = await this.settingsService.get()
    const currency = settings.currencySymbol ?? 'L.'

    const salesCash = session.sales.reduce((sum, sale) => {
      const cash = sale.payments
        .filter((p) => p.method === 'EFECTIVO')
        .reduce((acc, p) => acc + Number(p.amount), 0)
      return sum + cash
    }, 0)

    const salesTotal = session.sales.reduce((sum, s) => sum + Number(s.total), 0)

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' })
      const buffers: Buffer[] = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      doc.fontSize(16).font('Helvetica-Bold').text(settings.businessName ?? 'POS Honduras', { align: 'center' })
      doc.fontSize(12).font('Helvetica-Bold').text('Reporte de Cierre de Caja', { align: 'center' })
      doc.moveDown()

      doc.fontSize(10).font('Helvetica')
      doc.text(`Cajero: ${session.user?.name ?? '—'}`)
      doc.text(`Apertura: ${new Date(session.openedAt).toLocaleString('es-HN')}`)
      doc.text(`Cierre: ${session.closedAt ? new Date(session.closedAt).toLocaleString('es-HN') : '—'}`)
      doc.moveDown()

      doc.font('Helvetica-Bold').text('Resumen')
      doc.font('Helvetica')
      doc.text(`Monto inicial: ${currency}${Number(session.openingAmount).toFixed(2)}`)
      doc.text(`Ventas en efectivo: ${currency}${salesCash.toFixed(2)}`)
      doc.text(`Total ventas: ${currency}${salesTotal.toFixed(2)}`)
      doc.text(`Monto esperado: ${currency}${Number(session.expectedAmount ?? 0).toFixed(2)}`)
      doc.text(`Monto contado: ${currency}${Number(session.closingAmount ?? 0).toFixed(2)}`)
      doc.text(`Diferencia: ${currency}${Number(session.difference ?? 0).toFixed(2)}`)
      doc.moveDown()

      if (session.cashMovements.length > 0) {
        doc.font('Helvetica-Bold').text('Movimientos manuales')
        doc.font('Helvetica')
        for (const m of session.cashMovements) {
          doc.text(
            `${new Date(m.createdAt).toLocaleString('es-HN')} | ${m.type} | ${currency}${Math.abs(Number(m.amount)).toFixed(2)} | ${m.reason}`,
          )
        }
        doc.moveDown()
      }

      doc.fontSize(8).text(`Generado: ${new Date().toLocaleString('es-HN')}`, { align: 'center' })
      doc.end()
    })
  }
}
