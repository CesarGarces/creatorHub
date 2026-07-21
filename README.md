# Creator Hub

Modular SaaS platform for content creators. AI tools to generate thumbnails, titles, streaming content and more — all from a single dashboard.

## What is it

Creator Hub is a platform where content creators can access AI-powered tools to accelerate their workflow. Each tool is automatically registered in the platform using a Tool Registry system, allowing new tools to be added without modifying existing code.

**Available tools:**

- **Thumbnail Generator** — Generate thumbnails with AI (Z-Image-Turbo, SiliconFlow FLUX.2-pro, OpenAI, Gemini, Stability AI)
- **Content Translator** — Translate content between languages with AI (DeepSeek V4 Flash, DeepSeek V4 Pro). Includes real-time speech-to-text with Deepgram Nova-3 for voice dictation.
- **Image to Image** — Transform existing images with AI (FLUX.2-pro img2img)
- **Video Generator** — Generate videos with AI from text or images
- **Image to Video** — Convert images into animated videos with AI
- **Text to Video** — Generate videos directly from text descriptions
- **AI Chat** — AI assistant with streaming, dynamic tool routing and integrated actions (opens tools directly from chat)

**Tools in development:**

- Title Generator
- Stream Games
- Video Editor
- Content Repurposer
- SEO Optimizer
- Audio Generator

## Stack

| Layer           | Technology                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Frontend        | Next.js 16, React 19, Zustand, TanStack Query, TailwindCSS                                                  |
| Backend         | NestJS 11, TypeScript, Prisma ORM                                                                           |
| Database        | PostgreSQL 16                                                                                               |
| Message Queue   | Redis + BullMQ                                                                                              |
| Storage         | Cloudflare R2 (prod) / MinIO (dev)                                                                          |
| WebSocket       | Socket.IO                                                                                                   |
| Domain Events   | Redis Pub/Sub (ioredis)                                                                                     |
| Payment Gateway | MercadoPago (Strategy Pattern), PayPal (planned)                                                            |
| AI              | SiliconFlow (Z-Image-Turbo, FLUX.2-pro, DeepSeek V4, GLM-5.2), OpenAI, Gemini, Stability AI, Deepgram (STT) |
| Chat            | AI Engine streaming (SSE), dynamic tool routing via ToolRegistry                                            |
| Email           | Resend (provider-agnostic via abstract interface), Handlebars templates                                     |
| Monorepo        | Turborepo + pnpm workspaces                                                                                 |

## Architecture

```
creator-hub/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend
├── packages/
│   ├── auth/             # JWT + Passport + EmailVerifiedGuard
│   ├── ai-engine/        # Multi-provider AI abstraction (tier-aware) + streaming
│   ├── email/            # Provider-agnostic email (Resend, Handlebars templates)
│   ├── stt-engine/       # Speech-to-text streaming (Deepgram, Mock)
│   ├── billing/          # Credit system (currentCredits as single source of truth)
│   ├── storage/          # R2/MinIO abstraction
│   ├── analytics/        # Usage tracking
│   ├── database/         # Prisma ORM
│   ├── domain-events/    # Redis Pub/Sub abstraction
│   ├── tool-sdk/         # Tool Registry
│   ├── shared-types/     # TypeScript interfaces
│   └── shared-utils/     # Pure utilities
├── tools/
│   ├── thumbnail-generator/  # First tool
│   │   └── backend/          # BullMQ processor + controller
│   ├── content-translator/   # AI content translation
│   │   ├── backend/          # TranslatorProcessor + controller
│   │   └── frontend/         # Full-screen UI with two textareas
│   ├── image-to-image/       # AI image transformation
│   └── video-generator/      # Video generation (text-to-video, image-to-video)
│       └── backend/          # VideoProcessor + controller
├── agents/               # Specialized agents
│   └── chat-agent/       # Chat with dynamic tool routing
└── skills/               # System skills (see .agents/skills/)
```

The system follows **Clean Architecture** and **DDD** principles: each tool is a bounded context that automatically registers via `ToolRegistry`. Dependencies point inward — tools depend on the SDK, never the other way around.

---

## Free-to-Premium Bridge

### User Plans

