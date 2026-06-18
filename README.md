# Creator Hub

Plataforma SaaS modular para content creators. Herramientas de IA para generar thumbnails, títulos, contenido de streaming y más — todo desde un solo dashboard.

## Qué es

Creator Hub es una plataforma donde los creadores de contenido pueden acceder a herramientas potenciadas por IA para acelerar su workflow. Cada herramienta se registra automáticamente en la plataforma usando un sistema de Tool Registry, lo que permite agregar nuevas herramientas sin modificar el código existente.

**Herramientas disponibles:**

- **Thumbnail Generator** — Genera miniaturas con IA (Z-Image-Turbo, SiliconFlow FLUX.2-pro, OpenAI, Gemini, Stability AI)
- **Content Translator** — Traduce contenido entre idiomas con IA (DeepSeek V4 Flash, DeepSeek V4 Pro). Incluye speech-to-text en tiempo real con Deepgram Nova-3 para dictado por voz.

**Herramientas en desarrollo:**

- Title Generator
- Stream Games
- Video Editor
- Content Repurposer
- SEO Optimizer
- Audio Generator

## Stack

| Capa             | Tecnología                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Frontend         | Next.js 16, React 19, Zustand, TanStack Query, TailwindCSS                                         |
| Backend          | NestJS 11, TypeScript, Prisma ORM                                                                  |
| Base de datos    | PostgreSQL 16                                                                                      |
| Cola de mensajes | Redis + BullMQ                                                                                     |
| Storage          | Cloudflare R2 (prod) / MinIO (dev)                                                                 |
| WebSocket        | Socket.IO                                                                                          |
| Domain Events    | Redis Pub/Sub (ioredis)                                                                            |
| Payment Gateway  | MercadoPago (Strategy Pattern), PayPal (planned)                                                   |
| AI               | SiliconFlow (Z-Image-Turbo, FLUX.2-pro, DeepSeek V4), OpenAI, Gemini, Stability AI, Deepgram (STT) |
| Monorepo         | Turborepo + pnpm workspaces                                                                        |

## Arquitectura

```
creator-hub/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend
├── packages/
│   ├── auth/             # JWT + Passport
│   ├── ai-engine/        # Multi-provider AI abstraction (tier-aware)
│   ├── stt-engine/       # Speech-to-text streaming (Deepgram, Mock)
│   ├── billing/          # Sistema de créditos (free + purchased)
│   ├── storage/          # R2/MinIO abstraction
│   ├── analytics/        # Tracking de uso
│   ├── database/         # Prisma ORM
│   ├── domain-events/    # Redis Pub/Sub abstraction
│   ├── tool-sdk/         # Tool Registry
│   ├── shared-types/     # Interfaces TypeScript
│   └── shared-utils/     # Utilidades puras
├── tools/
│   ├── thumbnail-generator/  # Primera herramienta
│   │   └── backend/          # BullMQ processor + controller
│   └── content-translator/   # Traducción de contenido con IA
│       ├── backend/          # TranslatorProcessor + controller
│       └── frontend/         # UI full-screen con dos textareas
└── agents/               # Agentes especializados
```

El sistema sigue principios de **Clean Architecture** y **DDD**: cada herramienta es un bounded context que se registra automáticamente via `ToolRegistry`. Las dependencias apuntan hacia adentro — las herramientas dependen del SDK, nunca al revés.

---

## Free-to-Premium Bridge

### Planes de usuario

| Plan              | Créditos iniciales  | Proveedores IA                                         |
| ----------------- | ------------------- | ------------------------------------------------------ |
| **FREE**          | 100 créditos gratis | Solo proveedores gratuitos (Z-Image-Turbo, FLUX.2-pro) |
| **PAY_AS_YOU_GO** | Compra bajo demanda | Todos los proveedores activos                          |
| **PREMIUM**       | Suscripción mensual | Todos los proveedores activos                          |

Los proveedores y sus costos se configuran en la tabla `Provider` de la base de datos. El frontend los consume dinámicamente desde `GET /api/v1/ai/providers`.

### Flujo de registro

```
Registro → User.create(plan=FREE, freeCredits=100)
         → Subscription.create(planId="free", status=ACTIVE)
```

Los usuarios reciben **100 créditos gratis** al registrarse. No se requiere tarjeta de crédito.

### Sistema de créditos

