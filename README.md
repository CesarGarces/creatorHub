# Creator Hub

Plataforma SaaS modular para content creators. Herramientas de IA para generar thumbnails, títulos, contenido de streaming y más — todo desde un solo dashboard.

## Qué es

Creator Hub es una plataforma donde los creadores de contenido pueden acceder a herramientas potenciadas por IA para acelerar su workflow. Cada herramienta se registra automáticamente en la plataforma usando un sistema de Tool Registry, lo que permite agregar nuevas herramientas sin modificar el código existente.

**Herramientas disponibles:**
- **Thumbnail Generator** — Genera miniaturas con IA (OpenAI DALL-E, Flux, Stability AI, Gemini)

**Herramientas en desarrollo:**
- Title Generator
- Stream Games
- Video Editor
- Content Repurposer
- SEO Optimizer
- Audio Generator

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React 18, Zustand, TanStack Query, TailwindCSS |
| Backend | NestJS 10, TypeScript, Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Cola de mensajes | Redis + BullMQ |
| Storage | MinIO (dev) / AWS S3 (prod) |
| AI | OpenAI, Gemini, Stability AI, Flux, Nano Banana |
| Monorepo | Turborepo + pnpm workspaces |

## Arquitectura

```
creator-hub/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   ├── auth/         # JWT + Passport
│   ├── ai-engine/    # Multi-provider AI abstraction
│   ├── billing/      # Sistema de créditos
│   ├── storage/      # S3/MinIO abstraction
│   ├── analytics/    # Tracking de uso
│   ├── database/     # Prisma ORM
│   ├── tool-sdk/     # Tool Registry
│   ├── shared-types/ # Interfaces TypeScript
│   └── shared-utils/ # Utilidades puras
└── tools/
    └── thumbnail-generator/  # Primera herramienta
```

El sistema sigue principios de **Clean Architecture** y **DDD**: cada herramienta es un bounded context que se registra automáticamente via `ToolRegistry`. Las dependencias apuntan hacia adentro — las herramientas dependen del SDK, nunca al revés.

## Requisitos

- Node.js >= 20
- pnpm 11
- Docker (para PostgreSQL, Redis, MinIO)

## Instalación

```sh
# 1. Instalar dependencias
pnpm install

# 2. Levantar infraestructura
docker compose up -d

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys

# 4. Generar cliente Prisma y migrar
pnpm db:generate
pnpm db:migrate

# 5. Correr el proyecto
pnpm dev
```

## Variables de entorno

```env
# Base de datos
DATABASE_URL="postgresql://creatorhub:creatorhub@localhost:5433/creatorhub"

# Redis
REDIS_URL="redis://localhost:6379"

# Storage (MinIO para desarrollo)
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
AWS_S3_ENDPOINT="http://localhost:9000"

# Auth
JWT_SECRET="tu-secret-aqui"

# AI Providers (al menos uno necesario)
OPENAI_API_KEY=""
GEMINI_API_KEY=""
STABILITY_AI_API_KEY=""
FLUX_API_KEY=""

# App
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Servicios

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/api/docs |
| MinIO Console | http://localhost:9001 |

## API

La API expone endpoints REST bajo `/api/v1`. Documentación interactiva disponible en Swagger.

```
POST   /api/v1/auth/register          # Registro
POST   /api/v1/auth/login             # Login

GET    /api/v1/tools                  # Listar herramientas
GET    /api/v1/tools/:id              # Detalle de herramienta

POST   /api/v1/tools/thumbnail-generator/generate  # Generar thumbnail
GET    /api/v1/tools/thumbnail-generator/images     # Imágenes del usuario

GET    /api/v1/credits/balance        # Saldo de créditos
GET    /api/v1/credits/plans          # Planes de suscripción
POST   /api/v1/credits/subscribe      # Suscribirse a un plan
```

## Sistema de créditos

Los usuarios reciben 100 créditos al registrarse. Cada uso de herramienta descuenta créditos según el proveedor de IA:

| Proveedor | Costo por imagen |
|-----------|-----------------|
| OpenAI (DALL-E 3) | 10 créditos |
| Stability AI | 8 créditos |
| Flux | 6 créditos |
| Gemini | 5 créditos |
| Nano Banana | 4 créditos |

## Comandos

```sh
pnpm dev              # Correr todo (frontend + backend)
pnpm build            # Build completo
pnpm lint             # Lint
pnpm test             # Tests
pnpm typecheck        # Type checking
pnpm format           # Formatear código

pnpm db:generate      # Generar cliente Prisma
pnpm db:push          # Push schema a la BD
pnpm db:migrate       # Ejecutar migraciones
pnpm db:seed          # Seedear datos
```

## Licencia

MIT
