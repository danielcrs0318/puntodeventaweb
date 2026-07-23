import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class FiscalInvoicingService {
  constructor(private prisma: PrismaService) {}

  getCaiRanges() {
    return this.prisma.caiRange.findMany({ orderBy: { createdAt: 'desc' } })
  }

  createCaiRange(data: {
    caiCode: string
    documentType: string
    branchOfficeCode: string
    posCode: string
    rangeStart: number
    rangeEnd: number
    authorizationDate: Date | string
    expirationDate: Date | string
    branchId?: number
  }) {
    return this.prisma.caiRange.create({
      data: {
        caiCode: data.caiCode,
        documentType: data.documentType as any,
        branchOfficeCode: data.branchOfficeCode,
        posCode: data.posCode,
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd,
        currentNumber: data.rangeStart,
        authorizationDate: new Date(data.authorizationDate),
        expirationDate: new Date(data.expirationDate),
        branchId: data.branchId ?? null,
      },
    })
  }

  updateCaiRange(id: number, data: {
    caiCode?: string; documentType?: string; branchOfficeCode?: string; posCode?: string
    rangeStart?: number; rangeEnd?: number; authorizationDate?: string; expirationDate?: string; isActive?: boolean
  }) {
    const updateData: any = { ...data }
    if (data.authorizationDate) updateData.authorizationDate = new Date(data.authorizationDate)
    if (data.expirationDate) updateData.expirationDate = new Date(data.expirationDate)
    if (data.documentType) updateData.documentType = data.documentType as any
    return this.prisma.caiRange.update({ where: { id }, data: updateData })
  }

  deleteCaiRange(id: number) {
    return this.prisma.caiRange.delete({ where: { id } })
  }

  async getActiveRange(documentType: string, branchId?: number) {
    const range = await this.prisma.caiRange.findFirst({
      where: {
        documentType: documentType as any,
        isActive: true,
        expirationDate: { gte: new Date() },
        ...(branchId
          ? { OR: [{ branchId }, { branchId: null }] }
          : {}),
      },
      orderBy: [{ branchId: 'desc' }, { createdAt: 'asc' }],
    })
    if (!range) throw new BadRequestException('No hay rango CAI activo y vigente para este tipo de documento')
    if (range.currentNumber > range.rangeEnd) {
      throw new BadRequestException('El rango CAI activo está agotado. Registra un nuevo rango.')
    }
    return range
  }

  /**
   * Emite una factura fiscal de forma atómica.
   * Puede recibir un Prisma transaction client (tx) para ejecutarse dentro
   * de la transacción de la venta.
   */
  async emitFiscalInvoice(
    saleId: number,
    customerName?: string | null,
    customerTaxId?: string | null,
    tx?: Prisma.TransactionClient,
    branchId?: number,
  ) {
    const db = tx ?? this.prisma
    const range = await this.getActiveRange('FACTURA', branchId)

    // Incremento atómico con optimistic locking
    const currentNum = range.currentNumber
    const updateResult = await db.caiRange.updateMany({
      where: { id: range.id, currentNumber: currentNum },
      data: { currentNumber: currentNum + 1 },
    })

    if (updateResult.count === 0) {
      throw new BadRequestException('Error de concurrencia al asignar número de factura. Reintenta.')
    }

    // Formato Honduras: 000-001-01-00000001
    const branch = range.branchOfficeCode.padStart(3, '0')
    const pos = range.posCode.padStart(3, '0')
    const num = String(currentNum).padStart(8, '0')
    const fullInvoiceNumber = `${branch}-${pos}-01-${num}`

    const fiscalInvoice = await db.fiscalInvoice.create({
      data: {
        saleId,
        caiRangeId: range.id,
        fullInvoiceNumber,
        documentType: 'FACTURA' as any,
        customerName: customerName ?? 'CONSUMIDOR FINAL',
        customerTaxId: customerTaxId ?? null,
        issuedAt: new Date(),
        isVoided: false,
      },
    })

    return fiscalInvoice
  }

  async voidFiscalInvoice(saleId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma
    const fi = await db.fiscalInvoice.findFirst({
      where: { saleId, documentType: 'FACTURA', isVoided: false },
    })
    if (!fi) return
    return db.fiscalInvoice.update({
      where: { id: fi.id },
      data: { isVoided: true },
    })
  }

  async emitCreditNote(
    saleId: number,
    reason: string,
    customerName?: string | null,
    customerTaxId?: string | null,
    tx?: Prisma.TransactionClient,
    branchId?: number,
  ) {
    const db = tx ?? this.prisma
    const original = await db.fiscalInvoice.findFirst({
      where: { saleId, documentType: 'FACTURA' },
      orderBy: { issuedAt: 'asc' },
    })

    let caiBranchId = branchId
    if (caiBranchId == null && original) {
      const origRange = await db.caiRange.findUnique({ where: { id: original.caiRangeId } })
      caiBranchId = origRange?.branchId ?? undefined
    }

    const activeRange = await this.getActiveRange('NOTA_CREDITO', caiBranchId)

    const currentNum = activeRange.currentNumber
    const updateResult = await db.caiRange.updateMany({
      where: { id: activeRange.id, currentNumber: currentNum },
      data: { currentNumber: currentNum + 1 },
    })

    if (updateResult.count === 0) {
      throw new BadRequestException('Error de concurrencia al asignar nota de crédito. Reintenta.')
    }

    const branch = activeRange.branchOfficeCode.padStart(3, '0')
    const pos = activeRange.posCode.padStart(3, '0')
    const num = String(currentNum).padStart(8, '0')
    const fullInvoiceNumber = `${branch}-${pos}-01-${num}`

    return db.fiscalInvoice.create({
      data: {
        saleId,
        caiRangeId: activeRange.id,
        fullInvoiceNumber,
        documentType: 'NOTA_CREDITO' as any,
        customerName: customerName ?? 'CONSUMIDOR FINAL',
        customerTaxId: customerTaxId ?? null,
        issuedAt: new Date(),
        isVoided: false,
        voidedReason: reason,
        relatedInvoiceId: original?.id ?? null,
      },
    })
  }

  async getReport(from?: string, to?: string) {
    const where: any = {}
    if (from || to) {
      where.issuedAt = {}
      if (from) where.issuedAt.gte = new Date(from)
      if (to) where.issuedAt.lte = new Date(to)
    }
    return this.prisma.fiscalInvoice.findMany({
      where,
      include: { sale: { include: { customer: true } }, caiRange: true },
      orderBy: { issuedAt: 'desc' },
    })
  }
}
