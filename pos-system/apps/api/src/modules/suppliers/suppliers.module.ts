import { Module } from '@nestjs/common'
import { SuppliersService } from './suppliers.service'
import { SuppliersController } from './suppliers.controller'
import { InventoryModule } from '../inventory/inventory.module'

@Module({ imports: [InventoryModule], providers: [SuppliersService], controllers: [SuppliersController], exports: [SuppliersService] })
export class SuppliersModule {}
