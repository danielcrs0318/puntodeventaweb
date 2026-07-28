import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
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

function hasBddEnv(env: NodeJS.ProcessEnv): boolean {
  return [
    'bdduser', 'BDDUSER', 'BDD_USER',
    'bddpassword', 'BDDPASSWORD', 'BDD_PASSWORD',
    'bddname', 'BDDNAME', 'BDD_NAME',
    'bddhost', 'BDDHOST', 'BDD_HOST',
    'bddport', 'BDDPORT', 'BDD_PORT',
    'bddprovider', 'BDDPROVIDER', 'BDD_PROVIDER',
  ].some((key) => typeof env[key] !== 'undefined')
}

/**
 * Aiven y otros managed MySQL usan cadena con CA propia.
 * Prisma + OpenSSL en Render falla con sslaccept=strict / ssl-mode=REQUIRED.
 * Normalizamos a sslaccept=accept_invalid_certs (TLS sigue cifrado).
 */
function normalizeMysqlDatabaseUrl(raw: string): string {
  let url = raw.trim()
  if (!url.toLowerCase().startsWith('mysql')) return url

  // Quitar params incompatibles con el conector Prisma/MySQL
  url = url
    .replace(/([?&])ssl-?mode=[^&]*/gi, '$1')
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?')
    .replace(/&&+/g, '&')

  if (/[?&]sslaccept=/i.test(url)) {
    url = url.replace(/([?&]sslaccept=)[^&]*/gi, '$1accept_invalid_certs')
  } else {
    url += (url.includes('?') ? '&' : '?') + 'sslaccept=accept_invalid_certs'
  }

  return url
}

function buildDatabaseUrl(): string {
  const env = process.env
  if (!hasBddEnv(env) && env.DATABASE_URL && env.DATABASE_URL.trim() !== '') {
    const url = normalizeMysqlDatabaseUrl(env.DATABASE_URL)
    console.log('Prisma database URL:', url.replace(/:[^:@]*@/, ':*****@'))
    return url
  }

  const user = (env.bdduser ?? env.BDDUSER ?? env.BDD_USER ?? 'root').trim()
  const password = (env.bddpassword ?? env.BDDPASSWORD ?? env.BDD_PASSWORD ?? '').trim()
  const name = (env.bddname ?? env.BDDNAME ?? env.BDD_NAME ?? 'posdb').trim()
  const host = (env.bddhost ?? env.BDDHOST ?? env.BDD_HOST ?? 'localhost').trim()
  const port = (env.bddport ?? env.BDDPORT ?? env.BDD_PORT ?? '3306').trim()
  const provider = (env.bddprovider ?? env.BDDPROVIDER ?? env.BDD_PROVIDER ?? 'mysql').trim().toLowerCase()

  const encPass = encodeURIComponent(password)
  const needsSsl =
    (env.BDD_SSL ?? env.bddssl ?? '').toString().toLowerCase() === 'true' ||
    (env.NODE_ENV === 'production' && !host.includes('localhost') && !host.includes('127.0.0.1'))

  let url = provider.includes('postgres') || provider.includes('postgresql')
    ? `postgresql://${user}:${encPass}@${host}:${port}/${name}?schema=public`
    : `mysql://${user}:${encPass}@${host}:${port}/${name}`

  if (!provider.includes('postgres') && needsSsl) {
    url = normalizeMysqlDatabaseUrl(url)
  }

  console.log('Prisma built database URL:', url.replace(/:[^:@]*@/, ':*****@'))
  return url
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = buildDatabaseUrl()
    super({ datasources: { db: { url } } as any })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
