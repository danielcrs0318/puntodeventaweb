/**
 * Normaliza DATABASE_URL de MySQL (Aiven) o la arma desde DB_* para Prisma CLI / seed.
 * Uso: node scripts/with-normalized-db-url.js <comando...>
 */
const { spawnSync } = require('child_process')

function stripWrappingQuotes(value) {
  const v = String(value || '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim()
  }
  return v
}

function normalizeMysqlDatabaseUrl(raw) {
  let url = stripWrappingQuotes(raw)
  if (!url.toLowerCase().startsWith('mysql')) return url

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

function buildFromParts() {
  const user = (process.env.DB_USER || process.env.MYSQL_USER || '').trim()
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD
  const host = (process.env.DB_HOST || process.env.MYSQL_HOST || '').trim()
  const port = (process.env.DB_PORT || process.env.MYSQL_PORT || '3306').trim()
  const name = (process.env.DB_NAME || process.env.MYSQL_DATABASE || 'defaultdb').trim()

  if (!user || password === undefined || !host) return null
  return normalizeMysqlDatabaseUrl(
    `mysql://${user}:${encodeURIComponent(String(password))}@${host}:${port}/${name}`,
  )
}

const fromParts = buildFromParts()
if (fromParts && (process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD)) {
  process.env.DATABASE_URL = fromParts
  console.log('DATABASE_URL armado desde DB_*:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':*****@'))
} else if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeMysqlDatabaseUrl(process.env.DATABASE_URL)
  console.log('DATABASE_URL normalizado:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':*****@'))
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Uso: node scripts/with-normalized-db-url.js <comando> [args...]')
  process.exit(1)
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
