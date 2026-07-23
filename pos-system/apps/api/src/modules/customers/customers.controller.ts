import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CustomersService } from './customers.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { IsString, IsOptional, IsEmail, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

class CreateCustomerDto {
  @IsString() name: string
  @IsOptional() @IsString() identificationNumber?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsNumber() @Type(() => Number) creditLimit?: number
}
class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() identificationNumber?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsNumber() @Type(() => Number) creditLimit?: number
}

@ApiTags('Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) { return this.customersService.findAll(+page, +limit, search) }

  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit = '10') {
    return this.customersService.search(q, +limit)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.customersService.findOne(id) }

  @Get(':id/sales')
  getSales(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) { return this.customersService.getSales(id, +page, +limit) }

  @Post()
  create(@Body() dto: CreateCustomerDto) { return this.customersService.create(dto) }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.customersService.remove(id) }
}
