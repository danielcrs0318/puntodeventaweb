import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ReportsService } from './reports.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentBranchId } from '../../common/decorators/current-branch.decorator'

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(@CurrentBranchId() branchId: number) {
    return this.reportsService.getDashboard(branchId)
  }

  @Get('sales')
  getSalesReport(
    @CurrentBranchId() branchId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.reportsService.getSalesReport(
      from,
      to,
      branchId,
      page ? +page : 1,
      limit ? +limit : 20,
      search,
    )
  }

  @Get('products')
  getProductsReport(
    @CurrentBranchId() branchId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.reportsService.getProductsReport(from, to, branchId, +page, +limit, search)
  }

  @Get('cashiers')
  getCashiersReport(
    @CurrentBranchId() branchId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getCashiersReport(from, to, branchId)
  }

  @Get('inventory')
  getInventoryReport(
    @CurrentBranchId() branchId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.reportsService.getInventoryReport(branchId, +page, +limit, search)
  }

  @Get('gross-profit')
  getGrossProfitReport(
    @CurrentBranchId() branchId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.reportsService.getGrossProfitReport(from, to, branchId, +page, +limit, search)
  }

  @Get('export/pdf')
  async exportPdf(
    @CurrentBranchId() branchId: number,
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const buffer = await this.reportsService.exportPdf(type, from, to, branchId)
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${type}.pdf"`,
      'Content-Length': buffer.length,
    })
    res!.end(buffer)
  }

  @Get('export/excel')
  async exportExcel(
    @CurrentBranchId() branchId: number,
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.reportsService.exportExcel(type, from, to, branchId)
    res!.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${type}.csv"`,
    })
    res!.send('\uFEFF' + csv) // BOM para Excel
  }
}
