import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  ParseIntPipe, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ProductsService } from './products.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import {
  IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min,
} from 'class-validator'
import { Type } from 'class-transformer'

class CreateProductDto {
  @IsString() sku: string
  @IsOptional() @IsString() barcode?: string
  @IsString() name: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() @Type(() => Number) categoryId?: number
  @IsNumber() @Type(() => Number) costPrice: number
  @IsNumber() @Type(() => Number) salePrice: number
  @IsOptional() @IsNumber() @Type(() => Number) taxRate?: number
  @IsOptional() @IsString() unitType?: string
  @IsOptional() @IsString() imageUrl?: string
  @IsOptional() @IsNumber() @Type(() => Number) initialStock?: number
  @IsOptional() @IsNumber() @Type(() => Number) minStockAlert?: number
}

class UpdateProductDto {
  @IsOptional() @IsString() sku?: string
  @IsOptional() @IsString() barcode?: string
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() @Type(() => Number) categoryId?: number
  @IsOptional() @IsNumber() @Type(() => Number) costPrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) salePrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) taxRate?: number
  @IsOptional() @IsString() unitType?: string
  @IsOptional() @IsString() imageUrl?: string
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @IsNumber() @Type(() => Number) minStockAlert?: number
}

@ApiTags('Productos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.productsService.findAll(
      +page, +limit, search,
      active !== undefined ? active === 'true' : undefined,
    )
  }

  @Get('search')
  search(@Query('q') q = '', @Query('active') active = 'true') {
    return this.productsService.findBySearch(q, active === 'true')
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'supervisor', 'inventario')
  @Post()
  create(@Body() dto: CreateProductDto) {
    dto.taxRate = dto.taxRate ?? 0.15
    return this.productsService.create(dto as any)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'supervisor', 'inventario')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto)
  }

  @UseGuards(RolesGuard)
  @Roles('admin', 'supervisor')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.productsService.remove(id) }

  @UseGuards(RolesGuard)
  @Roles('admin', 'supervisor', 'inventario')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.productsService.importCsv(file)
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.productsService.uploadImage(file)
  }
}
