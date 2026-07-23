import { Controller, Get, Post, Body, Query, Param, ParseIntPipe, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import type { Response } from 'express'
import { CashRegisterService } from './cash-register.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, IsNumber, IsString, IsEnum, Min } from 'class-validator'
import { Type } from 'class-transformer'

class OpenSessionDto {
  @IsNumber() @Type(() => Number) @Min(0) openingAmount: number
}
class CloseSessionDto {
  @IsNumber() @Type(() => Number) @Min(0) closingAmount: number
}
class AddMovementDto {
  @IsInt() @Type(() => Number) sessionId: number
  @IsEnum(['INGRESO', 'EGRESO']) type: 'INGRESO' | 'EGRESO'
  @IsNumber() @Type(() => Number) @Min(0.01) amount: number
  @IsString() reason: string
}

@ApiTags('Caja Registradora')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cash-register')
export class CashRegisterController {
  constructor(private cashRegisterService: CashRegisterService) {}

  @Get('active-session')
  getActiveSession(@CurrentUser() user: any) {
    return this.cashRegisterService.getActiveSession(user.id)
  }

  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  open(@Body() dto: OpenSessionDto, @CurrentUser() user: any) {
    return this.cashRegisterService.openSession(user.id, dto.openingAmount)
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  close(@Body() dto: CloseSessionDto, @CurrentUser() user: any) {
    return this.cashRegisterService.closeSession(user.id, dto.closingAmount)
  }

  @Get('movements')
  getMovements(@Query('sessionId') sessionId: string) {
    return this.cashRegisterService.getMovements(+sessionId)
  }

  @Post('movements')
  addMovement(@Body() dto: AddMovementDto, @CurrentUser() user: any) {
    return this.cashRegisterService.addMovement(dto.sessionId, user.id, dto.type, dto.amount, dto.reason)
  }

  @Get('sessions')
  getSessions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('userId') userId?: string,
  ) { return this.cashRegisterService.getSessions(+page, +limit, userId ? +userId : undefined) }

  @Get('sessions/:id/close-report')
  async closeReport(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdf = await this.cashRegisterService.generateCloseReport(id)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cierre-caja-${id}.pdf"`,
      'Content-Length': pdf.length,
    })
    res.end(pdf)
  }
}