| Plan              | Initial Credits    | AI Providers                                    |
| ----------------- | ------------------ | ----------------------------------------------- |
| **FREE**          | 100 free credits   | Free providers only (Z-Image-Turbo, FLUX.2-pro) |
| **PAY_AS_YOU_GO** | On-demand purchase | All active providers                            |
| **STARTER**       | $25 USD / 2700 cr  | All active starter providers                    |
| **PRO**           | $50 USD / 6000 cr  | All active providers                            |

Providers and their costs are configured in the `Provider` database table. The frontend consumes them dynamically from `GET /api/v1/ai/providers`.

### Registration Flow

```
Registration → User.create(plan=FREE, currentCredits=100)
             → Subscription.create(planId="free", status=ACTIVE)
```

Users receive **100 free credits** upon registration. No credit card required.

### Credit System

Cost per generation depends on the selected provider and is read from the `Provider` table (`costPerCredit`). The user balance is stored in a single field:

```
currentCredits → Error (out of credits)
```

| Field              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `currentCredits`   | Total user balance (free + purchased + bonus)        |
| `purchasedCredits` | Informative counter of purchased credits (read-only) |

### Marketing Automation

The system emits events when user credits reach certain thresholds:

```
75 credits → CREDIT_THRESHOLD_75
25 credits → CREDIT_THRESHOLD_25
10 credits → CREDIT_THRESHOLD_10
 5 credits → CREDIT_THRESHOLD_5
 0 credits → CREDIT_DEPLETED
```

These events are stored in the `MarketingEvent` table and used for:

- Showing alerts in the UI (upgrade modal when credits = 0)
- Logging for future email/push notification integrations
- Free → Paid conversion analytics

### Online Payments (Strategy Pattern)

The online payment system uses the **Strategy** pattern to support multiple payment gateways without coupling the code to a specific provider.

#### `@creator-hub/billing` Package

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

#### Payment Flow

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

#### Adding a New Gateway

```typescript
// 1. Create strategy implementing IPaymentGateway
@Injectable()
export class StripeStrategy implements IPaymentGateway {
  getGatewayType() { return PaymentGateway.STRIPE; }
  async createCheckoutSession(data: CreateCheckoutDto) { /* ... */ }
  async verifyWebhook(headers, body, rawBody?) { /* ... */ }
}

// 2. Register in billing.module.ts
{
  provide: PAYMENT_GATEWAYS,
  useFactory: (mp: MercadoPagoStrategy, stripe: StripeStrategy) => [mp, stripe],
  inject: [MercadoPagoStrategy, StripeStrategy],
}
```

#### Environment Variables (Payments)

```env
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_WEBHOOK_SECRET=""
# MP_NOTIFICATION_URL=""  # Optional - defaults to ${API_URL}/api/v1/webhooks/mercado-pago
```

### Provider Selection

```
Frontend
  → GET /api/v1/ai/providers
  → Filtered list (isActive=true), sorted by tier + cost

FREE user + currentCredits > 0
  → Only tier=FREE providers are selectable
  → Backend rejects requests to PRO providers

PAY_AS_YOU_GO / STARTER / PRO user
  → All active providers available
```

---

## Background Task Architecture

The background task system is **multi-tool and decoupled**. Any new tool integrates following the same pattern without modifying existing infrastructure.

### Flow Diagram — Thumbnail Generation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             USER (Browser)                               │
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
│           │                    │ (currentCredits)       │              │
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

AI providers are managed from the database (`Provider` table). The runtime registers implementations, but metadata (name, model, tier, cost, supported tasks) is read from the database.

### `Provider` Table

| Field            | Description                                 |
| ---------------- | ------------------------------------------- |
| `slug`           | Unique ID (`z-image-turbo`, `openai`, etc.) |
| `name`           | Display name                                |
| `model`          | AI model (`dall-e-3`, `FLUX.2-pro`, etc.)   |
| `tier`           | `FREE` or `PRO`                             |
| `costPerCredit`  | Credits consumed per generation             |
| `isActive`       | Available in the frontend?                  |
| `supportedTasks` | Array of supported tasks (e.g. `thumbnail`) |
| `config`         | Provider-specific configuration (JSON)      |

### Free Providers (tier: free)