El costo por generación depende del proveedor seleccionado y se lee desde la tabla `Provider` (`costPerCredit`). Los créditos se deducen en orden de prioridad:

```
freeCredits → purchasedCredits → Error (sin créditos)
```

| Campo              | Descripción                                       |
| ------------------ | ------------------------------------------------- |
| `freeCredits`      | Créditos gratis del plan FREE (se agotan primero) |
| `purchasedCredits` | Créditos comprados o de suscripción               |

### Marketing Automation

El sistema emite eventos cuando los créditos del usuario alcanzan ciertos umbrales:

```
75 créditos → CREDIT_THRESHOLD_75
25 créditos → CREDIT_THRESHOLD_25
10 créditos → CREDIT_THRESHOLD_10
 5 créditos → CREDIT_THRESHOLD_5
 0 créditos → CREDIT_DEPLETED
```

Estos eventos se almacenan en la tabla `MarketingEvent` y se usan para:

- Mostrar alertas en la UI (modal de upgrade cuando credits = 0)
- Logging para futuras integraciones de email/push notifications
- Analytics de conversión Free → Paid

### Online Payments (Strategy Pattern)

El sistema de pagos en línea usa el patrón **Strategy** para soportar múltiples pasarelas de pago sin acoplar el código a un proveedor específico.

#### Paquete `@creator-hub/billing`

```
packages/billing/src/
├── interfaces/
│   └── payment-gateway.interface.ts    # IPaymentGateway contract
├── strategies/
│   └── mercado-pago.strategy.ts        # MercadoPago adapter
├── services/
│   ├── payment-registry.service.ts     # Gateway registry (strategy switcher)
│   └── credit-billing.service.ts       # Reconciliation + WebSocket notification
└── billing.module.ts                   # DI wiring
```

#### Flujo de pago

```
1. Frontend → POST /api/v1/credits/checkout { planId, gateway }
2. CreditsController → lookup plan → resolve gateway via PaymentRegistryService
3. MercadoPagoStrategy.createCheckoutSession() → returns { paymentUrl, gatewayTxId }
4. Controller records pending CreditTransaction in DB
5. Returns redirectUrl to frontend → user pays on MercadoPago
6. MercadoPago sends webhook → POST /api/v1/webhooks/mercado-pago
7. WebhooksController → MercadoPagoStrategy.verifyWebhook() (HMAC validation)
8. CreditBillingService.reconcilePayment() → add credits + emit payment:success via Redis
9. PaymentListenerService → forwards event to user via WebSocket
```

#### Agregar una nueva pasarela

```typescript
// 1. Crear strategy que implemente IPaymentGateway
@Injectable()
export class StripeStrategy implements IPaymentGateway {
  getGatewayType() { return PaymentGateway.STRIPE; }
  async createCheckoutSession(data: CreateCheckoutDto) { /* ... */ }
  async verifyWebhook(headers, body, rawBody?) { /* ... */ }
}

// 2. Registrar en billing.module.ts
{
  provide: PAYMENT_GATEWAYS,
  useFactory: (mp: MercadoPagoStrategy, stripe: StripeStrategy) => [mp, stripe],
  inject: [MercadoPagoStrategy, StripeStrategy],
}
```

#### Variables de entorno (pagos)

```env
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_WEBHOOK_SECRET=""
# MP_NOTIFICATION_URL=""  # Opcional - defaults to ${API_URL}/api/v1/webhooks/mercado-pago
```

### Selección de proveedor

```
Frontend
  → GET /api/v1/ai/providers
  → Lista filtrada (isActive=true), ordenada por tier + costo

Usuario FREE + freeCredits > 0
  → Solo proveedores con tier=FREE son seleccionables
  → El backend rechaza peticiones a proveedores PRO

Usuario PAY_AS_YOU_GO / PREMIUM
  → Todos los proveedores activos disponibles
```

---

## Background Task Architecture

El sistema de tareas en segundo plano es **multi-tool y desacoplado**. Cualquier herramienta nueva se integra siguiendo el mismo patrón sin modificar infraestructura existente.

