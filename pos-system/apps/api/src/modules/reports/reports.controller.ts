import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ReportsService } from './reports.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard() { return this.reportsService.getDashboard() }

  @Get('sales')
  getSalesReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getSalesReport(from, to)
  }

  @Get('products')
  getProductsReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getProductsReport(from, to)
  }

  @Get('cashiers')
  getCashiersReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getCashiersReport(from, to)
  }

  @Get('inventory')
  getInventoryReport() { return this.reportsService.getInventoryReport() }

  @Get('gross-profit')
  getGrossProfitReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getGrossProfitReport(from, to)
  }

  @Get('export/pdf')
  async exportPdf(
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.reportsService.exportPdf(type, from, to)
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${type}.pdf"`,
      'Content-Length': buffer.length,
    })
    res!.end(buffer)
  }

  @Get('export/excel')
  async exportExcel(
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.reportsService.exportExcel(type, from, to)
    res!.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${type}.csv"`,
    })
    res!.send('\uFEFF' + csv) // BOM para Excel
  }
}