| Provider              | Model                          | Supported Dimensions                | Cost     |
| --------------------- | ------------------------------ | ----------------------------------- | -------- |
| **Z-Image-Turbo**     | `Tongyi-MAI/Z-Image-Turbo`     | 1024x1024, 1280x720, 720x1280, etc. | 1 cr     |
| **SiliconFlow**       | `black-forest-labs/FLUX.2-pro` | 1024x1024 (ignores image_size)      | 1 cr     |
| **DeepSeek V4 Flash** | `deepseek-ai/DeepSeek-V4`      | Text generation / translation       | 5 cr     |
| **Deepgram (STT)**    | Nova-3                         | Speech-to-text (streaming)          | 1 cr/min |

### Paid Providers (tier: pro)

| Provider            | Model                     | Cost per image |
| ------------------- | ------------------------- | -------------- |
| **OpenAI**          | DALL-E 3                  | 10 credits     |
| **Gemini**          | Imagen 3                  | 5 credits      |
| **Stability AI**    | Stable Diffusion          | 8 credits      |
| **Flux**            | Flux Dev                  | 6 credits      |
| **DeepSeek V4 Pro** | `deepseek-ai/DeepSeek-V4` | 10 credits     |

### Selection Flow

```
Frontend
  → GET /api/v1/ai/providers
  → Renders compact selector (dropdown)
  → Sends selected provider in POST /generate

Backend: ThumbnailService.generate()
  → Looks up provider in DB by slug
  → If tier=PRO and plan=FREE → Error (upgrade required)
  → Verifies balance >= costPerCredit
  → Enqueues job with provider, providerId, providerTier, creditCost

Backend: ThumbnailProcessor.process()
  → Generates image with AI provider runtime
  → Deducts creditCost from user
  → Saves GeneratedImage with providerId and isProModel=(providerTier=PRO)
```

### Provider Registration

```typescript
// ProviderFactory registers implementations on module init.
// Metadata (tier, cost, etc.) is read from the Provider table at runtime.
new OpenAIImageProvider();
new GeminiProvider();
new StabilityAIProvider();
new FluxProvider();
new SiliconFlowProvider();
new ZImageTurboProvider();
new DeepSeekV4FlashProvider(); // free, 5 credits, text-generation
new DeepSeekV4ProProvider(); // pro, 10 credits, text-generation

// In development without SILICONFLOW_API_KEY:
new MockImageProvider(); // dev only
```

---

## Multi-Tool Integration Checklist

To add a new tool (e.g. `content-translator`):

| Layer        | File                                                 | Action                                                    |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| **Backend**  | `tools/content-translator/backend/`                  | Create processor, service, controller                     |
| **Backend**  | `thumbnail.processor.ts` → `translator.processor.ts` | Same pattern: AI → Store → DB                             |
| **Backend**  | `translation-listener.service.ts`                    | Call `registerTool()` with new channels                   |
| **Shared**   | `event.types.ts`                                     | Add `TranslationCompletedEvent`, `TranslationFailedEvent` |
| **Shared**   | `shared-utils/error.utils.ts`                        | Already reusable (no changes)                             |
| **Frontend** | `store/translator.store.ts`                          | Separate store for translator state                       |
| **Frontend** | `use-background-polling.ts`                          | Already generic (no changes, reads `toolId` from store)   |
| **Frontend** | `use-socket-events.ts`                               | Already generic (no changes, filters by `toolId`)         |
| **Frontend** | `tools/content-translator/page.tsx`                  | Full-screen page with two textareas                       |

### Key Packages

| Package                      | Responsibility                                     | Multi-Tool |
| ---------------------------- | -------------------------------------------------- | ---------- |
| `@creator-hub/domain-events` | Publisher/Subscriber interfaces + Redis impl       | ✅ Generic |
| `@creator-hub/shared-utils`  | `getFriendlyError()`, logging, utilities           | ✅ Generic |
| `@creator-hub/shared-types`  | `ToolJobUpdatePayload`, event interfaces           | ✅ Generic |
| `@creator-hub/storage`       | `uploadBuffer()`, `getPresignedDownloadUrl()`      | ✅ Generic |
| `@creator-hub/ai-engine`     | Multi-provider AI abstraction (tier-aware)         | ✅ Generic |
| `@creator-hub/stt-engine`    | STT streaming with provider registry               | ✅ Generic |
| `@creator-hub/billing`       | Credit system (free + purchased, marketing events) | ✅ Generic |
| `@creator-hub/ui`            | Button, Badge, Skeleton, etc.                      | ✅ Generic |
| `@creator-hub/ui`            | shadcn-style component library (Radix + Tailwind)  | ✅ Generic |