### Diagrama de Flujo — Generación de Thumbnail

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USUARIO (Browser)                              │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  Prompt Input │    │ Aspect Ratio │    │  Provider    │              │
│  │  (store.form) │    │  Selector    │    │  Selector    │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                    │                       │
│         └───────────────────┴────────────────────┘                      │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Zustand Store (Global)                         │  │
│  │                                                                   │  │
│  │  BaseGenerationState          ThumbnailFormState                  │  │
│  │  ├── status: GENERATING       ├── prompt                         │  │
│  │  ├── jobId: "26"              ├── style: "bold"                  │  │
│  │  ├── toolId: "thumb-gen"      ├── aiProvider: "z-image-turbo"   │  │
│  │  ├── resultUrl: null          ├── width: 1280                    │  │
│  │  └── error: null              ├── height: 720                    │  │
│  │                               └── negativePrompt: ""             │  │
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
│  │  emitToUser()     │          │  POST /generate (w/ w,h)    │       │
│  └────────┬─────────┘          │  GET  /jobs/:id/status       │       │
│           │                    └──────────────┬───────────────┘       │
│           │                                   │                       │
│           │                                   ▼                       │
│           │                    ┌──────────────────────────────┐       │
│           │                    │  ThumbnailService             │       │
│           │                    │  selectProvider() → BullMQ    │       │
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
│           │         └────────┬─────────┘         └───────┬────────┘  │
│           │                  │                           │            │
│           │                  └───────────┬───────────────┘            │
│           │                              │                            │
│           │                              ▼                            │
│           │                   ┌────────────────────────┐              │
│           │                   │ ThumbnailListener      │              │
│           │                   │ subscribe → presign →  │              │
│           │                   │ emitToUser()           │              │
│           │                   └───────────┬────────────┘              │
│           │                               │                           │
│           │                               ▼                           │
│           │                    ┌────────────────────────┐              │
│           │                    │ CreditService.deduct() │              │
│           │                    │ (freeCredits first)    │              │
│           │                    └───────────┬────────────┘              │
│           │                               │                           │
│           │                               ▼                           │
│           │                    ┌────────────────────────┐              │
│           │                    │ MarketingEventHandler  │              │
│           │                    │ (threshold events)     │              │
│           │                    └────────────────────────┘              │
└───────────┼───────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Socket.IO Client (useSocketEvents)                                   │
│                                                                       │
│  socket.on("tool_job_updated", (data) =>                             │
│    if (store.toolId === data.toolId) {                                │
│      setRevealing(data.payload.url)                                  │
│      setReady()   // preload + fade-in                               │
│      toast.success("Thumbnail ready!")                               │
│    }                                                                  │
│  )                                                                    │
└───────────────────────────────────────────────────────────────────────┘
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

---

## AI Providers

Los proveedores de IA se administran desde la base de datos (`Provider`). El runtime registra las implementaciones, pero la metadata (nombre, modelo, tier, costo, tareas soportadas) se lee de la BD.

### Tabla `Provider`

| Campo            | Descripción                                   |
| ---------------- | --------------------------------------------- |
| `slug`           | ID único (`z-image-turbo`, `openai`, etc.)    |
| `name`           | Nombre para mostrar                           |
| `model`          | Modelo de IA (`dall-e-3`, `FLUX.2-pro`, etc.) |
| `tier`           | `FREE` o `PRO`                                |
| `costPerCredit`  | Créditos que consume cada generación          |
| `isActive`       | ¿Disponible en el frontend?                   |
| `supportedTasks` | Array de tareas soportadas (ej. `thumbnail`)  |
| `config`         | Configuración específica del proveedor (JSON) |

### Proveedores gratuitos (tier: free)

| Proveedor             | Modelo                         | Dimensiones soportadas              | Costo    |
| --------------------- | ------------------------------ | ----------------------------------- | -------- |
| **Z-Image-Turbo**     | `Tongyi-MAI/Z-Image-Turbo`     | 1024x1024, 1280x720, 720x1280, etc. | 1 cr     |
| **SiliconFlow**       | `black-forest-labs/FLUX.2-pro` | 1024x1024 (ignora image_size)       | 1 cr     |
| **DeepSeek V4 Flash** | `deepseek-ai/DeepSeek-V4`      | Text generation / translation       | 5 cr     |
| **Deepgram (STT)**    | Nova-3                         | Speech-to-text (streaming)          | 1 cr/min |

### Proveedores de pago (tier: pro)

