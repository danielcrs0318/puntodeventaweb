import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { join } from 'path'
import * as fs from 'fs'
import type { NestExpressApplication } from '@nestjs/platform-express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const isProd = process.env.NODE_ENV === 'production'
  const logger = new Logger('Bootstrap')

  // Detrás de nginx / load balancer
  app.set('trust proxy', 1)

  // Cabeceras de seguridad básicas (sin dependencia extra)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (_req.path.startsWith('/uploads/')) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    }
    if (isProd) {
      res.setHeader('X-DNS-Prefetch-Control', 'off')
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    }
    next()
  })

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
    ...(isProd
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
        ]),
  ]
    .flatMap((value) => value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [])
    .filter(Boolean)

  if (isProd && allowedOrigins.length === 0) {
    throw new Error('FRONTEND_URL o FRONTEND_URLS es obligatorio en producción (CORS)')
  }

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

  app.setGlobalPrefix('', { exclude: ['/'] })

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: isProd,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }))

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new LoggingInterceptor())

  const uploadsDir = join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('POS Honduras API')
      .setDescription('API del sistema de punto de venta')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api-docs', app, document)
  }

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  logger.log(`POS API corriendo en puerto ${port} (${isProd ? 'production' : 'development'})`)
  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    logger.log(`Swagger: http://localhost:${port}/api-docs`)
  }
}

bootstrap()
