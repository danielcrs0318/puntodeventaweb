import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { IsString, IsEmail, IsOptional, IsInt, IsBoolean, MinLength, IsArray, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'

class CreateUserDto {
  @IsString() name: string
  @IsEmail() email: string
  @IsString() @MinLength(8) password: string
  @IsInt() @Type(() => Number) roleId: number
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) @Type(() => Number)
  branchIds?: number[]
  @IsOptional() @IsInt() @Type(() => Number) defaultBranchId?: number
}
class UpdateUserDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() @MinLength(8) password?: string
  @IsOptional() @IsInt() @Type(() => Number) roleId?: number
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) @Type(() => Number)
  branchIds?: number[]
  @IsOptional() @IsInt() @Type(() => Number) defaultBranchId?: number
}

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Roles('admin', 'supervisor')
  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.usersService.findAll(
      +page,
      +limit,
      search,
      active !== undefined ? active === 'true' : undefined,
    )
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto) }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto)
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.usersService.remove(id) }
}
