import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { InventoryService } from './inventory.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, IsNumber, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'

class AdjustInventoryDto {
  @IsInt() @Type(() => Number) productId: number
  @IsNumber() @Type(() => Number) @Min(0) quantity: number
  @IsString() reason: string
}

@ApiTags('Inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  getStock() { return this.inventoryService.getStock() }

  @Get('movements')
  getMovements(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('productId') productId?: string,
  ) {
    return this.inventoryService.getMovements(+page, +limit, productId ? +productId : undefined)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'supervisor', 'inventario')
  @Post('adjust')
  adjust(@Body() dto: AdjustInventoryDto, @CurrentUser() user: any) {
    return this.inventoryService.adjust(dto.productId, dto.quantity, dto.reason, user.id)
  }
}
