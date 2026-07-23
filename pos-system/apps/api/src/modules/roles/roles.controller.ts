import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { RolesService } from './roles.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}
  @Get() findAll() { return this.rolesService.findAll() }
}
