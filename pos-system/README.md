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

## Documentación de producto

[AGENT_INSTRUCTIONS_POS.md](../AGENT_INSTRUCTIONS_POS.md)
