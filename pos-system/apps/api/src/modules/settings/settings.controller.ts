import { Controller, Get, Patch, Post, Body, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import type { Response } from 'express'
import { SettingsService } from './settings.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { imageFileFilter } from '../../common/utils/image-file-filter'
import { IsOptional, IsString, IsBoolean, IsNumber, IsEmail } from 'class-validator'
import { Type } from 'class-transformer'

class UpdateSettingsDto {
  @IsOptional() @IsString() businessName?: string
  @IsOptional() @IsString() taxId?: string
  @IsOptional() @IsString() currency?: string
  @IsOptional() @IsString() currencySymbol?: string
  @IsOptional() @IsNumber() @Type(() => Number) taxRateDefault?: number
  @IsOptional() @IsString() invoiceFooterText?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsBoolean() fiscalInvoicingEnabled?: boolean
  @IsOptional() @IsNumber() @Type(() => Number) lowStockThreshold?: number
  @IsOptional() @IsNumber() @Type(() => Number) caiAlertThreshold?: number
  @IsOptional() @IsNumber() @Type(() => Number) caiDaysAlertThreshold?: number
}

@ApiTags('Configuración')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get() get() { return this.settingsService.get() }

  @UseGuards(RolesGuard) @Roles('admin')
  @Patch() update(@Body() dto: UpdateSettingsDto) { return this.settingsService.update(dto) }

  @UseGuards(RolesGuard) @Roles('admin')
  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { fileFilter: imageFileFilter }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    const url = `/uploads/${file.filename}`
    await this.settingsService.update({ businessLogo: url })
    return { url }
  }

  @UseGuards(RolesGuard) @Roles('admin')
  @Get('backup')
  async exportBackup(@Res() res: Response) {
    const backup = await this.settingsService.exportBackup()
    const filename = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
    res.send(JSON.stringify(backup, null, 2))
  }
}
