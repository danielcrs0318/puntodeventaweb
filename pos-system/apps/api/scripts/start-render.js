/**
 * Arranque en Render: normaliza DATABASE_URL (Aiven), sincroniza schema y levanta Nest.
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

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npx', ['prisma', 'db', 'push'])
run('node', ['dist/src/main.js'])
