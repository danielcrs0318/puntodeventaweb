/**
 * Normaliza DATABASE_URL de MySQL (Aiven) para Prisma en Render/CLI.
 * Uso: node scripts/with-normalized-db-url.js <comando...>
 */
const { spawnSync } = require('child_process')

function normalizeMysqlDatabaseUrl(raw) {
  let url = String(raw || '').trim()
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

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizeMysqlDatabaseUrl(process.env.DATABASE_URL)
  console.log(
    'DATABASE_URL normalizado:',
    process.env.DATABASE_URL.replace(/:[^:@]*@/, ':*****@'),
  )
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
