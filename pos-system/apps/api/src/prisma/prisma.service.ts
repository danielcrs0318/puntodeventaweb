import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const envFileName = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env'
const envFilePath = path.resolve(process.cwd(), envFileName)
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath })
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
}

const logger = new Logger('PrismaConfig')

function stripWrappingQuotes(value: string): string {
  const v = value.trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).trim()
  }
  return v
}

/**
 * Aiven / managed MySQL: Prisma en Render falla con sslaccept=strict o ssl-mode=REQUIRED.
 * TLS sigue activo; solo se acepta la CA del proveedor.
 */
function normalizeMysqlDatabaseUrl(raw: string): string {
  let url = stripWrappingQuotes(raw)
  if (!url.toLowerCase().startsWith('mysql')) return url

  url = url
    .replace(/([?&])ssl-?mode=[^&]*/gi, '$1')
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?')
    .replace(/&&+/g, '&')

  // MySQL local suele escuchar sin TLS. Forzar sslaccept aquí impide conectar
  // aunque el servicio esté activo (P1011 en Windows).
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) return url
  } catch {
    // Prisma mostrará el error de URL si la cadena no es válida.
  }

  if (/[?&]sslaccept=/i.test(url)) {
    url = url.replace(/([?&]sslaccept=)[^&]*/gi, '$1accept_invalid_certs')
  } else {
    url += (url.includes('?') ? '&' : '?') + 'sslaccept=accept_invalid_certs'
  }

  return url
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:[^:@/?#]*@/, ':*****@')
}

function buildFromParts(env: NodeJS.ProcessEnv): string | null {
  const user = (env.DB_USER ?? env.MYSQL_USER ?? env.bdduser ?? env.BDDUSER ?? env.BDD_USER)?.trim()
  const password = env.DB_PASSWORD ?? env.MYSQL_PASSWORD ?? env.bddpassword ?? env.BDDPASSWORD ?? env.BDD_PASSWORD
  const host = (env.DB_HOST ?? env.MYSQL_HOST ?? env.bddhost ?? env.BDDHOST ?? env.BDD_HOST)?.trim()
  const port = (env.DB_PORT ?? env.MYSQL_PORT ?? env.bddport ?? env.BDDPORT ?? env.BDD_PORT ?? '3306').trim()
  const name = (env.DB_NAME ?? env.MYSQL_DATABASE ?? env.bddname ?? env.BDDNAME ?? env.BDD_NAME ?? 'defaultdb').trim()
  const provider = (env.bddprovider ?? env.BDDPROVIDER ?? env.BDD_PROVIDER ?? 'mysql').trim().toLowerCase()

  if (!user || password === undefined || !host) return null

  const encPass = encodeURIComponent(String(password))
  if (provider.includes('postgres')) {
    return `postgresql://${user}:${encPass}@${host}:${port}/${name}?schema=public`
  }

  return normalizeMysqlDatabaseUrl(`mysql://${user}:${encPass}@${host}:${port}/${name}`)
}

function buildDatabaseUrl(): string {
  const env = process.env

  // 1) Preferir partes sueltas: la contraseña se encodea bien (evita fallos por # @ % &)
  const fromParts = buildFromParts(env)
  const preferParts = (env.DB_PREFER_PARTS ?? '').toLowerCase() === 'true' || Boolean(env.DB_PASSWORD || env.MYSQL_PASSWORD)

  if (preferParts && fromParts) {
    logger.log(`Prisma URL (desde DB_*): ${maskDatabaseUrl(fromParts)}`)
    return fromParts
  }

  // 2) DATABASE_URL completo (normalizado)
  if (env.DATABASE_URL && env.DATABASE_URL.trim() !== '') {
    const url = normalizeMysqlDatabaseUrl(env.DATABASE_URL)
    logger.log(`Prisma URL (DATABASE_URL): ${maskDatabaseUrl(url)}`)
    return url
  }

  // 3) Fallback bdd* locales
  if (fromParts) {
    logger.log(`Prisma URL (bdd*): ${maskDatabaseUrl(fromParts)}`)
    return fromParts
  }

  throw new Error(
    'Falta configuración de base de datos. Define DATABASE_URL o DB_USER + DB_PASSWORD + DB_HOST (+ DB_PORT + DB_NAME).',
  )
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = buildDatabaseUrl()
    // Mantener process.env alineado para Prisma CLI / engines
    process.env.DATABASE_URL = url
    super({ datasources: { db: { url } } as any })
  }

  async onModuleInit() {
    try {
      await this.$connect()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Authentication failed') || message.includes('P1000')) {
        logger.error(
          'Auth MySQL falló (P1000). Revisa usuario/contraseña en Render. ' +
            'Si la clave tiene # @ % & +, usa DB_USER/DB_PASSWORD/DB_HOST (sin encodear) ' +
            'o encodea la clave en DATABASE_URL (encodeURIComponent). ' +
            'Start Command debe ser: npm run start:render',
        )
      }
      throw err
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
