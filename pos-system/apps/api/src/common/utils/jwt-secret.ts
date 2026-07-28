import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const WEAK_SECRETS = new Set(['dev_secret', 'secret', 'changeme', 'jwt_secret'])

/**
 * Resuelve JWT_SECRET. En producción exige un secreto fuerte.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = (config.get<string>('JWT_SECRET') ?? '').trim()
  const isProd = (config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production'
  const weak =
    !secret ||
    WEAK_SECRETS.has(secret.toLowerCase()) ||
    secret.toLowerCase().includes('cambia_este') ||
    secret.length < 24

  if (isProd && weak) {
    throw new Error(
      'JWT_SECRET inválido o ausente. En producción debe ser un secreto aleatorio de al menos 24 caracteres.',
    )
  }

  if (!isProd && weak) {
    Logger.warn(
      'JWT_SECRET débil o por defecto. No uses este valor en producción.',
      'JwtConfig',
    )
    return secret || 'dev_secret'
  }

  return secret
}
