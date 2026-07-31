# Despliegue producción — Vercel (web) + Render (API) + Aiven (MySQL)

## Resumen

| Pieza | Servicio | Carpeta |
|-------|----------|---------|
| Frontend | [Vercel](https://vercel.com) | `pos-system/apps/web` |
| Backend | [Render](https://render.com) | `pos-system/apps/api` |
| Base de datos | [Aiven MySQL](https://aiven.io) | — |

No uses `npm run prisma:seed` en producción (crea productos/categorías de ejemplo).
Usa solo `npm run prisma:seed:prod` una vez para crear permisos, roles y el admin.

---

## 1. Aiven (MySQL)

1. Crea un servicio MySQL (o usa el que ya tienes).
2. Copia la **Service URI** y adapta el query string para Prisma:

```text
mysql://USER:PASSWORD@HOST:PORT/DATABASE?sslaccept=accept_invalid_certs
```

Importante: Aiven usa su propia CA. Con `sslaccept=strict` o `ssl-mode=REQUIRED` Prisma falla en Render (`certificate verify failed`). Usa `sslaccept=accept_invalid_certs` (la conexión sigue cifrada). El API también normaliza la URL al arrancar.

3. Guarda esa URL como `DATABASE_URL` (la usarás en Render y al correr el seed local).

---

## 2. Bootstrap de BD (solo admin, sin datos de ejemplo)

Desde tu máquina, con la URL de Aiven:

```bash
cd pos-system/apps/api
npm install

# Windows PowerShell
$env:DATABASE_URL="mysql://USER:PASS@HOST:PORT/DB?sslaccept=accept_invalid_certs"
$env:ADMIN_EMAIL="tu@correo.com"
$env:ADMIN_PASSWORD="ClaveSeguraLarga!"
$env:ADMIN_NAME="Administrador"
$env:BUSINESS_NAME="Nombre de tu negocio"

npx prisma db push
npm run prisma:seed:prod
```

```bash
# Linux / macOS
export DATABASE_URL="mysql://USER:PASS@HOST:PORT/DB?sslaccept=accept_invalid_certs"
export ADMIN_EMAIL="tu@correo.com"
export ADMIN_PASSWORD="ClaveSeguraLarga!"
npx prisma db push
npm run prisma:seed:prod
```

Qué crea: sucursal `MATRIZ`, permisos, roles, settings e usuario admin.
Qué **no** crea: categorías, productos ni proveedores de demo.

Si el admin ya existe, no se sobrescribe la contraseña.

---

## 3. Backend en Render

### Opción A — Blueprint

1. En Render: **New → Blueprint** y selecciona este repo (`render.yaml` en la raíz).
2. Completa las variables marcadas como `sync: false`.

### Opción B — Web Service manual

| Campo | Valor |
|-------|--------|
| Root Directory | `pos-system/apps/api` |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start Command | `npm run start:render` |
| Health Check Path | `/health` |

### Variables de entorno (Render)

| Variable | Ejemplo / notas |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URI de Aiven. Si la clave tiene `# @ % & +`, mejor usa `DB_*` (abajo) |
| `DB_USER` | `avnadmin` (alternativa a URI) |
| `DB_PASSWORD` | Contraseña **cruda** de Aiven (sin encodear) |
| `DB_HOST` | `mysql-….aivencloud.com` |
| `DB_PORT` | Puerto de Aiven (ej. `17003`) |
| `DB_NAME` | `defaultdb` |
| `JWT_SECRET` | Aleatorio ≥ 24 caracteres (Render puede generarlo) |
| `FRONTEND_URL` | `https://tu-app.vercel.app` (sin barra final) |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `RESEND_API_KEY` | Opcional; necesario para reset de clave / correos |
| `RESEND_FROM` | Ej. `POS <noreply@tudominio.com>` |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | API Token R2 |
| `R2_SECRET_ACCESS_KEY` | Secret del token |
| `R2_BUCKET_NAME` | Nombre del bucket |
| `R2_PUBLIC_URL` | URL pública (`https://pub-xxx.r2.dev` o dominio custom), sin `/` final |

### Cloudflare R2 (imágenes) — cómo obtener las keys

Las fotos de productos y el logo se suben a R2. Sin `R2_*`, el API usa disco local `/uploads` (efímero en Render).

#### Paso a paso

1. **Account ID**
   - Entra a [dash.cloudflare.com](https://dash.cloudflare.com)
   - Menú → **R2 Object Storage**
   - Copia **Account ID** → `R2_ACCOUNT_ID`

2. **Crear el bucket**
   - R2 → **Create bucket**
   - Nombre, ej. `pos-images` → `R2_BUCKET_NAME`
   - Create bucket

3. **Acceso público (URL de las imágenes)**
   - Abre el bucket → pestaña **Settings**
   - **Public access** → Allow Access / enable **R2.dev subdomain**
   - Copia la URL tipo `https://pub-xxxxxxxx.r2.dev` → `R2_PUBLIC_URL` (**sin** barra final)
   - (Opcional) puedes usar un custom domain en lugar del subdominio R2.dev

4. **Access Key y Secret Key**
   - En R2 → **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Apply to specific buckets: elige `pos-images` (o All buckets)
   - Create → copia de inmediato (el secret solo se muestra una vez):
     - **Access Key ID** → `R2_ACCESS_KEY_ID`
     - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

5. **Pegar en Render** las cinco variables `R2_*` y hacer **Manual Deploy**

En los logs del API debe aparecer: `Almacenamiento de imágenes: Cloudflare R2 (bucket=...)`.

Las URLs se guardan absolutas en BD (`https://pub-xxx.r2.dev/products/...` o `/logos/...`). En desarrollo local, sin R2, sigue usando `/uploads`.

Tras el deploy anota la URL pública del API, p. ej. `https://pos-honduras-api.onrender.com`.

---

## 4. Frontend en Vercel

1. **Add New Project** → este repo.
2. Configuración:

| Campo | Valor |
|-------|--------|
| Root Directory | `pos-system/apps/web` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

3. Environment Variables:

| Variable | Valor |
|----------|--------|
| `VITE_API_BASE_URL` | `https://pos-honduras-api.onrender.com` (tu URL de Render, **sin** `/api`) |

4. Deploy. Anota la URL (`https://xxx.vercel.app`).

5. Vuelve a Render y pon `FRONTEND_URL` = esa URL de Vercel (CORS). Redeploy el API si hace falta.

`vercel.json` ya incluye rewrite SPA para React Router.

---

## 5. Checklist post-despliegue

1. Abre `https://tu-api.onrender.com/health` → `{ "status": "ok", ... }`
2. Login en Vercel con el admin del seed de producción
3. Cambia la contraseña del admin desde el sistema
4. Crea categorías/productos reales (no hay demo)
5. Prueba: abrir caja → venta → recibo
6. Si usas correos: configura Resend + dominio verificado

---

## Orden recomendado

```text
Aiven (URI) → prisma db push + seed:prod → Cloudflare R2 (keys) → Render (API + R2_*) → Vercel (web + VITE_API_BASE_URL) → FRONTEND_URL en Render
```
