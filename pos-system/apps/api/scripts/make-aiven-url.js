/**
 * Genera DATABASE_URL con la contraseña bien encodeada (para pegar en Render).
 *
 * Uso:
 *   node scripts/make-aiven-url.js --user avnadmin --password 'TuClave#Con@Simbolos' --host mysql-xxx.aivencloud.com --port 17003 --db defaultdb
 */
function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const user = arg('user') || 'avnadmin'
const password = arg('password')
const host = arg('host')
const port = arg('port') || '17003'
const db = arg('db') || 'defaultdb'

if (!password || !host) {
  console.error('Faltan --password y/o --host')
  process.exit(1)
}

const url =
  `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${db}` +
  '?sslaccept=accept_invalid_certs'

console.log('\nPega esto como DATABASE_URL en Render:\n')
console.log(url)
console.log('\n(Alternativa más segura: usa DB_USER / DB_PASSWORD / DB_HOST / DB_PORT / DB_NAME sin encodear)\n')
