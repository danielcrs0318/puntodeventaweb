import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SuppliersService } from './suppliers.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional, IsEmail, IsInt, IsNumber, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class CreateSupplierDto {
  @IsString() name: string
  @IsOptional() @IsString() contactName?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() taxId?: string
}
class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() contactName?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() taxId?: string
}

class PurchaseItemDto {
  @IsInt() @Type(() => Number) productId: number
  @IsNumber() @Type(() => Number) quantity: number
  @IsNumber() @Type(() => Number) unitCost: number
}
class CreatePurchaseDto {
  @IsInt() @Type(() => Number) supplierId: number
  @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseItemDto) items: PurchaseItemDto[]
  @IsOptional() @IsString() notes?: string
}

@ApiTags('Proveedores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return this.suppliersService.findAll(active !== undefined ? active === 'true' : undefined)
  }

  @UseGuards(RolesGuard) @Roles('admin', 'supervisor', 'inventario')
  @Post() create(@Body() dto: CreateSupplierDto) { return this.suppliersService.create(dto) }

  @UseGuards(RolesGuard) @Roles('admin', 'supervisor', 'inventario')
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) { return this.suppliersService.update(id, dto) }

  @UseGuards(RolesGuard) @Roles('admin', 'supervisor')
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.suppliersService.remove(id) }

  @Get('purchases')
  getPurchases(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('supplierId') supplierId?: string,
  ) { return this.suppliersService.getPurchases(+page, +limit, supplierId ? +supplierId : undefined) }

  @UseGuards(RolesGuard) @Roles('admin', 'supervisor', 'inventario')
  @Post('purchases')
  createPurchase(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.suppliersService.createPurchase(dto.supplierId, user.id, dto.items, dto.notes)
  }

  @UseGuards(RolesGuard) @Roles('admin', 'supervisor')
  @Patch('purchases/:id/complete')
  completePurchase(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.suppliersService.completePurchase(id, user.id)
  }
}