---

## Requirements

- Node.js >= 20
- pnpm 11
- Docker (for PostgreSQL, Redis, MinIO)

## Installation

```sh
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose up -d

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Generate Prisma client and migrate
pnpm db:generate
pnpm db:migrate

# 5. Run the project
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

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://creatorhub:creatorhub@localhost:5433/creatorhub"

# Redis
REDIS_URL="redis://localhost:6379"

# Storage (MinIO for development)
STORAGE_PROVIDER=minio
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
AWS_S3_ENDPOINT="http://localhost:9000"

# Auth
JWT_SECRET="your-secret-here"

# Email (Resend)
RESEND_API_KEY=""
RESEND_FROM_EMAIL="noreply@cesargarces.com"

# AI Providers — Free tier (at least one needed for development)
SILICONFLOW_API_KEY=""          # Required for Z-Image-Turbo, FLUX.2-pro, GLM-5.2

# AI Providers — Pro tier (optional)
OPENAI_API_KEY=""
GEMINI_API_KEY=""
STABILITY_AI_API_KEY=""

# MercadoPago (Payment Gateway)
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_WEBHOOK_SECRET=""

# App
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
```

> **Note:** In development without `SILICONFLOW_API_KEY`, a `MockImageProvider` is automatically registered that generates test images.

## Services

| Service       | URL                            |
| ------------- | ------------------------------ |
| Frontend      | http://localhost:3000          |
| Landing       | http://localhost:3002          |
| Admin Panel   | http://localhost:3003          |
| API           | http://localhost:3001          |
| Swagger       | http://localhost:3001/api/docs |
| MinIO Console | http://localhost:9001          |

## Admin Panel

Standalone admin panel in `apps/admin/`.

```
GET    /api/v1/admin/dashboard/stats          # General statistics
GET    /api/v1/admin/dashboard/usage          # Usage by provider/service
GET    /api/v1/admin/dashboard/top-users      # Top users
GET    /api/v1/admin/dashboard/registrations  # Registrations by month

GET    /api/v1/admin/providers                # List providers
POST   /api/v1/admin/providers                # Create provider
PUT    /api/v1/admin/providers/:id            # Edit provider
DELETE /api/v1/admin/providers/:id            # Delete provider

GET    /api/v1/admin/users                    # List users
POST   /api/v1/admin/users                    # Create user
PUT    /api/v1/admin/users/:id                # Edit user
POST   /api/v1/admin/users/:id/deactivate     # Deactivate user (soft delete)
POST   /api/v1/admin/users/:id/activate       # Reactivate user
```

**Features:**

- Dashboard with metrics and charts
- AI provider management (tier, cost, model, tasks)
- User management with soft delete (`isActive`)
- User credits are read-only in the admin panel
- Protection: cannot deactivate the last admin or oneself

## UI Components — shadcn-style

The UI is built with **shadcn/ui**-style components in `packages/ui/`. Each component is based on Radix primitives with Tailwind CSS v4 for styling, following the composition pattern (Header, Content, Footer, Trigger).

### Available Components

