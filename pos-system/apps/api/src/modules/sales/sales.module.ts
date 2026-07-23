import { Module } from '@nestjs/common'
import { SalesService } from './sales.service'
import { SalesController } from './sales.controller'
import { InventoryModule } from '../inventory/inventory.module'
import { FiscalInvoicingModule } from '../fiscal-invoicing/fiscal-invoicing.module'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [InventoryModule, FiscalInvoicingModule, SettingsModule],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
