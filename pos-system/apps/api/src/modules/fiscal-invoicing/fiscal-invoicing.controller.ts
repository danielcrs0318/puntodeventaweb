import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { FiscalInvoicingService } from './fiscal-invoicing.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentBranchId } from '../../common/decorators/current-branch.decorator'
import { IsString, IsInt, IsOptional, IsBoolean, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'

class CreateCaiRangeDto {
  @IsString() caiCode: string
  @IsString() documentType: string
  @IsString() branchOfficeCode: string
  @IsString() posCode: string
  @IsInt() @Type(() => Number) rangeStart: number
  @IsInt() @Type(() => Number) rangeEnd: number
  @IsDateString() authorizationDate: string
  @IsDateString() expirationDate: string
  @IsOptional() @IsInt() @Type(() => Number) branchId?: number
}
class UpdateCaiRangeDto {
  @IsOptional() @IsString() caiCode?: string
  @IsOptional() @IsString() documentType?: string
  @IsOptional() @IsString() branchOfficeCode?: string
  @IsOptional() @IsString() posCode?: string
  @IsOptional() @IsInt() @Type(() => Number) rangeStart?: number
  @IsOptional() @IsInt() @Type(() => Number) rangeEnd?: number
  @IsOptional() @IsDateString() authorizationDate?: string
  @IsOptional() @IsDateString() expirationDate?: string
  @IsOptional() @IsBoolean() isActive?: boolean
}

@ApiTags('Facturación Fiscal CAI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'supervisor')
@Controller('fiscal')
export class FiscalInvoicingController {
  constructor(private fiscalInvoicingService: FiscalInvoicingService) {}

  @Get('cai-ranges') getCaiRanges() { return this.fiscalInvoicingService.getCaiRanges() }

  @Post('cai-ranges') createCaiRange(
    @Body() dto: CreateCaiRangeDto,
    @CurrentBranchId() activeBranchId: number,
  ) {
    return this.fiscalInvoicingService.createCaiRange({
      ...dto,
      branchId: dto.branchId ?? activeBranchId,
    })
  }

  @Patch('cai-ranges/:id') updateCaiRange(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCaiRangeDto,
  ) { return this.fiscalInvoicingService.updateCaiRange(id, dto) }

  @Delete('cai-ranges/:id') deleteCaiRange(@Param('id', ParseIntPipe) id: number) {
    return this.fiscalInvoicingService.deleteCaiRange(id)
  }

  @Get('report') getReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.fiscalInvoicingService.getReport(from, to)
  }
}
