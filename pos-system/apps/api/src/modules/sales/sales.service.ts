import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { InventoryService } from '../inventory/inventory.service'
import { FiscalInvoicingService } from '../fiscal-invoicing/fiscal-invoicing.service'
import { SettingsService } from '../settings/settings.service'
import { MailService } from '../mail/mail.service'
import PDFDocument from 'pdfkit'

interface SaleItemInput {
  productId: number
  quantity: number
  unitPrice: number
  discount: number
}
interface PaymentInput {
  method: string
  amount: number
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name)

  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private fiscalInvoicingService: FiscalInvoicingService,
    private settingsService: SettingsService,
    private mailService: MailService,
  ) {}

  async findAll(filters: {
    page?: number; limit?: number
    from?: string; to?: string
    userId?: number; customerId?: number
    status?: string; paymentMethod?: string
  }) {
    const { page = 1, limit = 20, from, to, userId, customerId, status, paymentMethod } = filters
    const skip = (page - 1) * limit
    const where: any = {}
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }
    if (userId) where.userId = userId
    if (customerId) where.customerId = customerId
    if (status) where.status = status
    if (paymentMethod) where.paymentMethod = paymentMethod

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          customer: true,
          user: { select: { id: true, name: true } },
          cashRegisterSession: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ])
    return { data, total, page, limit }
  }

  async findOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { id: true, name: true } },
        items: { include: { product: true } },
        payments: true,
        fiscalInvoice: { include: { caiRange: true } },
      },
    })
    if (!sale) throw new NotFoundException('Venta no encontrada')
    return sale
  }

  async create(
    data: {
      customerId?: number
      cashRegisterSessionId: number
      paymentMethod: string
      payments: PaymentInput[]
      items: SaleItemInput[]
      notes?: string
    },
    userId: number,
  ) {
    const settings = await this.settingsService.get()

    // Calcular totales
    let subtotal = 0
    let taxTotal = 0
    let discountTotal = 0

    const products = await Promise.all(
      data.items.map((i) => this.prisma.product.findUnique({ where: { id: i.productId } })),
    )

    const itemsWithTax = data.items.map((item, idx) => {
      const product = products[idx]
      if (!product) throw new BadRequestException(`Producto ${item.productId} no encontrado`)
      const taxRate = Number(product.taxRate)
      const lineSubtotal = item.unitPrice * item.quantity - item.discount
      const lineTax = lineSubtotal * taxRate
      subtotal += lineSubtotal
      taxTotal += lineTax
      discountTotal += item.discount
      return { ...item, taxRate, tax: lineTax, subtotal: lineSubtotal + lineTax }
    })

    const total = subtotal + taxTotal

    // Generar número de recibo correlativo
    const lastSale = await this.prisma.sale.findFirst({ orderBy: { id: 'desc' } })
    const nextNum = (lastSale?.id ?? 0) + 1
    const invoiceNumber = `REC-${String(nextNum).padStart(8, '0')}`

    return this.prisma.$transaction(async (tx) => {
      // Crear venta
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: data.customerId || null,
          userId,
          cashRegisterSessionId: data.cashRegisterSessionId,
          subtotal,
          taxTotal,
          discountTotal,
          total,
          paymentMethod: data.paymentMethod as any,
          status: 'COMPLETADA',
          notes: data.notes,
          items: {
            create: itemsWithTax.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              tax: i.tax,
              subtotal: i.subtotal,
            })),
          },
          payments: {
            create: data.payments.map((p) => ({
              method: p.method as any,
              amount: p.amount,
            })),
          },
        },
        include: { items: true, payments: true },
      })

      // Decrementar stock
      for (const item of data.items) {
        await this.inventoryService.decreaseStock(item.productId, item.quantity, userId, tx)
      }

      // Emitir factura fiscal si está habilitado
      if (settings.fiscalInvoicingEnabled) {
        try {
          const customer = data.customerId
            ? await tx.customer.findUnique({ where: { id: data.customerId } })
            : null
          await this.fiscalInvoicingService.emitFiscalInvoice(
            sale.id,
            customer?.name ?? 'CONSUMIDOR FINAL',
            customer?.identificationNumber ?? null,
            tx,
          )
        } catch (err: any) {
          // Si falla el CAI, la venta igual se completa pero sin número fiscal
          await tx.auditLog.create({
            data: {
              userId,
              action: 'CAI_ERROR',
              entity: 'Sale',
              entityId: sale.id,
              details: { error: err.message },
            },
          })
        }
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'SALE_CREATED',
          entity: 'Sale',
          entityId: sale.id,
          details: { invoiceNumber, total, items: data.items.length },
        },
      })

      return sale
    })
  }

  async voidSale(id: number, reason: string, currentUser: { id: number; role: { name: string } }) {
    const sale = await this.findOne(id)
    if (!['admin', 'supervisor'].includes(currentUser.role.name)) {
      throw new ForbiddenException('Solo supervisores y administradores pueden anular ventas')
    }
    if (sale.status === 'ANULADA') throw new BadRequestException('La venta ya está anulada')

    return this.prisma.$transaction(async (tx) => {
      const voided = await tx.sale.update({
        where: { id },
        data: {
          status: 'ANULADA',
          voidReason: reason,
          voidedById: currentUser.id,
          voidedAt: new Date(),
        },
      })

      // Revertir stock
      for (const item of sale.items) {
        await this.inventoryService.increaseStock(
          item.productId, Number(item.quantity), currentUser.id, 'DEVOLUCION', tx,
        )
      }

      // Anular factura fiscal y emitir nota de crédito si aplica
      if (sale.fiscalInvoice) {
        await this.fiscalInvoicingService.voidFiscalInvoice(id)
        const settings = await this.settingsService.get()
        if (settings.fiscalInvoicingEnabled && sale.fiscalInvoice.documentType === 'FACTURA') {
          try {
            await this.fiscalInvoicingService.emitCreditNote(
              id,
              reason,
              sale.customer?.name ?? 'CONSUMIDOR FINAL',
              sale.customer?.identificationNumber ?? null,
              tx,
            )
          } catch (err: unknown) {
            await tx.auditLog.create({
              data: {
                userId: currentUser.id,
                action: 'CAI_CREDIT_NOTE_ERROR',
                entity: 'Sale',
                entityId: id,
                details: { error: err instanceof Error ? err.message : String(err), reason },
              },
            })
          }
        }
      }

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: 'SALE_VOIDED',
          entity: 'Sale',
          entityId: id,
          details: { reason, invoiceNumber: sale.invoiceNumber },
        },
      })

      return voided
    })
  }

  async generateReceipt(id: number): Promise<Buffer> {
    const sale = await this.findOne(id)
    const settings = await this.settingsService.get()

    return new Promise((resolve, reject) => {
      const pageWidth = 280
      const margin = 14
      const contentWidth = pageWidth - margin * 2
      const rightEdge = pageWidth - margin
      const doc = new PDFDocument({ margin, size: [pageWidth, 1200] })
      const buffers: Buffer[] = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const currency = settings.currencySymbol ?? 'L.'
      const money = (value: unknown) => `${currency} ${Number(value ?? 0).toFixed(2)}`
      const line = () => {
        doc.moveDown(0.2)
        doc.moveTo(margin, doc.y).lineTo(rightEdge, doc.y).stroke()
        doc.moveDown(0.25)
      }
      const labelValue = (label: string, value: string, bold = false) => {
        const y = doc.y
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 9 : 8)
        doc.text(label, margin, y, { width: 92 })
        doc.text(value, margin + 92, y, { width: contentWidth - 92, align: 'right' })
      }

      doc.fontSize(13).font('Helvetica-Bold').text(settings.businessName ?? 'POS Honduras', {
        align: 'center',
        width: contentWidth,
      })
      if (settings.address) doc.fontSize(8).font('Helvetica').text(settings.address, { align: 'center', width: contentWidth })
      if (settings.phone) doc.fontSize(8).text(`Tel: ${settings.phone}`, { align: 'center', width: contentWidth })
      if (settings.taxId) doc.fontSize(8).text(`RTN: ${settings.taxId}`, { align: 'center', width: contentWidth })
      doc.moveDown(0.35)

      doc.fontSize(10).font('Helvetica-Bold').text(sale.invoiceNumber, { align: 'center', width: contentWidth })
      if (sale.fiscalInvoice) {
        doc.fontSize(8).font('Helvetica')
        doc.text(`No. Fiscal: ${sale.fiscalInvoice.fullInvoiceNumber}`, { align: 'center', width: contentWidth })
        doc.text(`CAI: ${sale.fiscalInvoice.caiRange?.caiCode ?? ''}`, { align: 'center', width: contentWidth })
        const caiRange = sale.fiscalInvoice.caiRange
        if (caiRange) {
          doc.text(
            `Rango: ${caiRange.branchOfficeCode}-${caiRange.posCode}-01-${String(caiRange.rangeStart).padStart(8, '0')} a ${String(caiRange.rangeEnd).padStart(8, '0')}`,
            { align: 'center', width: contentWidth },
          )
          doc.text(`Límite emisión: ${new Date(caiRange.expirationDate).toLocaleDateString('es-HN')}`, {
            align: 'center',
            width: contentWidth,
          })
        }
      }
      doc.moveDown(0.3)

      doc.fontSize(8).font('Helvetica')
      doc.text(`Fecha: ${new Date(sale.createdAt).toLocaleString('es-HN')}`, margin, doc.y, { width: contentWidth })
      doc.text(`Cliente: ${sale.customer?.name ?? 'Consumidor Final'}`, margin, doc.y, { width: contentWidth })
      if (sale.customer?.identificationNumber) {
        doc.text(`RTN/DNI: ${sale.customer.identificationNumber}`, margin, doc.y, { width: contentWidth })
      }
      doc.text(`Cajero: ${(sale as any).user?.name ?? ''}`, margin, doc.y, { width: contentWidth })
      line()

      doc.font('Helvetica-Bold').fontSize(8)
      doc.text('Producto', margin, doc.y, { width: contentWidth })
      doc.moveDown(0.15)
      doc.text('Cant', margin, doc.y, { continued: true, width: 36 })
      doc.text('P.Unit', margin + 42, doc.y, { continued: true, width: 66, align: 'right' })
      doc.text('Total', margin + 114, doc.y, { width: contentWidth - 114, align: 'right' })
      line()

      doc.font('Helvetica').fontSize(8)
      for (const item of sale.items) {
        const productName = (item as any).product?.name ?? `Prod. ${item.productId}`
        doc.text(productName, margin, doc.y, { width: contentWidth - 124, lineGap: 1.2 })
        const y = doc.y
        doc.text(String(Number(item.quantity).toFixed(3)).replace(/\.?0+$/, ''), margin, y, { width: 36 })
        doc.text(money(item.unitPrice), margin + 42, y, { width: 66, align: 'right' })
        doc.text(money(item.subtotal), margin + 114, y, { width: contentWidth - 114, align: 'right' })
        doc.moveDown(0.25)
      }

      line()
      labelValue('Subtotal:', money(sale.subtotal))
      if (Number(sale.discountTotal) > 0) labelValue('Descuento:', `-${money(sale.discountTotal)}`)
      labelValue('ISV:', money(sale.taxTotal))
      labelValue('TOTAL:', money(sale.total), true)

      if (sale.payments?.length) {
        doc.moveDown(0.35)
        doc.font('Helvetica-Bold').fontSize(8).text('Pagos', margin, doc.y, { width: contentWidth })
        doc.font('Helvetica').fontSize(8)
        for (const payment of sale.payments) labelValue(String(payment.method), money(payment.amount))
      }

      doc.moveDown(0.45)
      doc.font('Helvetica').fontSize(8)
      doc.text(settings.invoiceFooterText || 'Gracias por su compra', margin, doc.y, {
        align: 'center',
        width: contentWidth,
      })
      if (sale.status === 'ANULADA') {
        doc.moveDown(0.35).font('Helvetica-Bold').fontSize(13)
        doc.fillColor('red').text('*** ANULADA ***', margin, doc.y, { align: 'center', width: contentWidth })
        doc.fillColor('black')
      }

      doc.end()
    })
  }

  async sendReceiptByEmail(
    saleId: number,
    emailOverride?: string,
  ): Promise<{ message: string; sent: boolean; to: string }> {
    const sale = await this.findOne(saleId)
    const settings = await this.settingsService.get()
    const to = (emailOverride || sale.customer?.email || '').trim()

    if (!to) {
      throw new BadRequestException(
        'El cliente no tiene correo registrado. Indica un email o actualiza el cliente.',
      )
    }

    const pdfBuffer = await this.generateReceipt(saleId)
    const currency = settings.currencySymbol ?? 'L.'
    const total = `${currency} ${Number(sale.total).toFixed(2)}`

    try {
      const result = await this.mailService.sendSaleReceipt({
        to,
        customerName: sale.customer?.name ?? 'Cliente',
        businessName: settings.businessName ?? 'POS Honduras',
        invoiceNumber: sale.fiscalInvoice?.fullInvoiceNumber ?? sale.invoiceNumber,
        total,
        pdfBuffer,
      })

      await this.prisma.auditLog.create({
        data: {
          userId: sale.userId,
          action: 'RECEIPT_EMAILED',
          entity: 'Sale',
          entityId: saleId,
          details: { to, sent: result.sent, invoiceNumber: sale.invoiceNumber },
        },
      })

      if (!result.sent) {
        return {
          message:
            'Resend no configurado: el comprobante no se envió por correo (revisa RESEND_API_KEY en .env). En desarrollo el contenido quedó en los logs del API.',
          sent: false,
          to,
        }
      }

      return { message: `Comprobante enviado a ${to}`, sent: true, to }
    } catch (err: unknown) {
      this.logger.error(
        `Error enviando recibo de venta ${saleId}`,
        err instanceof Error ? err.stack : String(err),
      )
      throw new BadRequestException('No se pudo enviar el comprobante por correo')
    }
  }

  async returnItems(
    saleId: number,
    items: { productId: number; quantity: number }[],
    reason: string,
    currentUser: { id: number; role: { name: string } },
  ) {
    if (!['admin', 'supervisor', 'cajero'].includes(currentUser.role.name)) {
      throw new ForbiddenException('No tienes permiso para procesar devoluciones')
    }
    if (!items?.length) throw new BadRequestException('Debes indicar al menos un producto a devolver')
    if (!reason?.trim()) throw new BadRequestException('El motivo de devolución es obligatorio')

    const sale = await this.findOne(saleId)
    if (sale.status === 'ANULADA') {
      throw new BadRequestException('La venta ya está anulada')
    }

    const returnedLines: {
      productId: number
      quantity: number
      refundAmount: number
    }[] = []

    for (const req of items) {
      const saleItem = sale.items.find((i) => i.productId === req.productId)
      if (!saleItem) {
        throw new BadRequestException(`El producto ${req.productId} no pertenece a esta venta`)
      }
      if (req.quantity <= 0) {
        throw new BadRequestException('La cantidad a devolver debe ser mayor a cero')
      }
      if (req.quantity > Number(saleItem.quantity)) {
        throw new BadRequestException(
          `No puedes devolver más de ${saleItem.quantity} unidades del producto ${saleItem.product?.name ?? req.productId}`,
        )
      }

      const unitTotal = Number(saleItem.subtotal) / Number(saleItem.quantity)
      returnedLines.push({
        productId: req.productId,
        quantity: req.quantity,
        refundAmount: unitTotal * req.quantity,
      })
    }

    const refundTotal = returnedLines.reduce((s, l) => s + l.refundAmount, 0)
    const isFullReturn = sale.items.every((si) => {
      const ret = returnedLines.find((r) => r.productId === si.productId)
      return ret && ret.quantity >= Number(si.quantity)
    })

    return this.prisma.$transaction(async (tx) => {
      for (const line of returnedLines) {
        await this.inventoryService.increaseStock(
          line.productId,
          line.quantity,
          currentUser.id,
          'DEVOLUCION',
          tx,
        )
      }

      if (isFullReturn) {
        await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'ANULADA',
            voidReason: `Devolución total: ${reason}`,
            voidedById: currentUser.id,
            voidedAt: new Date(),
          },
        })

        if (sale.fiscalInvoice) {
          await this.fiscalInvoicingService.voidFiscalInvoice(saleId)
          try {
            await this.fiscalInvoicingService.emitCreditNote(
              saleId,
              reason,
              sale.customer?.name ?? 'CONSUMIDOR FINAL',
              sale.customer?.identificationNumber ?? null,
              tx,
            )
          } catch (err: unknown) {
            await tx.auditLog.create({
              data: {
                userId: currentUser.id,
                action: 'CAI_CREDIT_NOTE_ERROR',
                entity: 'Sale',
                entityId: saleId,
                details: { error: err instanceof Error ? err.message : String(err), reason },
              },
            })
          }
        }
      } else {
        const note = `[DEVOLUCIÓN PARCIAL ${new Date().toISOString()}] ${reason} | Reembolso: ${refundTotal.toFixed(2)}`
        await tx.sale.update({
          where: { id: saleId },
          data: {
            notes: sale.notes ? `${sale.notes}\n${note}` : note,
          },
        })
      }

      if (sale.cashRegisterSessionId) {
        const session = await tx.cashRegisterSession.findUnique({
          where: { id: sale.cashRegisterSessionId },
        })
        if (session?.status === 'ABIERTA') {
          await tx.cashMovement.create({
            data: {
              cashRegisterSessionId: sale.cashRegisterSessionId,
              userId: currentUser.id,
              type: 'EGRESO',
              amount: refundTotal,
              reason: `Devolución venta ${sale.invoiceNumber}: ${reason}`,
            },
          })
        }
      }

      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: isFullReturn ? 'SALE_FULL_RETURN' : 'SALE_PARTIAL_RETURN',
          entity: 'Sale',
          entityId: saleId,
          details: {
            reason,
            refundTotal,
            items: returnedLines,
            invoiceNumber: sale.invoiceNumber,
          },
        },
      })

      return {
        saleId,
        fullReturn: isFullReturn,
        refundTotal,
        items: returnedLines,
        message: isFullReturn
          ? 'Devolución total procesada. Venta anulada y stock restaurado.'
          : 'Devolución parcial procesada. Stock restaurado y egreso de caja registrado si la sesión está abierta.',
      }
    })
  }
}
