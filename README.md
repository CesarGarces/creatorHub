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
| Frontend | Next.js 16, React 19, Zustand, TanStack Query, TailwindCSS |
| Backend | NestJS 11, TypeScript, Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Cola de mensajes | Redis + BullMQ |
| Storage | Cloudflare R2 (prod) / MinIO (dev) |
| WebSocket | Socket.IO |
| Domain Events | Redis Pub/Sub (ioredis) |
| AI | OpenAI, Gemini, Stability AI, Flux |
| Monorepo | Turborepo + pnpm workspaces |

## Arquitectura

```
creator-hub/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend
├── packages/
│   ├── auth/             # JWT + Passport
│   ├── ai-engine/        # Multi-provider AI abstraction
│   ├── billing/          # Sistema de créditos
│   ├── storage/          # R2/MinIO abstraction
│   ├── analytics/        # Tracking de uso
│   ├── database/         # Prisma ORM
│   ├── domain-events/    # Redis Pub/Sub abstraction
│   ├── tool-sdk/         # Tool Registry
│   ├── shared-types/     # Interfaces TypeScript
│   └── shared-utils/     # Utilidades puras
├── tools/
│   └── thumbnail-generator/  # Primera herramienta
│       └── backend/          # BullMQ processor + controller
└── agents/               # Agentes especializados
```

El sistema sigue principios de **Clean Architecture** y **DDD**: cada herramienta es un bounded context que se registra automáticamente via `ToolRegistry`. Las dependencias apuntan hacia adentro — las herramientas dependen del SDK, nunca al revés.

---

## Background Task Architecture

El sistema de tareas en segundo plano es **multi-tool y desacoplado**. Cualquier herramienta nueva se integra siguiendo el mismo patrón sin modificar infraestructura existente.

### Diagrama de Flujo — Generación de Thumbnail

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USUARIO (Browser)                              │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Prompt Input │    │ Style Select │    │    Generate Button       │  │
│  │  (store.form) │    │ (store.form) │    │  handleGenerate()       │  │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘  │
│         │                   │                          │                 │
│         └───────────────────┴──────────────────────────┘                │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Zustand Store (Global)                         │  │
│  │                                                                   │  │
│  │  BaseGenerationState          ThumbnailFormState                  │  │
│  │  ├── status: GENERATING       ├── prompt: "crear computador..."  │  │
│  │  ├── jobId: "26"              ├── style: "bold"                  │  │
│  │  ├── toolId: "thumb-gen"      ├── aiProvider: "gemini"           │  │
│  │  ├── resultUrl: null          └── negativePrompt: ""             │  │
│  │  └── error: null                                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│              ┌───────────────┴───────────────┐                         │
│              │                               │                         │
│              ▼                               ▼                         │
│  ┌───────────────────┐          ┌──────────────────────┐              │
│  │ Layout:           │          │ Page:                │              │
│  │ useSocketEvents() │          │ useBackgroundPolling()│              │
│  │ (always active)   │          │ (starts on GENERATING)│             │
│  └─────────┬─────────┘          └──────────┬───────────┘              │
└────────────┼───────────────────────────────┼───────────────────────────┘
             │                               │
             │ WebSocket                     │ HTTP Polling
             │ (Socket.IO)                   │ (every 5s)
             │                               │
┌────────────┼───────────────────────────────┼───────────────────────────┐
│            ▼                               ▼          API (NestJS)     │
│  ┌──────────────────┐          ┌──────────────────────────────┐       │
│  │  AppGateway       │          │  ThumbnailController         │       │
│  │  emitToUser()     │          │  POST /generate → enqueue    │       │
│  └────────┬─────────┘          │  GET  /jobs/:id/status       │       │
│           │                    └──────────────┬───────────────┘       │
│           │                                   │                       │
│           │                                   ▼                       │
│           │                    ┌──────────────────────────────┐       │
│           │                    │  ThumbnailService             │       │
│           │                    │  generate() → BullMQ job     │       │
│           │                    └──────────────┬───────────────┘       │
│           │                                   │                       │
│           │                                   ▼                       │
│           │                    ┌──────────────────────────────┐       │
│           │                    │  BullMQ Queue                │       │
│           │                    │  "thumbnail-generation"      │       │
│           │                    └──────────────┬───────────────┘       │
│           │                                   │                       │
│           │                                   ▼                       │
│           │                    ┌──────────────────────────────┐       │
│           │                    │  ThumbnailProcessor          │       │
│           │                    │  AI → Buffer → R2 → DB      │       │
│           │                    └──────────────┬───────────────┘       │
│           │                                   │                       │
│           │                    ┌──────────────┴───────────────┐       │
│           │                    │                              │       │
│           │                    ▼                              ▼       │
│           │         ┌──────────────────┐         ┌────────────────┐  │
│           │         │ @OnWorkerEvent   │         │ DomainEvent    │  │
│           │         │ "completed"      │         │ Publisher      │  │
│           │         │ (same process)   │         │ (Redis Pub/Sub)│  │
│           │         └────────┬─────────┘         └───────┬────────┘  │
│           │                  │                           │            │
│           │                  └───────────┬───────────────┘            │
│           │                              │                            │
│           │                              ▼                            │
│           │                   ┌────────────────────────┐              │
│           │                   │ ThumbnailListener      │              │
│           │                   │ Service                │              │
│           │                   │ subscribe → presign →  │              │
│           │                   │ emitToUser()           │              │
│           │                   └───────────┬────────────┘              │
│           │                               │                           │
│           │                               ▼                           │
│           │                    ┌────────────────────────┐              │
│           │                    │ Redis Channel           │              │
│           │                    │ "thumbnail:completed"   │              │
│           │                    └───────────┬────────────┘              │
│           │                               │                           │
└───────────┼───────────────────────────────┼───────────────────────────┘
            │                               │
            ▼                               │