| Proveedor           | Modelo                    | Costo por imagen |
| ------------------- | ------------------------- | ---------------- |
| **OpenAI**          | DALL-E 3                  | 10 créditos      |
| **Gemini**          | Imagen 3                  | 5 créditos       |
| **Stability AI**    | Stable Diffusion          | 8 créditos       |
| **Flux**            | Flux Dev                  | 6 créditos       |
| **DeepSeek V4 Pro** | `deepseek-ai/DeepSeek-V4` | 10 créditos      |

### Flujo de selección

```
Frontend
  → GET /api/v1/ai/providers
  → Renderiza selector compacto (dropdown)
  → Envía provider seleccionado en POST /generate

Backend: ThumbnailService.generate()
  → Busca proveedor en BD por slug
  → Si tier=PRO y plan=FREE → Error (upgrade requerido)
  → Verifica saldo >= costPerCredit
  → Encola job con provider, providerId, providerTier, creditCost

Backend: ThumbnailProcessor.process()
  → Genera imagen con AI provider runtime
  → Deduce creditCost del usuario
  → Guarda GeneratedImage con providerId y isProModel=(providerTier=PRO)
```

### Registro de proveedores

```typescript
// ProviderFactory registra las implementaciones al iniciar el módulo.
// La metadata (tier, costo, etc.) se lee de la tabla Provider en runtime.
new OpenAIImageProvider();
new GeminiProvider();
new StabilityAIProvider();
new FluxProvider();
new SiliconFlowProvider();
new ZImageTurboProvider();
new DeepSeekV4FlashProvider(); // free, 5 credits, text-generation
new DeepSeekV4ProProvider(); // pro, 10 credits, text-generation

// En desarrollo sin SILICONFLOW_API_KEY:
new MockImageProvider(); // solo dev
```

---

## Multi-Tool Integration Checklist

Para agregar una nueva tool (ej: `content-translator`):

| Capa         | Archivo                                              | Acción                                                        |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| **Backend**  | `tools/content-translator/backend/`                  | Crear processor, service, controller                          |
| **Backend**  | `thumbnail.processor.ts` → `translator.processor.ts` | Mismo patrón: AI → Store → DB                                 |
| **Backend**  | `translation-listener.service.ts`                    | Llamar `registerTool()` con nuevos canales                    |
| **Shared**   | `event.types.ts`                                     | Agregar `TranslationCompletedEvent`, `TranslationFailedEvent` |
| **Shared**   | `shared-utils/error.utils.ts`                        | Ya reutilizable (sin cambios)                                 |
| **Frontend** | `store/translator.store.ts`                          | Store separado para estado del traductor                      |
| **Frontend** | `use-background-polling.ts`                          | Ya genérico (sin cambios, lee `toolId` del store)             |
| **Frontend** | `use-socket-events.ts`                               | Ya genérico (sin cambios, filtra por `toolId`)                |
| **Frontend** | `tools/content-translator/page.tsx`                  | Página full-screen con dos textareas                          |

### Paquetes Clave

| Paquete                      | Responsabilidad                                    | Multi-Tool  |
| ---------------------------- | -------------------------------------------------- | ----------- |
| `@creator-hub/domain-events` | Publisher/Subscriber interfaces + Redis impl       | ✅ Genérico |
| `@creator-hub/shared-utils`  | `getFriendlyError()`, logging, utilities           | ✅ Genérico |
| `@creator-hub/shared-types`  | `ToolJobUpdatePayload`, event interfaces           | ✅ Genérico |
| `@creator-hub/storage`       | `uploadBuffer()`, `getPresignedDownloadUrl()`      | ✅ Genérico |
| `@creator-hub/ai-engine`     | Multi-provider AI abstraction (tier-aware)         | ✅ Genérico |
| `@creator-hub/stt-engine`    | STT streaming with provider registry               | ✅ Genérico |
| `@creator-hub/billing`       | Credit system (free + purchased, marketing events) | ✅ Genérico |
| `@creator-hub/ui`            | Button, Badge, Skeleton, etc.                      | ✅ Genérico |
| `@creator-hub/ui`            | shadcn-style component library (Radix + Tailwind)  | ✅ Genérico |

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

## Tests

All automated tests in the monorepo use Vitest as the standard runner. Jest has been removed from the workspace to avoid duplicated test runners and extraneous devDependencies. Run tests across the repo with:

```sh
pnpm -w test
```

Run a single package tests (example):