| Component             | Base             | Usage                                                              |
| --------------------- | ---------------- | ------------------------------------------------------------------ |
| `Button`              | CVA              | 7 variants: primary, secondary, ghost, danger, outline, glow, link |
| `Dialog`              | Manual Portal    | Centered modal with overlay                                        |
| `AlertDialog`         | Radix Dialog     | Confirmation (Cancel / Accept)                                     |
| `ActionConfirmDialog` | Manual Portal    | Confirmation with dynamic buttons                                  |
| `Sheet`               | Manual Portal    | Sliding side panel                                                 |
| `Popover`             | Radix Popover    | Notifications, floating tooltips                                   |
| `DropdownMenu`        | Radix Dropdown   | Dropdown action menu                                               |
| `Command`             | cmdk             | Command palette (⌘K)                                               |
| `ScrollArea`          | Radix ScrollArea | Custom scroll                                                      |
| `Switch`              | Radix Switch     | Toggle on/off                                                      |
| `Separator`           | Radix Separator  | Visual separator                                                   |
| `Tooltip`             | Radix Tooltip    | Hover tooltip                                                      |
| `Avatar`              | Radix Avatar     | Avatar with initials                                               |
| `Badge`               | —                | 7 badge variants                                                   |
| `Card`                | —                | Card with header/content/footer                                    |
| `Input` / `Textarea`  | —                | Form fields                                                        |
| `Skeleton`            | —                | Loading placeholder                                                |

### Z-Index Scale

| Layer            | z-index     |
| ---------------- | ----------- |
| Backdrop         | `z-[99997]` |
| Panel/Sheet      | `z-[99998]` |
| Popover/Dropdown | `z-[99999]` |

### Dependencies

- Radix primitives: `@radix-ui/react-dialog`, `react-popover`, `react-dropdown-menu`, `react-switch`, `react-scroll-area`, `react-separator`, `react-tooltip`, `react-avatar`
- `cmdk` for Command palette
- `class-variance-authority` for typed variants
- `clsx` + `tailwind-merge` → `cn()` utility
- `lucide-react` for icons (SVG, no emojis)

See `structure.md` for detailed file architecture.

---

## Email Verification

### Verification Flow

```
1. Registration → AuthService.register()
   → Generate 6-digit code + hash + store in DB
   → Send email via Resend (Handlebars template)
   → Return { user, accessToken, refreshToken, emailVerified: false }

2. Verification → POST /api/v1/auth/verify-email
   → User submits 6-digit code + email
   → Backend verifies: code matches, not expired (< 10min)
   → Set emailVerified = true, clear code
   → Update JWT payload

3. Resend → POST /api/v1/auth/resend-verification
   → Cooldown: 60 seconds between requests
   → Generates new code, sends new email
```

### Email Package (`@creator-hub/email`)

Provider-agnostic — swap Resend for AWS SES by implementing one interface:

```
packages/email/src/
├── email-provider.interface.ts    # Abstract EmailProvider class
├── email.service.ts               # Orchestrator (sendVerificationEmail, etc.)
├── email.module.ts                # NestJS module with factory provider
├── providers/
│   └── resend/
│       └── resend.provider.ts     # Resend implementation
└── templates/
    ├── template.helper.ts         # Handlebars template renderer (with cache)
    └── verification.hbs           # Verification email template
```

### Environment Variables (Email)

```env
RESEND_API_KEY="re_..."           # Resend API key
RESEND_FROM_EMAIL="noreply@cesargarces.com"  # Sender email
```

---

## AI Chat System

The chat widget is a floating global component (bottom-right) that communicates with the backend via SSE streaming. It dynamically discovers tools from `ToolRegistry` — zero code changes when adding new tools.

### Chat Architecture

```
┌─────────────────────────────────────────────────┐
│           ChatWidget (Bottom-Right FAB)          │
│  ┌─────────────────────────────────────────┐    │
│  │  Session tabs + Messages + Settings     │    │
│  │  Tool action cards (open tools inline)  │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────┘
                       │ POST /api/v1/chat (SSE)
                       ▼
┌──────────────────────────────────────────────────┐
│              ChatService                         │
│  1. Resolve tool routing (ChatRoutingService)    │
│  2. Build system prompt with tool registry       │
│  3. Stream via AI provider.generateStream()      │
│  4. Persist messages in ChatSession/ChatMessage  │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│           ChatRoutingService                     │
│  - Discovers tools from ToolRegistry at runtime  │
│  - Confidence scoring per tool                   │
│  - Trigger words per category (thumbnail, video) │
│  - System prompt: "You have these tools..."      │
└──────────────────────────────────────────────────┘
```

### Chat Features

