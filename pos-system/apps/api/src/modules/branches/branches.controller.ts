import {
  Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Query, UseGuards, UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { BranchesService } from './branches.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { BranchInterceptor } from '../../common/interceptors/branch.interceptor'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'

class CreateBranchDto {
  @IsString() code: string
  @IsString() name: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsBoolean() isMain?: boolean
}

class UpdateBranchDto {
  @IsOptional() @IsString() code?: string
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsBoolean() isActive?: boolean
  @IsOptional() @IsBoolean() isMain?: boolean
}

class SetUserBranchesDto {
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) @Type(() => Number)
  branchIds: number[]
  @IsOptional() @IsInt() @Type(() => Number) defaultBranchId?: number
}

@ApiTags('Sucursales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(BranchInterceptor)
@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get('mine')
  async mine(@CurrentUser() user: any) {
    if (user.role.name === 'admin') {
      const all = await this.branchesService.findAll(true)
      return all.map((b) => ({ ...b, isDefault: b.isMain }))
    }
    return this.branchesService.getUserBranches(user.id)
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Get()
  findAll(@Query('active') active?: string) {
    return this.branchesService.findAll(active === 'true')
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Get('users/:userId')
  userBranches(@Param('userId', ParseIntPipe) userId: number) {
    return this.branchesService.getUserBranches(userId)
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Post('users/:userId/assign')
  assignUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetUserBranchesDto,
  ) {
    return this.branchesService.setUserBranches(userId, dto.branchIds, dto.defaultBranchId)
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto)
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.findOne(id)
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto)
  }
}