```sh
pnpm --filter @creator-hub/api test
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

# AI Providers — Free tier (al menos uno necesario para desarrollo)
SILICONFLOW_API_KEY=""          # Requerido para Z-Image-Turbo y FLUX.2-pro

# AI Providers — Pro tier (opcionales)
OPENAI_API_KEY=""
GEMINI_API_KEY=""
STABILITY_AI_API_KEY=""

# MercadoPago (Gateway de pagos)
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_WEBHOOK_SECRET=""

# App
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
API_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3000"
```

> **Nota:** En desarrollo sin `SILICONFLOW_API_KEY`, se registra automáticamente un `MockImageProvider` que genera imágenes de prueba.

## Servicios

| Servicio      | URL                            |
| ------------- | ------------------------------ |
| Frontend      | http://localhost:3000          |
| Landing       | http://localhost:3002          |
| Admin Panel   | http://localhost:3003          |
| API           | http://localhost:3001          |
| Swagger       | http://localhost:3001/api/docs |
| MinIO Console | http://localhost:9001          |

## Admin Panel

Panel de administración independiente en `apps/admin/`.

```
GET    /api/v1/admin/dashboard/stats          # Estadísticas generales
GET    /api/v1/admin/dashboard/usage          # Uso por proveedor/servicio
GET    /api/v1/admin/dashboard/top-users      # Top usuarios
GET    /api/v1/admin/dashboard/registrations  # Registros por mes

GET    /api/v1/admin/providers                # Listar proveedores
POST   /api/v1/admin/providers                # Crear proveedor
PUT    /api/v1/admin/providers/:id            # Editar proveedor
DELETE /api/v1/admin/providers/:id            # Eliminar proveedor

GET    /api/v1/admin/users                    # Listar usuarios
POST   /api/v1/admin/users                    # Crear usuario
PUT    /api/v1/admin/users/:id                # Editar usuario
POST   /api/v1/admin/users/:id/deactivate     # Desactivar usuario (soft delete)
POST   /api/v1/admin/users/:id/activate       # Reactivar usuario
```

**Características:**

- Dashboard con métricas y gráficos
- Gestión de proveedores IA (tier, costo, modelo, tareas)
- Gestión de usuarios con soft delete (`isActive`)
- Los créditos de usuario son de solo lectura en el admin
- Protección: no se puede desactivar el último admin ni a sí mismo

## UI Components — shadcn-style

La UI se construye con componentes estilo **shadcn/ui** en `packages/ui/`. Cada componente se basa en Radix primitives con Tailwind CSS v4 para estilizado, siguiendo el patrón de composición (Header, Content, Footer, Trigger).

### Componentes disponibles

| Componente            | Base             | Uso                                                                 |
| --------------------- | ---------------- | ------------------------------------------------------------------- |
| `Button`              | CVA              | 7 variantes: primary, secondary, ghost, danger, outline, glow, link |
| `Dialog`              | Portal manual    | Modal centrado con overlay                                          |
| `AlertDialog`         | Radix Dialog     | Confirmación (Cancelar / Aceptar)                                   |
| `ActionConfirmDialog` | Portal manual    | Confirmación con botones dinámicos                                  |
| `Sheet`               | Portal manual    | Panel lateral deslizante                                            |
| `Popover`             | Radix Popover    | Notificaciones, tooltips flotantes                                  |
| `DropdownMenu`        | Radix Dropdown   | Menú desplegable de acciones                                        |
| `Command`             | cmdk             | Paleta de comandos (⌘K)                                             |
| `ScrollArea`          | Radix ScrollArea | Scroll personalizado                                                |
| `Switch`              | Radix Switch     | Toggle on/off                                                       |
| `Separator`           | Radix Separator  | Divisor visual                                                      |
| `Tooltip`             | Radix Tooltip    | Tooltip hover                                                       |
| `Avatar`              | Radix Avatar     | Avatar con iniciales                                                |
| `Badge`               | —                | 7 variantes de badge                                                |
| `Card`                | —                | Card con header/content/footer                                      |
| `Input` / `Textarea`  | —                | Campos de formulario                                                |
| `Skeleton`            | —                | Placeholder de carga                                                |

### Z-Index Scale

| Capa             | z-index     |
| ---------------- | ----------- |
| Backdrop         | `z-[99997]` |
| Panel/Sheet      | `z-[99998]` |
| Popover/Dropdown | `z-[99999]` |