- **Streaming**: SSE via `@Post` + `Readable` (not `@Sse` GET)
- **Tool Routing**: Dynamic discovery — zero code changes for new tools
- **Tool Action Cards**: LLM response contains JSON action block → parsed → rendered as clickable card → navigates to tool page
- **Settings Panel**: Model selection, temperature, max tokens, reasoning sliders
- **Session Management**: Create, switch, delete sessions
- **Widget Store**: Global Zustand store (`openWidget()` from any component)
- **User Style RAG**: Learn user's communication style and inject into responses (see below)

### User Style RAG

The chat system learns each user's communication style (tone, vocabulary, sentence structure, emoji usage) from content samples and injects this profile into the system prompt. This makes the assistant generate content in the user's voice.

**How it works:**

1. User adds content samples (manually or via bulk import)
2. User triggers analysis → LLM extracts style fingerprint (costs 1 credit)
3. Style profile saved to `UserStyleProfile` table
4. All subsequent chat responses match the user's style

**Style profile example:**

```
USER STYLE PROFILE (apply to ALL generated content):
- Tone: directo, provocativo, profesional
- Keywords: blockchain, escala, fricción
- Sentence length: short
- Emoji usage: moderate
- Formality: casual
IMPORTANT: Match this style strictly in your response.
```

**API Endpoints:**

```
GET    /api/v1/user-style/profile              # Get style profile
PUT    /api/v1/user-style/profile              # Update profile manually
DELETE /api/v1/user-style/profile              # Delete profile (reset)
POST   /api/v1/user-style/analyze              # Trigger analysis (1 credit)
POST   /api/v1/user-style/samples              # Add sample (min 10 chars)
POST   /api/v1/user-style/samples/bulk         # Bulk import (max 50)
GET    /api/v1/user-style/samples              # List samples (paginated)
DELETE /api/v1/user-style/samples/:id          # Delete sample
```

### Environment Variables (Chat)

```env
SILICONFLOW_API_KEY="..."  # Required for GLM-5.2 (siliconflow)
```

---

## X (Twitter) Integration

The platform includes full X (Twitter) integration with OAuth 2.0 PKCE authentication, tweet drafting with RAG-powered style injection, trend research via Apify, and one-click publishing.

### Features

- **OAuth 2.0 PKCE** — Secure authentication without exposing client secrets
- **Tweet Drafting** — AI-generated tweets using your communication style (User Style RAG)
- **Trend Research** — Real-time X trend analysis with AI-powered insights
- **One-Click Publishing** — Publish drafts directly to X
- **Credit System** — Research costs 25 credits, publishing costs 15 credits

### X Search Trends - Advanced Features

- **AI-Powered Query Generation** — Enter natural language in any language (Spanish, English, etc.), AI generates optimal X search queries
- **Quality Filtering** — Spam detection (NSFW, betting, crypto spam), low-authority account filtering
- **Sentiment Analysis** — Automatic positive/negative/neutral classification
- **Theme Extraction** — DeFi, NFT, Bitcoin, Ethereum, AI, Regulation, Trading, Gaming
- **AI Analysis** — Executive summary, key themes, key influencers (when >= 5 tweets available)
- **Auto-Refresh Tokens** — Automatic token renewal when expired (~2 hour lifetime)
- **Apify Fallback** — Backup search via Apify when X API returns no results

### X Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        X Integration Flow                            │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │  Connect X   │───▶│  Research    │───▶│  Draft Tweet │           │
│  │  Account     │    │  Trends      │    │  (RAG Style) │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│         │                   │                    │                   │
│         ▼                   ▼                    ▼                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │  OAuth 2.0   │    │  X API +     │    │  AI Engine   │           │
│  │  PKCE Flow   │    │  AI Query    │    │  + Style     │           │
│  └──────────────┘    │  Generation  │    │  Injection   │           │
│                      └──────────────┘    └──────────────┘           │
│                             │                    │                   │
│                             ▼                    ▼                   │
│                      ┌──────────────┐    ┌──────────────┐           │
│                      │  Quality     │    │  Publish     │           │
│                      │  Filtering + │    │  to X API    │           │
│                      │  AI Analysis │    └──────────────┘           │
│                      └──────────────┘                                │
│                             │                                        │
│                             ▼                                        │
│                      ┌──────────────┐                                │
│                      │  Apify       │                                │
│                      │  Fallback    │                                │
│                      └──────────────┘                                │
└──────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
# Social Account Management
GET    /api/v1/social/x/auth-url        # Get OAuth URL
POST   /api/v1/social/x/callback        # OAuth callback
GET    /api/v1/social/accounts          # List connected accounts
DELETE /api/v1/social/accounts/:id      # Disconnect account

