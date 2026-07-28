/**
 * Arranque en Render: arma/normaliza DATABASE_URL (Aiven), prisma db push, Nest.
 *
 * Opciones de env (elige una):
 * A) DATABASE_URL=mysql://user:ENCODED_PASS@host:port/db
 * B) DB_USER + DB_PASSWORD (cruda) + DB_HOST + DB_PORT + DB_NAME  ← recomendado si la clave tiene # @ % &
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
} else {
  console.error('Falta DATABASE_URL o DB_USER + DB_PASSWORD + DB_HOST')
  process.exit(1)
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: true })
  if (result.status !== 0) {
    console.error(`Comando falló (${cmd} ${args.join(' ')}) con código ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

run('npx', ['prisma', 'db', 'push'])
run('node', ['dist/src/main.js'])