### Dependencias

- Radix primitives: `@radix-ui/react-dialog`, `react-popover`, `react-dropdown-menu`, `react-switch`, `react-scroll-area`, `react-separator`, `react-tooltip`, `react-avatar`
- `cmdk` para Command palette
- `class-variance-authority` para variantes tipadas
- `clsx` + `tailwind-merge` → utilidad `cn()`
- `lucide-react` para íconos (SVG, no emojis)

Ver `structure.md` para arquitectura detallada de archivos.

## API

La API expone endpoints REST bajo `/api/v1`. Documentación interactiva disponible en Swagger.

```
POST   /api/v1/auth/register          # Registro (asigna FREE + 100 créditos)
POST   /api/v1/auth/login             # Login

GET    /api/v1/tools                  # Listar herramientas
GET    /api/v1/tools/:id              # Detalle de herramienta

GET    /api/v1/ai/providers           # Listar proveedores activos (metadata desde BD)

# Admin endpoints (requieren rol ADMIN)
GET    /api/v1/admin/dashboard/stats
GET    /api/v1/admin/dashboard/usage
GET    /api/v1/admin/dashboard/top-users
GET    /api/v1/admin/dashboard/registrations
GET    /api/v1/admin/providers
POST   /api/v1/admin/providers
PUT    /api/v1/admin/providers/:id
DELETE /api/v1/admin/providers/:id
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PUT    /api/v1/admin/users/:id
POST   /api/v1/admin/users/:id/deactivate
POST   /api/v1/admin/users/:id/activate

POST   /api/v1/tools/thumbnail-generator/generate       # Generar thumbnail (accepts width, height, provider)
GET    /api/v1/tools/thumbnail-generator/jobs/:id/status # Estado del job
GET    /api/v1/tools/thumbnail-generator/images          # Imágenes del usuario

POST   /api/v1/tools/content-translator/translate       # Traducir contenido (text, targetLanguage, provider)
GET    /api/v1/tools/content-translator/jobs/:id/status  # Estado del job

# WebSocket events — Speech-to-Text (Content Translator)
Emit    stt:start → { language?, userId }               # Iniciar sesión STT
Emit    stt:chunk → { sessionId, audio }                 # Chunk de audio PCM (linear16)
Emit    stt:end → { sessionId }                          # Finalizar sesión y facturar
On      stt:transcript → { transcript, isFinal }         # Transcripción parcial/final
On      stt:done → { sessionId, transcript, durationMs } # Sesión completada
On      stt:error → { code, message }                    # Error o créditos insuficientes

GET    /api/v1/credits/balance        # Saldo (freeCredits, purchasedCredits, plan)
GET    /api/v1/credits/marketing-events  # Eventos de marketing del usuario
GET    /api/v1/credits/plans          # Planes de suscripción
POST   /api/v1/credits/subscribe      # Suscribirse a un plan
POST   /api/v1/credits/checkout       # Crear sesión de pago (gateway, planId)
GET    /api/v1/credits/status/:gatewayTxId  # Estado de transacción

POST   /api/v1/webhooks/mercado-pago  # Webhook de MercadoPago (verificación HMAC)
```

## Sistema de créditos

Los usuarios reciben **100 créditos gratis** al registrarse. El costo por generación depende del proveedor y se obtiene de la tabla `Provider` (`costPerCredit`).

El sistema distingue entre dos tipos de créditos:

| Tipo               | Origen                | Prioridad de deducción |
| ------------------ | --------------------- | ---------------------- |
| `freeCredits`      | Registro (100 gratis) | Primero                |
| `purchasedCredits` | Compra o suscripción  | Segundo                |

Cuando los créditos llegan a 0, se muestra un **modal de upgrade** con opciones de recarga (mínimo $10 USD).

## Pre-commit Hooks

El proyecto usa **Husky** + **lint-staged** para asegurar calidad de código antes de cada commit:

- **ESLint**: Bloquea commits con errores (warnings permitidos)
- **Prettier**: Verifica formato de código

```sh
# Los hooks se instalan automáticamente con:
pnpm install
```

## Comandos

```sh
pnpm dev              # Correr frontend + landing + admin (excluye API)
pnpm dev:api          # Correr solo la API (nest start --watch)
pnpm dev:all          # Correr todo incluyendo API
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