# Tweet Drafts
POST   /api/v1/social/tweets/draft      # Generate tweet draft (RAG)
GET    /api/v1/social/tweets/drafts     # List drafts
GET    /api/v1/social/tweets/drafts/:id # Get draft
PATCH  /api/v1/social/tweets/drafts/:id # Edit draft
DELETE /api/v1/social/tweets/drafts/:id # Delete draft
POST   /api/v1/social/tweets/drafts/:id/publish  # Publish to X
```

### Tools

| Tool                | Description                                    | Credits |
| ------------------- | ---------------------------------------------- | ------- |
| **X Search Trends** | Research trending topics on X with AI analysis | 25 cr   |
| **X Post Tweet**    | Draft and publish tweets                       | 5 cr    |

### Environment Variables (X Integration)

```env
# X OAuth 2.0
X_CLIENT_ID=""
X_CLIENT_SECRET=""
X_REDIRECT_URI="https://creatorhub-qtod.onrender.com/api/v1/social/x/callback"

# Token Encryption
X_SOCIAL_ENCRYPTION_KEY=""  # 64-char hex key for AES-256-GCM

# Frontend URL (for OAuth redirect)
FRONTEND_URL="https://app.creatorhubplatform.com/"

# Apify (Fallback search when X API returns 0 results)
APIFY_API_TOKEN=""
APIFY_TWITTER_ACTOR_ID="apidojo/twitter-scraper-lite"
```

### Database Tables

| Table           | Description                                         |
| --------------- | --------------------------------------------------- |
| `SocialAccount` | Encrypted X tokens, user connection status          |
| `TweetDraft`    | Draft tweets with content, status, publish metadata |

### Tweet Draft Lifecycle

```
DRAFT → (user edits) → DRAFT → (publish) → PUBLISHED
                                         → FAILED (with error)
```

---

## API

The API exposes REST endpoints under `/api/v1`. Interactive documentation available via Swagger.

```
POST   /api/v1/auth/register          # Registration (assigns FREE + 100 credits)
POST   /api/v1/auth/login             # Login
POST   /api/v1/auth/verify-email      # Verify email code (6 digits)
POST   /api/v1/auth/resend-verification  # Resend code (60s cooldown)
GET    /api/v1/auth/verification-status/:email  # Verification status

GET    /api/v1/tools                  # List tools
GET    /api/v1/tools/:id              # Tool detail

GET    /api/v1/ai/providers           # List active providers (metadata from DB)

# Admin endpoints (require ADMIN role)
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

POST   /api/v1/tools/thumbnail-generator/generate       # Generate thumbnail (accepts width, height, provider)
GET    /api/v1/tools/thumbnail-generator/jobs/:id/status # Job status
GET    /api/v1/tools/thumbnail-generator/images          # User images

POST   /api/v1/tools/content-translator/translate       # Translate content (text, targetLanguage, provider)
GET    /api/v1/tools/content-translator/jobs/:id/status  # Job status

# AI Chat (streaming SSE)
POST   /api/v1/chat                    # Send message (streaming response)
GET    /api/v1/chat/sessions           # List user sessions
GET    /api/v1/chat/sessions/:id       # Messages from a session
PUT    /api/v1/chat/settings           # Update chat settings
GET    /api/v1/chat/tools              # List available tools for routing

# WebSocket events — Speech-to-Text (Content Translator)
Emit    stt:start → { language?, userId }               # Start STT session
Emit    stt:chunk → { sessionId, audio }                 # Audio chunk PCM (linear16)
Emit    stt:end → { sessionId }                          # End session and bill
On      stt:transcript → { transcript, isFinal }         # Partial/final transcript
On      stt:done → { sessionId, transcript, durationMs } # Session completed
On      stt:error → { code, message }                    # Error or insufficient credits

