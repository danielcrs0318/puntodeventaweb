# pos-system

Monorepo del POS Honduras.

## Apps

| App | Carpeta | Puerto | Comando |
|-----|---------|--------|---------|
| API (NestJS) | `apps/api` | 3001 | `npm run start:dev` |
| Web (React + Vite) | `apps/web` | 3000 | `npm run dev` |

## Primer arranque

Sigue la guía completa en la raíz del repo: [README.md](../README.md).

Resumen (desarrollo local):

1. Copia `apps/api/.env.example` → `apps/api/.env.development` y configura MySQL + JWT (+ Resend si aplica).
2. En `apps/api`: `npm install` → `npx prisma db push` → `npx prisma db seed` → `npm run start:dev`
3. En `apps/web`: `npm install` → `npm run dev`

Producción (Vercel + Render + Aiven, **sin** datos de ejemplo):

Ver [deploy/PRODUCTION.md](./deploy/PRODUCTION.md). Usa `npm run prisma:seed:prod` (no `prisma db seed`).

### Cloudflare R2 (imágenes)

Guía paso a paso para obtener Account ID, bucket, URL pública y API tokens:

- Raíz del repo: [README.md — Cloudflare R2](../README.md#cloudflare-r2-imágenes-en-producción)
- Despliegue: [deploy/PRODUCTION.md](./deploy/PRODUCTION.md#cloudflare-r2-imágenes--cómo-obtener-las-keys)

Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (ver también `apps/api/.env.example`).

## Documentación de producto

[AGENT_INSTRUCTIONS_POS.md](../AGENT_INSTRUCTIONS_POS.md)
