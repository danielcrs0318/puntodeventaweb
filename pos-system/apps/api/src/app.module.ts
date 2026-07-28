import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { MulterModule } from '@nestjs/platform-express'
import { ServeStaticModule } from '@nestjs/serve-static'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { join, extname } from 'path'
import { diskStorage } from 'multer'
import { v4 as uuidv4 } from 'uuid'

import { AppController } from './app.controller'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { RolesModule } from './modules/roles/roles.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { ProductsModule } from './modules/products/products.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { CustomersModule } from './modules/customers/customers.module'
import { SuppliersModule } from './modules/suppliers/suppliers.module'
import { SalesModule } from './modules/sales/sales.module'
import { CashRegisterModule } from './modules/cash-register/cash-register.module'
import { FiscalInvoicingModule } from './modules/fiscal-invoicing/fiscal-invoicing.module'
import { ReportsModule } from './modules/reports/reports.module'
import { SettingsModule } from './modules/settings/settings.module'
import { MailModule } from './modules/mail/mail.module'
import { AuditModule } from './modules/audit/audit.module'
import { BranchesModule } from './modules/branches/branches.module'
import { BranchInterceptor } from './common/interceptors/branch.interceptor'

const uploadsDir = join(process.cwd(), 'uploads')
const nodeEnv = process.env.NODE_ENV ?? 'development'
const envFiles = [
  `.env.${nodeEnv}`,
  '.env.development',
  '.env',
]

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: envFiles }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 60 },
      { name: 'medium', ttl: 600_000, limit: 600 },
    ]),
    ServeStaticModule.forRoot({ rootPath: uploadsDir, serveRoot: '/uploads' }),
    MulterModule.register({
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    PrismaModule,
    MailModule,
    BranchesModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SuppliersModule,
    SalesModule,
    CashRegisterModule,
    FiscalInvoicingModule,
    ReportsModule,
    SettingsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: BranchInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
