import {
  Controller, Get, Post, Body, Param, Query, ParseIntPipe,
  UseGuards, Res, HttpCode, HttpStatus,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SalesService } from './sales.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import {
  IsInt, IsOptional, IsString, IsArray, ValidateNested, IsNumber, IsEnum,
} from 'class-validator'
import { Type } from 'class-transformer'

class SaleItemDto {
  @IsInt() @Type(() => Number) productId: number
  @IsNumber() @Type(() => Number) quantity: number
  @IsNumber() @Type(() => Number) unitPrice: number
  @IsNumber() @Type(() => Number) discount: number
}
class SalePaymentDto {
  @IsString() method: string
  @IsNumber() @Type(() => Number) amount: number
}
class CreateSaleDto {
  @IsOptional() @IsInt() @Type(() => Number) customerId?: number
  @IsInt() @Type(() => Number) cashRegisterSessionId: number
  @IsString() paymentMethod: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => SalePaymentDto) payments: SalePaymentDto[]
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[]
  @IsOptional() @IsString() notes?: string
}
class VoidSaleDto {
  @IsString() reason: string
}
class SendReceiptDto {
  @IsOptional() @IsString() email?: string
}
class ReturnItemDto {
  @IsInt() @Type(() => Number) productId: number
  @IsNumber() @Type(() => Number) quantity: number
}
class ReturnSaleDto {
  @IsString() reason: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReturnItemDto) items: ReturnItemDto[]
}

@ApiTags('Ventas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.salesService.findAll({
      page: +page, limit: +limit, from, to,
      userId: userId ? +userId : undefined,
      customerId: customerId ? +customerId : undefined,
      status, paymentMethod,
    })
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.salesService.findOne(id) }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    return this.salesService.create(dto, user.id)
  }

  @UseGuards(RolesGuard) @Roles('admin', 'supervisor')
  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  voidSale(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidSaleDto,
    @CurrentUser() user: any,
  ) { return this.salesService.voidSale(id, dto.reason, user) }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  returnSale(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReturnSaleDto,
    @CurrentUser() user: any,
  ) {
    return this.salesService.returnItems(id, dto.items, dto.reason, user)
  }

  @Post(':id/send-receipt')
  @HttpCode(HttpStatus.OK)
  sendReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendReceiptDto,
  ) {
    return this.salesService.sendReceiptByEmail(id, dto.email)
  }

  @Get(':id/receipt')
  async generateReceipt(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const buffer = await this.salesService.generateReceipt(id)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo-${id}.pdf"`,
      'Content-Length': buffer.length,
    })
    res.end(buffer)
  }
}
