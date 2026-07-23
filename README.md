# POS Honduras — Punto de Venta Web

Sistema de punto de venta (POS) para retail en Honduras. Incluye ventas en mostrador, inventario, caja, clientes, proveedores, reportes, auditoría y facturación fiscal CAI opcional.

**Stack:** NestJS + Prisma + MySQL (API) · React + Vite + Tailwind (web) · Resend (correos)

---

## Requisitos previos

Antes de clonar e instalar, asegúrate de tener:

| Herramienta | Versión recomendada |
|-------------|---------------------|
| [Node.js](https://nodejs.org/) | LTS (18 o superior) |
| npm | Viene con Node |
| [MySQL](https://dev.mysql.com/) | 8.x en ejecución |

Opcional para correos reales: cuenta en [Resend](https://resend.com) y una API key.

---

## Cómo empezar (clonar e instalar)

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd puntodeventaweb
```

### 2. Crear la base de datos

En MySQL:

```sql
CREATE DATABASE posdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configurar el backend (API)

```bash
cd pos-system/apps/api
copy .env.example .env.development
```

En Linux/macOS usa `cp .env.example .env.development`.

Edita `.env.development` y completa al menos:

- `DATABASE_URL` — usuario, contraseña y nombre de la BD
- `JWT_SECRET` — cambia el valor por defecto
- `RESEND_API_KEY` — solo si quieres enviar correos reales (recuperación de contraseña y facturas)

Instalar, sincronizar schema y datos de prueba:

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run start:dev
```

Si todo salió bien:

- API: http://localhost:3001  
- Swagger: http://localhost:3001/api-docs  

Deja esta terminal abierta.

### 4. Configurar el frontend (web)

Abre **otra** terminal:

```bash
cd pos-system/apps/web
npm install
npm run dev
```

La app queda en: http://localhost:3000  

El proxy de Vite reenvía `/api` al backend en el puerto 3001 (no hace falta configurar CORS a mano en desarrollo).

### 5. Iniciar sesión

Tras el seed, entra en http://localhost:3000/login con:

| Campo | Valor |
|-------|--------|
| Correo | `admin@pos.hn` |
| Contraseña | `Admin1234!` |

Cambia esa contraseña en producción.

---

## Estructura del proyecto

```
puntodeventaweb/
├── README.md                      # Esta guía
├── AGENT_INSTRUCTIONS_POS.md      # Spec completa del producto
├── .gitignore                     # Excluye secretos, node_modules, builds, etc.
└── pos-system/
    ├── README.md
    └── apps/
        ├── api/                   # Backend NestJS (puerto 3001)
        │   ├── .env.example       # Plantilla de variables (copiar, no subir .env)
        │   ├── prisma/            # schema.prisma + seed
        │   └── src/
        └── web/                   # Frontend React (puerto 3000)
            ├── .env.example
            └── src/
```

**Importante:** los archivos `.env`, `node_modules/`, `dist/`, `uploads/` y scripts temporales **no se suben** al repositorio (ver `.gitignore`).

---

## Variables de entorno (API)

Copia `pos-system/apps/api/.env.example` → `.env.development`.

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | Conexión MySQL (Prisma) |
| `JWT_SECRET` | Sí | Secreto para firmar tokens |
| `FRONTEND_URL` | Sí | URL del frontend (enlaces de reset de clave) |
| `PORT` | No | Puerto API (default `3001`) |
| `RESEND_API_KEY` | No* | API key de Resend; sin ella los correos se simulan en logs |
| `RESEND_FROM` | No | Remitente verificado en Resend |

\*En producción sí debes configurar Resend para recuperación de contraseña y envío de facturas.

---

## Módulos principales

| Módulo | Qué hace |
|--------|----------|
| Auth | Login JWT, refresh, bloqueo por intentos, recuperación por correo |
| POS | Venta rápida, código de barras, descuentos, pagos mixtos, envío de recibo |
| Productos / Categorías / Inventario | CRUD, stock, movimientos, ajustes, import CSV |
| Clientes | CRUD + historial de compras |
| Proveedores / Compras | Órdenes pendientes → completar para ingresar stock |
| Caja | Apertura/cierre, movimientos, reporte PDF |
| Ventas | Historial, anulación, devolución, reimpresión, email |
| Facturación CAI | Rangos SAR (activable en Configuración) |
| Reportes | Ventas, productos, cajeros, inventario, ganancia bruta, export |
| Auditoría | Registro de acciones críticas |
| Configuración | Negocio, ISV, logo, usuarios/roles, backup |

---

## Flujos útiles

### Recuperación de contraseña
1. Pantalla `/forgot-password`
2. El API envía (o simula) un enlace a `/reset-password?token=...` (válido 1 hora)
3. Sin `RESEND_API_KEY`, el enlace aparece en los logs del API y, en desarrollo, a veces en la respuesta JSON

### Enviar factura/recibo por correo
1. Al cobrar en el POS: marca “Enviar comprobante por correo”, o
2. En Ventas: icono de correo / detalle → enviar  
3. Requiere `RESEND_API_KEY` válida y un `RESEND_FROM` permitido por Resend

### Devolución
1. Ventas → icono de devolución  
2. Cantidades + motivo → el stock se reingresa; si es total, se anula la venta

---

## Roles

- **admin** — acceso total  
- **supervisor** — ventas, anulación, reportes, auditoría  
- **cajero** — POS, caja, clientes, ventas  
- **inventario** — productos, categorías, inventario, proveedores  

---

## Solución de problemas

| Problema | Qué revisar |
|----------|-------------|
| Error de conexión a MySQL | `DATABASE_URL`, que MySQL esté corriendo y que exista `posdb` |
| Frontend no habla con el API | API en `:3001`, web en `:3000`, proxy en `vite.config.ts` |
| No llegan correos | `RESEND_API_KEY`, dominio/remitente en Resend; revisa logs del API |
| `data.map is not a function` | Respuesta paginada vs array; ya cubierto en Categorías |
| Puerto ocupado | Cambia `PORT` (API) o `VITE_PORT` (web) |

---

## Documentación adicional

- Spec del producto y reglas de diseño: [`AGENT_INSTRUCTIONS_POS.md`](./AGENT_INSTRUCTIONS_POS.md)
- Notas del monorepo: [`pos-system/README.md`](./pos-system/README.md)
