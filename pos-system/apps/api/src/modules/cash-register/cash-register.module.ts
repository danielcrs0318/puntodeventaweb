import { Module } from '@nestjs/common'
import { CashRegisterService } from './cash-register.service'
import { CashRegisterController } from './cash-register.controller'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  providers: [CashRegisterService],
  controllers: [CashRegisterController],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
