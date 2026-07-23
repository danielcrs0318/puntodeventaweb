import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { join } from 'path'
import * as fs from 'fs'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ]
    .flatMap((value) => value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [])
    .filter(Boolean)

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  })

  // Global prefix
  app.setGlobalPrefix('', { exclude: ['/'] })

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }))

  // Global exception filter + request logging
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new LoggingInterceptor())

  // Asegurar carpeta uploads
  const uploadsDir = join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('POS Honduras API')
    .setDescription('API del sistema de punto de venta')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api-docs', app, document)

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`POS API corriendo en: http://localhost:${port}`)
  console.log(`Swagger: http://localhost:${port}/api-docs`)
}

bootstrap()
