import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, search?: string, active?: boolean) {
    const skip = (page - 1) * limit
    const where: any = {}
    if (active !== undefined) where.isActive = active
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, inventory: true },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ])
    return { data, total, page, limit }
  }

  findBySearch(q: string, active = true) {
    return this.prisma.product.findMany({
      where: {
        isActive: active,
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { barcode: { contains: q } },
        ],
      },
      include: { inventory: true },
      take: 30,
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: number) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, inventory: true },
    })
    if (!p) throw new NotFoundException('Producto no encontrado')
    return p
  }

  async create(data: {
    sku: string; barcode?: string; name: string; description?: string
    categoryId?: number; costPrice: number; salePrice: number; taxRate: number
    unitType?: string; imageUrl?: string; initialStock?: number; minStockAlert?: number
  }) {
    const { initialStock = 0, minStockAlert = 5, ...productData } = data
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { ...productData, unitType: (productData.unitType ?? 'UNIDAD') as any } })
      await tx.inventory.create({
        data: { productId: product.id, quantity: initialStock, minStockAlert },
      })
      return product
    })
  }

  async update(id: number, data: Partial<{
    sku: string; barcode: string; name: string; description: string
    categoryId: number; costPrice: number; salePrice: number; taxRate: number
    unitType: string; imageUrl: string; isActive: boolean; minStockAlert: number
  }>) {
    const { minStockAlert, ...productData } = data as any
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: productData })
      if (minStockAlert !== undefined) {
        await tx.inventory.updateMany({ where: { productId: id }, data: { minStockAlert } })
      }
      return product
    })
  }

  remove(id: number) {
    return this.prisma.product.update({ where: { id }, data: { isActive: false } })
  }

  async importCsv(file: Express.Multer.File): Promise<{ imported: number; errors: string[] }> {
    const content = file.buffer?.toString('utf-8') ?? fs.readFileSync(file.path, 'utf-8')
    const lines = content.split('\n').filter(Boolean)
    const errors: string[] = []
    let imported = 0

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      try {
        const [sku, name, costPrice, salePrice, stock, , barcode] = cols
        if (!sku || !name) { errors.push(`Fila ${i + 1}: SKU y nombre son requeridos`); continue }
        await this.create({
          sku,
          name,
          costPrice: parseFloat(costPrice) || 0,
          salePrice: parseFloat(salePrice) || 0,
          taxRate: 0.15,
          barcode: barcode || undefined,
          initialStock: parseFloat(stock) || 0,
        })
        imported++
      } catch (err: any) {
        errors.push(`Fila ${i + 1}: ${err.message}`)
      }
    }
    // Limpia el archivo temporal
    if (file.path) fs.unlink(file.path, () => {})
    return { imported, errors }
  }

  uploadImage(file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}` }
  }
}
