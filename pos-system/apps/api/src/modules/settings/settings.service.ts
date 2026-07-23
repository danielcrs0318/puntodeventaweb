import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    let s = await this.prisma.settings.findFirst()
    if (!s) s = await this.prisma.settings.create({ data: { id: 1 } })
    return s
  }

  update(data: Partial<{
    businessName: string; taxId: string; currency: string; currencySymbol: string
    taxRateDefault: number; invoiceFooterText: string; address: string; phone: string
    email: string; fiscalInvoicingEnabled: boolean; lowStockThreshold: number
    caiAlertThreshold: number; caiDaysAlertThreshold: number; businessLogo: string
  }>) {
    return this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    })
  }

  async exportBackup() {
    const [
      settings,
      users,
      roles,
      categories,
      products,
      customers,
      suppliers,
      sales,
      caiRanges,
      fiscalInvoices,
    ] = await Promise.all([
      this.prisma.settings.findFirst(),
      this.prisma.user.findMany({
        select: {
          id: true, name: true, email: true, roleId: true, isActive: true, createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.role.findMany({ include: { permissions: { include: { permission: true } } } }),
      this.prisma.category.findMany(),
      this.prisma.product.findMany(),
      this.prisma.customer.findMany(),
      this.prisma.supplier.findMany(),
      this.prisma.sale.findMany({
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      this.prisma.caiRange.findMany(),
      this.prisma.fiscalInvoice.findMany({ orderBy: { issuedAt: 'desc' }, take: 5000 }),
    ])

    return {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      settings,
      users,
      roles,
      categories,
      products,
      customers,
      suppliers,
      sales,
      caiRanges,
      fiscalInvoices,
    }
  }
}
