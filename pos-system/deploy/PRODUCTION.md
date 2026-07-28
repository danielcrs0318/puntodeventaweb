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
mysql://USER:PASSWORD@HOST:PORT/DATABASE?sslaccept=strict
```

Importante: Aiven exige SSL. Sin `?sslaccept=strict` Prisma suele fallar al conectar.

3. Guarda esa URL como `DATABASE_URL` (la usarás en Render y al correr el seed local).

---

## 2. Bootstrap de BD (solo admin, sin datos de ejemplo)

Desde tu máquina, con la URL de Aiven:

```bash
cd pos-system/apps/api
npm install

# Windows PowerShell
$env:DATABASE_URL="mysql://USER:PASS@HOST:PORT/DB?sslaccept=strict"
$env:ADMIN_EMAIL="tu@correo.com"
$env:ADMIN_PASSWORD="ClaveSeguraLarga!"
$env:ADMIN_NAME="Administrador"
$env:BUSINESS_NAME="Nombre de tu negocio"

npx prisma db push
npm run prisma:seed:prod
```

```bash
# Linux / macOS
export DATABASE_URL="mysql://USER:PASS@HOST:PORT/DB?sslaccept=strict"
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
| Start Command | `npx prisma db push && npm run start:prod` |
| Health Check Path | `/health` |

### Variables de entorno (Render)

| Variable | Ejemplo / notas |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URI de Aiven con `?sslaccept=strict` |
| `JWT_SECRET` | Aleatorio ≥ 24 caracteres (Render puede generarlo) |
| `FRONTEND_URL` | `https://tu-app.vercel.app` (sin barra final) |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `RESEND_API_KEY` | Opcional; necesario para reset de clave / correos |
| `RESEND_FROM` | Ej. `POS <noreply@tudominio.com>` |

Tras el deploy anota la URL pública, p. ej. `https://pos-honduras-api.onrender.com`.

**Uploads:** el disco de Render (plan free) es efímero; logos/fotos de producto se pierden al redeploy. Para producción seria, usa un disco persistente o almacenamiento S3.

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
Aiven (URI) → prisma db push + seed:prod → Render (API) → Vercel (web + VITE_API_BASE_URL) → FRONTEND_URL en Render
```
