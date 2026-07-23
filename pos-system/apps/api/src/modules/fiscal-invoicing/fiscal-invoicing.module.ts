import { Module } from '@nestjs/common'
import { FiscalInvoicingService } from './fiscal-invoicing.service'
import { FiscalInvoicingController } from './fiscal-invoicing.controller'

@Module({ providers: [FiscalInvoicingService], controllers: [FiscalInvoicingController], exports: [FiscalInvoicingService] })
export class FiscalInvoicingModule {}