GET    /api/v1/credits/balance        # Balance (balance = currentCredits, plan)
GET    /api/v1/credits/marketing-events  # User marketing events
GET    /api/v1/credits/plans          # Subscription plans
POST   /api/v1/credits/subscribe      # Subscribe to a plan
POST   /api/v1/credits/checkout       # Create payment session (gateway, planId)
GET    /api/v1/credits/status/:gatewayTxId  # Transaction status

POST   /api/v1/webhooks/mercado-pago  # MercadoPago webhook (HMAC verification)
```

## Credit System

Users receive **100 free credits** upon registration. Cost per generation depends on the provider and is obtained from the `Provider` table (`costPerCredit`).

Balance is stored in a single `currentCredits` field which is the single source of truth:

| Field              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `currentCredits`   | Total user balance (free + purchased + bonus)        |
| `purchasedCredits` | Informative counter of purchased credits (read-only) |

When credits reach 0, an **upgrade modal** is shown with top-up options (minimum $10 USD).

---

## Observability — Sentry

Creator Hub uses **Sentry** for error tracking and performance monitoring across both frontend and backend. Each app has its own Sentry project with a separate DSN.

### What Sentry Captures

| Layer              | What                                                        |
| ------------------ | ----------------------------------------------------------- |
| **Backend errors** | Unhandled exceptions, validation errors, database errors    |
| **AI API calls**   | Provider selection, retries, rate limits (429), failures    |
| **Payments**       | Webhook received, verification, reconciliation results      |
| **Credits**        | Deductions, insufficient credits, balance changes           |
| **Frontend**       | React rendering errors, fetch failures, client-side crashes |
| **Performance**    | HTTP request duration, AI provider latency, page load times |
| **Session Replay** | Video replay of user sessions when errors occur             |

### Breadcrumbs

Sentry records "breadcrumbs" — a trail of what happened before an error. When something fails, you see the full context:

```
[info] User clicked "Generate"
[info] POST /tools/thumbnail/generate → 200
[info] Provider selection: [openai, siliconflow]
[info] Calling openai API — task: image-generation
[error] openai failed: 429 Too Many Requests
[warning] Retrying with next provider
[info] siliconflow responded in 1800ms
[info] Deducted 10 credits for user xxx
```

### PII Protection

All events are sanitized before sending to Sentry:

- Passwords, tokens, API keys → `[Filtered]`
- User prompts >200 chars → truncated
- IP addresses → never sent
- Session Replays → all text masked, media blocked

### Setup

**Backend (Render):**

1. Create project "creatorhub-api" in Sentry
2. Copy DSN → Set `SENTRY_DSN` in Render Environment Variables

**Frontend (Vercel):**

1. Create project "creatorhub-web" in Sentry
2. Copy DSN → Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel Environment Variables
3. Create Auth Token → Set `SENTRY_AUTH_TOKEN` for source maps upload

### Environment Variables (Sentry)

```env
# Backend (Render)
SENTRY_DSN="https://xxx@xxx.sentry.io/xxx"
SENTRY_ENVIRONMENT="production"
SENTRY_RELEASE=""
SENTRY_TRACES_SAMPLE_RATE="0.2"

# Frontend (Vercel)
NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.sentry.io/xxx"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_SENTRY_RELEASE=""

# Source Maps Upload (Vercel build time)
SENTRY_AUTH_TOKEN="sntrys_..."
SENTRY_ORG="cesar-garces"
SENTRY_PROJECT="creatorhub-web"
```

See [ARCHITECTURE.md](./ARCHITECTURE.md#17-observability--sentry) for full technical details.

---

## Pre-commit Hooks

The project uses **Husky** + **lint-staged** to ensure code quality before each commit:

- **ESLint**: Blocks commits with errors (warnings allowed)
- **Prettier**: Verifies code formatting

```sh
# Hooks are installed automatically with:
pnpm install
```

## Commands

```sh
pnpm dev              # Run frontend + landing + admin (excludes API)
pnpm dev:api          # Run only the API (nest start --watch)
pnpm dev:all          # Run everything including API
pnpm build            # Full build
pnpm lint             # Lint
pnpm test             # Tests
pnpm typecheck        # Type checking
pnpm format           # Format code

pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to DB
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed data
```

## License

MIT
