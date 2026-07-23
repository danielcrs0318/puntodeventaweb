import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CategoriesService } from './categories.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { IsString, IsOptional, IsBoolean } from 'class-validator'

class CreateCategoryDto {
  @IsString() name: string
  @IsOptional() @IsString() description?: string
}
class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsBoolean() isActive?: boolean
}

@ApiTags('Categorías')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return this.categoriesService.findAll(active !== undefined ? active === 'true' : undefined)
  }
  @Post() create(@Body() dto: CreateCategoryDto) { return this.categoriesService.create(dto) }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) { return this.categoriesService.update(id, dto) }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.categoriesService.remove(id) }
}