┌───────────────────────────────────────────┼───────────────────────────┐
│  Socket.IO Client (useSocketEvents)       │                           │
│                                           │                           │
│  socket.on("tool_job_updated", (data) => │                           │
│    if (store.toolId === data.toolId) {    │                           │
│      setRevealing(data.payload.url)      │                           │
│      setReady()   // preload + fade-in   │                           │
│      toast.success("Thumbnail ready!")   │                           │
│    }                                      │                           │
│  )                                        │                           │
└───────────────────────────────────────────┘                           │
                                                                       │
┌───────────────────────────────────────────────────────────────────────┘
│
│  ┌──────────────────────────────────────────────────────────────────┐
│  │  Polling Fallback (useBackgroundPolling)                         │
│  │                                                                  │
│  │  if (status === "GENERATING") {                                  │
│  │    setInterval(async () => {                                     │
│  │      const res = await GET /tools/${toolId}/jobs/${jobId}/status │
│  │      if (res.status === "completed") → setRevealing + setReady   │
│  │      if (res.status === "failed")    → setFailed + toast.error   │
│  │    }, 5000)                                                      │
│  │  }                                                               │
│  └──────────────────────────────────────────────────────────────────┘
```

### State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
              ┌──────────┐     generate()          ┌──────┴─────┐
              │   IDLE   │ ──────────────────────▶ │ GENERATING │
              └──────────┘                         └──────┬─────┘
                    ▲                                     │
                    │                              ┌──────┴──────┐
                    │                              │             │
                    │                              ▼             ▼
                    │                    ┌──────────────┐  ┌──────────┐
                    │                    │  REVEALING   │  │  FAILED  │
                    │                    │  (preload)   │  └────┬─────┘
                    │                    └──────┬───────┘       │
                    │                           │               │
                    │                    preload OK        reset()
                    │                           │               │
                    │                           ▼               │
                    │                    ┌──────────┐           │
                    └────────────────────│   READY  │◀──────────┘
                                         └──────────┘
```

### WebSocket Event Flow

```
Backend (NestJS)                          Frontend (Next.js)
─────────────────                         ──────────────────

ThumbnailProcessor                        
  @OnWorkerEvent("completed")             
    │                                     
    ├─ DomainEventPublisher               
    │   .publish("thumbnail:completed")   
    │       │                             
    │       ▼                             
    │   Redis Pub/Sub                     
    │       │                             
    │       ▼                             
    │   ThumbnailListenerService          
    │     .handleCompleted()              
    │       │                             
    │       ├─ StorageService             
    │       │   .getPresignedDownloadUrl()│
    │       │                             
    │       └─ AppGateway                 
    │           .emitToUser(userId,       
    │             "tool_job_updated",     ──▶ socket.on("tool_job_updated")
    │             {                            │
    │               toolId,                    ├─ filter by toolId
    │               jobId,                     ├─ setRevealing(url, id)
    │               status: "completed",       ├─ setReady() → preload → READY
    │               payload: { url, imageId }  └─ toast.success()
    │             })                          
```

### Multi-Tool Integration Checklist

Para agregar una nueva tool (ej: `title-generator`):

| Capa | Archivo | Acción |
|------|---------|--------|
| **Backend** | `tools/title-generator/backend/` | Crear processor, service, controller |
| **Backend** | `thumbnail.processor.ts` → `title.processor.ts` | Mismo patrón: AI → Store → DB |
| **Backend** | `thumbnail-listener.service.ts` | Llamar `registerTool()` con nuevos canales |
| **Shared** | `event.types.ts` | Agregar `TitleCompletedEvent`, `TitleFailedEvent` |
| **Shared** | `shared-utils/error.utils.ts` | Ya reutilizable (sin cambios) |
| **Frontend** | `store/generation.store.ts` | Componer `BaseGenerationState` + campos propios |
| **Frontend** | `use-background-polling.ts` | Ya genérico (sin cambios, lee `toolId` del store) |
| **Frontend** | `use-socket-events.ts` | Ya genérico (sin cambios, filtra por `toolId`) |
| **Frontend** | `tools/[id]/page.tsx` | Crear página con campos específicos |

### Paquetes Clave

| Paquete | Responsabilidad | Multi-Tool |
|---------|----------------|------------|
| `@creator-hub/domain-events` | Publisher/Subscriber interfaces + Redis impl | ✅ Genérico |
| `@creator-hub/shared-utils` | `getFriendlyError()`, logging, utilities | ✅ Genérico |
| `@creator-hub/shared-types` | `ToolJobUpdatePayload`, event interfaces | ✅ Genérico |
| `@creator-hub/storage` | `uploadBuffer()`, `getPresignedDownloadUrl()` | ✅ Genérico |
| `@creator-hub/ai-engine` | Multi-provider AI abstraction | ✅ Genérico |
| `@creator-hub/billing` | Credit system | ✅ Genérico |
| `@creator-hub/ui` | Button, Badge, Skeleton, etc. | ✅ Genérico |

---

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
STORAGE_PROVIDER=minio
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

POST   /api/v1/tools/thumbnail-generator/generate       # Generar thumbnail
GET    /api/v1/tools/thumbnail-generator/jobs/:id/status # Estado del job
GET    /api/v1/tools/thumbnail-generator/images          # Imágenes del usuario

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
