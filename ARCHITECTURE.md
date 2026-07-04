# Creator Hub — Architecture Document

> **Software Architecture Document**
> Modular SaaS platform for content creators. Designed for 1 → 50+ tools.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Tool Registry System](#3-tool-registry-system)
4. [AI Engine Design](#4-ai-engine-design)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [Event Architecture](#7-event-architecture)
8. [Credit System](#8-credit-system)
9. [Payment Gateway](#9-payment-gateway)
10. [Storage System](#10-storage-system)
11. [Authentication](#11-authentication)
12. [Testing Strategy](#12-testing-strategy)
13. [CI/CD Strategy](#13-cicd-strategy)
14. [Scalability Roadmap](#14-scalability-roadmap)
15. [Creating a New Tool](#15-creating-a-new-tool)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CREATOR HUB PLATFORM                           │
│                                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Tool #1 │  │ Tool #2 │  │ Tool #3 │  │ Tool #4 │  │ Tool #N │  │
│  │Thumbnail│  │ Content │  │  Title  │  │  Stream │  │ Future  │  │
│  │Generator│  │Translator│  │Generator│  │  Games  │  │  Tools  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  │
│       │            │            │            │            │        │
│       └────────────┴────────────┴────────────┴────────────┘        │
│                                │                                    │
│                    ┌───────────┴───────────┐                        │
│                    │    TOOL REGISTRY      │                        │
│                    │  (Auto-Discovery)     │                        │
│                    └───────────┬───────────┘                        │
│                                │                                    │
│  ┌──────────┬──────────┬───────┴───────┬──────────┬──────────┐     │
│  │  Auth    │ AI Engine│   Billing     │ Storage  │Analytics │     │
│  │ Package  │ Package  │   Package     │ Package  │ Package  │     │
│  │          │          │   + Payments  │          │          │     │
│  └──────────┴──────────┴───────────────┴──────────┴──────────┘     │
│                                │                                    │
│                    ┌───────────┴───────────┐                        │
│                    │       Database        │                        │
│                    │   (PostgreSQL+Prisma) │                        │
│                    └───────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Architectural Principles

| Principle              | Application                                                    |
| ---------------------- | -------------------------------------------------------------- |
| **Clean Architecture** | Dependencies point inward. Tools depend on SDK, not vice versa |
| **DDD**                | Each tool is a bounded context with its own domain             |
| **SOLID**              | Open/Closed: new tools don't modify existing code              |
| **Event-Driven**       | Tools communicate via BullMQ events, not direct calls          |
| **DI**                 | All cross-cutting concerns injected via NestJS DI              |
| **Modular Monolith**   | Single deployable initially, bounded contexts for future split |

---

## 2. Monorepo Structure

```
creator-hub/
├── turbo.json                 # Task orchestration
├── package.json               # Root scripts (delegates to turbo)
├── pnpm-workspace.yaml        # Workspace definition
├── docker-compose.yml         # PostgreSQL, Redis, MinIO
├── tsconfig.json              # Base TypeScript config
│
├── apps/
│   ├── web/                   # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── tools/[id]/
│   │   │   │   ├── credits/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── store/         # Zustand stores
│   │   │   │   ├── auth.store.ts
│   │   │   │   ├── tools.store.ts
│   │   │   │   └── credits.store.ts
│   │   │   └── lib/           # API client, query client
│   │   └── next.config.js
│   │
│   ├── admin/                 # Next.js admin panel (separate app)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx           # Dashboard
│   │   │   │   ├── providers/         # Provider CRUD
│   │   │   │   ├── users/             # User CRUD
│   │   │   │   └── login/             # Admin login
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── package.json
│   │
│   └── api/                   # NestJS backend
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts       # Root module imports all tools
│       │   ├── tool-sdk.module.ts   # Dynamic tool loader
│       │   └── modules/
│       │       ├── auth/
│       │       ├── credits/
│       │       ├── tools/
│       │       ├── images/
│       │       ├── ai/             # DB-driven provider metadata
│       │       ├── admin/
│       │       ├── webhooks/       # Payment gateway webhooks
│       │       └── websocket/      # WebSocket gateway + payment listener
│       ├── test/
│       │   └── jest-e2e.json
│       └── nest-cli.json
│
├── packages/
│   ├── shared-types/          # TypeScript interfaces (no runtime deps)
│   │   └── src/
│   │       ├── tool-registry.types.ts
│   │       ├── ai-engine.types.ts
│   │       ├── user.types.ts
│   │       ├── credit.types.ts
│   │       ├── event.types.ts          # + PaymentSuccessEvent
│   │       └── api.types.ts
│   │
│   ├── shared-utils/          # Pure utility functions
│   │   └── src/
│   │       ├── id.utils.ts
│   │       ├── credit.utils.ts
│   │       ├── string.utils.ts
│   │       ├── async.utils.ts
│   │       └── logger.utils.ts
│   │
│   ├── database/              # Prisma ORM
│   │   ├── prisma/
│   │   │   └── schema.prisma  # Full data model
│   │   └── src/
│   │       ├── index.ts       # Singleton PrismaClient
│   │       └── seed.ts
│   │
│   ├── auth/                  # JWT + Passport auth
│   ├── ai-engine/             # Multi-provider AI abstraction
│   ├── billing/               # Credits, subscriptions, payment gateways (Strategy pattern)
│   ├── storage/               # S3/MinIO abstraction
│   ├── analytics/             # Usage tracking
│   ├── ui/                    # Shared React components
│   ├── tool-sdk/              # Tool definition & registry
│   └── typescript-config/     # Shared TS configs
│
├── tools/
│   ├── thumbnail-generator/   # FIRST TOOL (reference implementation)
│   │   ├── index.ts           # Entry: registers tool + exports module
│   │   ├── frontend/
│   │   │   └── src/
│   │   │       └── components/
│   │   │           └── thumbnail-generator-page.tsx
│   │   ├── backend/
│   │   │   └── src/
│   │   │       ├── thumbnail-generator.module.ts
│   │   │       ├── thumbnail.service.ts
│   │   │       ├── thumbnail.controller.ts
│   │   │       └── thumbnail.processor.ts
│   │   └── package.json
│   │
│   └── content-translator/    # SECOND TOOL (text translation)
│       ├── index.ts           # Entry: registers tool + exports module
│       ├── frontend/
│       │   └── src/
│       │       └── components/
│       │           └── content-translator-page.tsx
│       ├── backend/
│       │   └── src/
│       │       ├── content-translator.module.ts
│       │       ├── content-translator.service.ts
│       │       ├── content-translator.controller.ts
│       │       └── content-translator.processor.ts
│       └── package.json
│
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 2b. UI Components — shadcn-style Library

La UI se construye con componentes estilo **shadcn/ui** en `packages/ui/`. Cada componente se basa en Radix primitives con Tailwind CSS v4, siguiendo el patrón de composición (Root, Trigger, Content, Header, Footer).

### Stack

| Capa            | Tecnología                                                                               |
| --------------- | ---------------------------------------------------------------------------------------- |
| Primitives      | Radix UI (Dialog, Popover, DropdownMenu, Switch, ScrollArea, Separator, Tooltip, Avatar) |
| Command palette | cmdk                                                                                     |
| Variantes       | class-variance-authority (CVA)                                                           |
| Utilidad clases | clsx + tailwind-merge → `cn()`                                                           |
| Íconos          | lucide-react (SVG, no emojis)                                                            |
| Animaciones     | tailwindcss-animate                                                                      |
| Estilos         | Tailwind CSS v4, CSS-first con `@theme {}`                                               |

### Componentes

| Componente            | Base             | Uso                                                                    |
| --------------------- | ---------------- | ---------------------------------------------------------------------- |
| `Button`              | CVA              | 7 variantes: primary, secondary, ghost, danger, outline, glow, link    |
| `Dialog`              | Portal manual    | Modal centrado con overlay                                             |
| `AlertDialog`         | Radix Dialog     | Confirmación (Cancelar / Aceptar)                                      |
| `ActionConfirmDialog` | Portal manual    | Confirmación con botones dinámicos                                     |
| `Sheet`               | Portal manual    | Panel lateral deslizante                                               |
| `Popover`             | Radix Popover    | Notificaciones, tooltips flotantes                                     |
| `DropdownMenu`        | Radix Dropdown   | Menú desplegable de acciones                                           |
| `Command`             | cmdk             | Paleta de comandos (⌘K)                                                |
| `ScrollArea`          | Radix ScrollArea | Scroll personalizado                                                   |
| `Switch`              | Radix Switch     | Toggle on/off                                                          |
| `Separator`           | Radix Separator  | Divisor visual                                                         |
| `Tooltip`             | Radix Tooltip    | Tooltip hover                                                          |
| `Avatar`              | Radix Avatar     | Avatar con iniciales                                                   |
| `Badge`               | —                | 7 variantes: primary, secondary, accent, error, warning, free, premium |
| `Card`                | —                | Card con Header/Content/Footer                                         |
| `Input` / `Textarea`  | —                | Campos de formulario                                                   |
| `Skeleton`            | —                | Placeholder de carga                                                   |
| `ToolCard`            | —                | Tarjeta de herramienta                                                 |
| `CreditDisplay`       | —                | Visualización de créditos                                              |
| `EmptyState`          | —                | Estado vacío con ícono y mensaje                                       |

### Z-Index Scale

| Capa             | z-index     |
| ---------------- | ----------- |
| Backdrop         | `z-[99997]` |
| Panel/Sheet      | `z-[99998]` |
| Popover/Dropdown | `z-[99999]` |

### Convenciones

- **Íconos**: SVG de Lucide, NO emojis para íconos funcionales
- **Tokens CSS**: `--color-primary`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-text-dim`
- **Dark mode**: `--color-bg: #0b0f19`, `--color-surface: #121826`, `--color-surface-elevated: #1a2236`, `--color-text: #f1f5f9`
- **Tipografía**: Inter (sans) + JetBrains Mono (mono), `font-feature-settings: "rlig" 1, "calt" 1`
- **Touch targets**: Mínimo 44px (`py-2.5` / `px-6` en items interactivos)
- **Animaciones**: 150-300ms, `ease-out` para entrada, portales a `document.body` vía `createPortal`

### Arquitectura de archivos

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── button.tsx                # CVA variants
│   │   ├── dialog.tsx                # Portal-based modal
│   │   ├── alert-dialog.tsx          # Radix AlertDialog
│   │   ├── action-confirm-dialog.tsx # Dynamic button labels
│   │   ├── sheet.tsx                 # Slide panel
│   │   ├── popover.tsx               # Radix Popover
│   │   ├── dropdown-menu.tsx         # Radix DropdownMenu
│   │   ├── command.tsx               # cmdk palette
│   │   ├── scroll-area.tsx           # Radix ScrollArea
│   │   ├── switch.tsx                # Radix Switch
│   │   ├── separator.tsx             # Radix Separator
│   │   ├── tooltip.tsx               # Radix Tooltip
│   │   ├── avatar.tsx                # Radix Avatar
│   │   ├── badge.tsx                 # Variants
│   │   ├── card.tsx                  # Card layout
│   │   ├── input.tsx                 # Styled input
│   │   ├── textarea.tsx              # Styled textarea
│   │   ├── skeleton.tsx              # Loading placeholder
│   │   ├── tool-card.tsx             # Tool card
│   │   ├── credit-display.tsx        # Credits display
│   │   └── empty-state.tsx           # Empty state
│   ├── lib/
│   │   └── utils.ts                  # cn() utility
│   └── index.ts                      # All exports
└── package.json
```

---

## 3. Tool Registry System

### Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Tool Registry               │
                    │         (Central Registry)           │
                    ├─────────────────────────────────────┤
                    │  - register(manifest)                │
                    │  - get(toolId)                       │
                    │  - getAll()                          │
                    │  - getActive()                       │
                    │  - getFrontendRoutes()               │
                    └──────────┬──────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
  ┌───────▼──────┐    ┌───────▼──────┐    ┌───────▼──────┐
  │  Tool #1     │    │  Tool #2     │    │  Tool #N     │
  │  Thumbnail   │    │  Title Gen   │    │  Future      │
  │  Generator   │    │  (Future)    │    │  Tools       │
  └──────────────┘    └──────────────┘    └──────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Tool SDK         │
                    │  (Package)        │
                    └───────────────────┘
```

### Tool Manifest Structure

```typescript
// A tool registers itself via its entry point (index.ts)
registerTool({
  id: "thumbnail-generator", // Unique identifier
  name: "Thumbnail Generator", // Display name
  description: "Generate...", // Description
  icon: "🎨", // Icon
  category: "thumbnail", // Category for filtering
  creditsPerUse: 10, // Cost per use
  permissions: [
    // Fine-grained permissions
    { action: "generate", resource: "thumbnail" },
  ],
  frontend: {
    routes: [
      // Frontend routes
      {
        path: "/tools/thumbnail-generator",
        component: "ThumbnailGeneratorPage",
        title: "Thumbnail Generator",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: ThumbnailGeneratorModule, // NestJS module
    events: ["image.generated"], // Events it emits
  },
});
```

### Auto-Discovery Flow

```
app.module.ts
    │
    ├── imports: [
    │     ThumbnailGeneratorModule,  // Import tool module
    │   ]
    │
    └── ToolSdkModule (global)
            │
            ├── ToolRegistry         // Holds all manifests
            │
            └── ToolDiscoveryService // OnModuleInit: discovers tools
                    │
                    └── loadTools()  // Reads registered manifests
                            │
                            └── registry.register(manifest)
```

---

## 4. AI Engine Design

### Provider Pattern

```
┌───────────────────────────────────────────┐
│             AIEngineService                │
│  (High-level API for tools)               │
│                                           │
│  execute(request) → AIResponse            │
│  generateImage(prompt, opts) → AIResponse │
└─────────────────┬─────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────┐
│           ProviderRegistry                │
│  register(provider)                       │
│  getProvider(name)                        │
│  getProvidersByTask(taskType)             │
└─────────────────┬─────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────┐
│            ProviderFactory                │
│  onModuleInit(): registers all providers  │
└──────────┬──────────────────┬─────────────┘
           │                  │
    ┌──────▼──────┐    ┌──────▼──────┐
    │ AIProvider  │    │ AIProvider  │
    │ Interface   │    │ Interface   │
    └──────┬──────┘    └──────┬──────┘
           │                  │
    ┌──────▼──────────┐ ┌──────▼──────────┐
    │ OpenAIImage     │ │ NanoBanana      │
    │ Provider        │ │ Provider        │
    ├────────────────┤ ├────────────────┤
    │ name: "openai"  │ │ name: "nano-    │
    │ supportedTasks: │ │   banana"       │
    │  image-gen      │ │ supportedTasks: │
    │  text-gen       │ │  image-gen      │
    │  text-analysis  │ │  text-gen       │
    └─────────────────┘ └─────────────────┘

    ┌──────────────────┐  ┌──────────────────┐
    │ GeminiProvider   │  │ FluxProvider     │
    ├────────────────┤  ├────────────────┤
    │ name: "gemini"   │  │ name: "flux"     │
    └──────────────────┘  └──────────────────┘

    ┌──────────────────┐
    │ StabilityAI      │
    │ Provider         │
    ├────────────────┤
    │ name: "stability-ai"│
    └──────────────────┘

    ┌──────────────────┐  ┌──────────────────┐
    │ DeepSeekV4Flash  │  │ DeepSeekV4Pro    │
    │ Provider         │  │ Provider         │
    ├────────────────┤  ├────────────────┤
    │ name: "deepseek-  │  │ name: "deepseek-  │
    │   v4"            │  │   v4-pro"        │
    │ tier: free       │  │ tier: pro        │
    │ cost: 5 credits  │  │ cost: 10 credits │
    │ tasks:           │  │ tasks:           │
    │  text-generation │  │  text-generation │
    │  translation     │  │  translation     │
    └──────────────────┘  └──────────────────┘
```

### Provider Interface

```typescript
interface AIProviderInterface {
  readonly name: AIProvider;
  readonly supportedTasks: AITaskType[];
  readonly supportedModels: string[];

  generate(request: AIRequest): Promise<AIResponse>;
  generateImage(options: ImageGenerationOptions): Promise<AIResponse>;
  validateConfig(): boolean; // Checks if API keys exist
}
```

### Provider Selection Strategy

Provider metadata (name, model, tier, cost, active status, supported tasks) lives in the `Provider` table and is exposed via `GET /api/v1/ai/providers`. Runtime provider implementations are still registered in `ProviderFactory` / `ProviderRegistry`, but their configuration is DB-driven.

When a tool calls `aiEngine.execute(request)`:

1. Frontend fetches active providers from `GET /api/v1/ai/providers`
2. User selects a provider; frontend sends `provider` slug in the request
3. Backend validates the provider exists in DB and respects user plan tier
4. If `request.provider` is specified → use directly (after DB validation)
5. Otherwise → select optimal provider from registry
6. Provider selection is based on: task type match, priority, availability, plan restrictions
7. Tools never hardcode provider names or costs

### Provider Tiers

Providers are classified by tier in the `Provider` table:

| Tier   | Providers                               | Used By                     |
| ------ | --------------------------------------- | --------------------------- |
| `free` | Z-Image-Turbo, SiliconFlow (FLUX.2-pro) | FREE plan users             |
| `pro`  | OpenAI, Gemini, Stability AI, Flux      | PAY_AS_YOU_GO, STARTER, PRO |

The `ProviderRegistry` exposes runtime provider instances:

- `getFreeProviders()` — Returns only free-tier runtime providers
- `getProProviders()` — Returns only pro-tier runtime providers
- `getAllProviders()` — Returns all registered runtime providers
- `isRegistered(name)` — Checks if a runtime provider is available

The `AIController` exposes DB-driven provider metadata:

- `GET /api/v1/ai/providers` — Returns active providers with `id`, `name`, `displayName`, `tier`, `costPerCredit`, `model`, `supportedTasks`

---

## 5. Database Schema

```
┌──────────────────────────┐     ┌────────────────────────┐
│       User               │     │       Tool             │
├──────────────────────────┤     ├────────────────────────┤
│ id (PK)                  │◄────┤ id (PK)                │
│ email (UQ)               │     │ name                   │
│ name                     │     │ description            │
│ passwordHash             │     │ category               │
│ role (USER/PREMIUM/ADMIN)│     │ creditsPerUse          │
│ plan (FREE/PAY_AS_YOU_GO/│     │ status                 │
│       PREMIUM/STARTER/PRO)│     │ configSchema (JSON)    │
│ currentCredits (def 100) │     └────────┬───────────────┘
│ purchasedCredits (def 0) │              │
│ isActive                 │              │
│ createdAt                │              │
└──────┬───────────────────┘              │
       │                                 │
       │ 1:1                             │ 1:1
       ▼                                 ▼
┌────────────────────────┐   ┌───────────────────────┐
│  CreditTransaction     │   │     ToolConfig        │
├────────────────────────┤   ├───────────────────────┤
│ id (PK)                │   │ toolId (FK,UQ)        │
│ userId (FK)            │   │ enabled               │
│ amount                 │   │ creditsPerUse         │
│ type (USAGE/PURCHASE/  │   │ maxUsesPerDay         │
│   REFUND/BONUS/        │   │ allowedRoles          │
│   SUBSCRIPTION/PROMO)  │   │ providerOverrides(JSON)│
│ description            │   └───────────────────────┘
│ toolId (FK, optional)  │
│ balance (post-txn)     │   ┌─────────────────────────┐
│ createdAt              │   │   GeneratedImage        │
└────────────────────────┘   ├─────────────────────────┤
                             │ id (PK)                 │
                             │ userId (FK)             │
                             │ toolId (FK)             │
                             │ providerId (FK)         │
┌──────────────────────────┐ │ prompt                  │
│   MarketingEvent         │ │ provider                │
├──────────────────────────┤ │ prompt                  │
│ id (PK)                  │ │ provider                │
│ userId (FK)              │ │ model                   │
│ type (CREDIT_THRESHOLD_  │ │ url                     │
│   75/25/10/5/DEPLETED)  │ │ width, height           │
│ credits                  │ │ isProModel              │
│ metadata (JSON)          │ │ credits                 │
│ createdAt                │ │ createdAt               │
└──────────────────────────┘ └─────────────────────────┘

                             ┌─────────────────────────┐
                             │       Provider          │
                             ├─────────────────────────┤
                             │ id (PK)                 │
                             │ slug (UQ)               │
                             │ name                    │
                             │ model                   │
                             │ tier (FREE/PRO)         │
                             │ costPerCredit           │
                             │ isActive                │
                             │ supportedTasks          │
                             │ config (JSON)           │
                             │ createdAt, updatedAt    │
                             └─────────────────────────┘

┌─────────────────────┐   ┌─────────────────────┐
│   Subscription      │   │   UsageLog          │
├─────────────────────┤   ├─────────────────────┤
│ userId (FK)         │   │ userId (FK)         │
│ planId (FK)         │   │ toolId (FK)         │
│ status              │   │ credits             │
│ currentPeriodStart  │   │ duration            │
│ currentPeriodEnd    │   │ success             │
│ creditsThisPeriod   │   │ metadata (JSON)     │
└──────┬──────────────┘   │ createdAt           │
       │                  └─────────────────────┘
       │
       ▼
┌─────────────────────┐
│  SubscriptionPlan   │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ price (cents)       │
│ creditsPerMonth     │
│ features (string[]) │
│ tools (string[])    │
└─────────────────────┘
```

### Key Schema Changes

- **No `CreditBalance` model** — Credits live directly on `User` as `currentCredits` (single source of truth)
- **`purchasedCredits`** — Informational counter only, not used for balance deduction
- **`UserPlan` enum** — `FREE`, `PAY_AS_YOU_GO`, `PREMIUM`, `STARTER`, `PRO`
- **`UserRole` enum** — `USER`, `ADMIN`
- **`PaymentGateway` enum** — `MERCADO_PAGO`, `PAYPAL` (used in `CreditTransaction.provider`)
- **`MarketingEvent`** — Tracks credit threshold events for conversion analytics
- **`Provider` model** — Metadata de proveedores IA (slug, name, model, tier, costPerCredit, isActive, supportedTasks, config)
- **`GeneratedImage.providerId`** — Relación con `Provider`; `isProModel` se deriva del tier del proveedor
- **Soft delete** — Users use `isActive: false` instead of `DELETE`

---

## 6. API Design

### REST API Endpoints

```
POST   /api/v1/auth/register         # Register user (FREE plan + 100 credits)
POST   /api/v1/auth/login            # Login

GET    /api/v1/tools                 # List active tools
GET    /api/v1/tools/:id             # Get tool details
GET    /api/v1/tools/routes          # Get all frontend routes

GET    /api/v1/ai/providers          # List active AI providers from DB

POST   /api/v1/images/generate       # Generate image (generic)

POST   /api/v1/tools/thumbnail-generator/generate  # Generate (accepts width, height, provider)
GET    /api/v1/tools/thumbnail-generator/jobs/:id/status
GET    /api/v1/tools/thumbnail-generator/images     # User's images

POST   /api/v1/tools/content-translator/translate   # Translate (text, targetLanguage, provider)
GET    /api/v1/tools/content-translator/jobs/:id/status

GET    /api/v1/credits/balance       # Get balance (balance = currentCredits, plan)
GET    /api/v1/credits/marketing-events  # Marketing events for user
GET    /api/v1/credits/plans         # List subscription plans
POST   /api/v1/credits/subscribe     # Subscribe to plan
POST   /api/v1/credits/checkout      # Create checkout session (gateway, planId)
GET    /api/v1/credits/status/:gatewayTxId  # Transaction status

# Payment webhooks (no auth — verified by gateway signature)
POST   /api/v1/webhooks/mercado-pago # MercadoPago webhook (HMAC verification)
POST   /api/v1/webhooks/paypal       # PayPal webhook (planned)

# Admin module
GET    /api/v1/admin/dashboard/stats       # General stats
GET    /api/v1/admin/dashboard/usage       # Usage by provider/service
GET    /api/v1/admin/dashboard/top-users   # Top users
GET    /api/v1/admin/dashboard/registrations # Monthly registrations

GET    /api/v1/admin/providers             # List providers
POST   /api/v1/admin/providers             # Create provider
PUT    /api/v1/admin/providers/:id         # Update provider
DELETE /api/v1/admin/providers/:id         # Delete provider

GET    /api/v1/admin/users                 # List users
POST   /api/v1/admin/users                 # Create user
PUT    /api/v1/admin/users/:id             # Update user
POST   /api/v1/admin/users/:id/deactivate  # Soft delete user
POST   /api/v1/admin/users/:id/activate    # Reactivate user

GET    /api/v1/admin/tools           # List all tools (admin)
POST   /api/v1/admin/tools/toggle    # Enable/disable tool
```

### API Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "INSUFFICIENT_CREDITS", "message": "..." } }

// Paginated
{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
```

---

## 7. Event Architecture

```
                    ┌─────────────────────┐
                    │   Redis (BullMQ)    │
                    │   Event Bus         │
                    └────────┬────────────┘
                             │
           ┌─────────────────┼──────────────────┐
           │                 │                   │
    ┌──────▼──────┐  ┌──────▼──────┐   ┌───────▼────────┐
    │  Credits    │  │  Analytics  │   │   Tool-Specific│
    │  Queue      │  │  Queue      │   │   Queues       │
    ├─────────────┤  ├─────────────┤   ├────────────────┤
    │ deduct      │  │ track-usage │   │ thumbnail-gen  │
    │ add credits │  │ user-stats  │   │ title-gen      │
    │ expire      │  │ report      │   │ image-processing│
    └─────────────┘  └─────────────┘   └────────────────┘
```

### Event Types

| Event                       | Producer              | Consumer              | Purpose                 |
| --------------------------- | --------------------- | --------------------- | ----------------------- |
| `tool.used`                 | All tools             | Analytics, Credits    | Track usage             |
| `credits.deducted`          | CreditService         | Notifications         | Alert user              |
| `credits.depleted`          | CreditService         | Notifications         | Prompt purchase         |
| `marketing.credit_depleted` | CreditService         | MarketingEventHandler | Marketing events        |
| `marketing.threshold`       | MarketingEventHandler | MarketingEvent DB     | Threshold tracking      |
| `payment:success`           | CreditBillingService  | PaymentListener       | Real-time credit update |
| `ai.request.completed`      | AIEngine              | Analytics, Billing    | Track costs             |
| `image.generated`           | Thumbnail             | Storage, Notify       | Save & notify           |
| `translation.completed`     | ContentTranslator     | Notify                | Deliver result          |
| `translation.failed`        | ContentTranslator     | Notify                | Error handling          |
| `payment:success`           | CreditBillingService  | PaymentListener       | Notify user via WS      |
| `stt:transcript`            | AppGateway            | Frontend              | Live transcript         |
| `stt:done`                  | AppGateway            | Frontend              | Session complete        |
| `stt:error`                 | AppGateway            | Frontend              | Session error           |

### Event-Driven Flow Example — Thumbnail

```
User clicks "Generate" in Thumbnail Generator
    │
    ├──► Frontend: GET /ai/providers (cached, DB-driven metadata)
    │
    ├──► Frontend: POST /tools/thumbnail-generator/generate
    │       │        (includes provider slug, width, height)
    │       │
    │       ├──► ThumbnailService.generate()
    │       │       ├──► Lookup provider in DB (tier, costPerCredit)
    │       │       ├──► Validate plan vs provider tier (FREE cannot use PRO)
    │       │       ├──► Check totalCredits >= costPerCredit
    │       │       └──► Enqueue BullMQ job with providerId + providerTier
    │       │
    │       ├──► BullMQ: "thumbnail-generation" queue
    │       │       │
    │       │       └──► ThumbnailProcessor.process()
    │       │               ├──► AIEngineService.generateImage()
    │       │               │       └──► Runtime AI Provider generate()
    │       │               ├──► StorageService.uploadBuffer()
    │       │               ├──► CreditService.deduct(creditCost)
    │       │               │       └──► emits "credits.deducted"
    │       │               └──► GeneratedImage.create(providerId, credits=creditCost)
    │       │
    │       └──► Returns { jobId }
    │
    ├──► WebSocket: "tool_job_updated" → presigned URL
    │
    └──► Frontend shows image, updates credit balance
```

### Event-Driven Flow Example — Content Translator

```
User clicks "Translate" in Content Translator
    │
    ├──► Frontend: GET /ai/providers (filtered by supportedTasks: "translator")
    │
    ├──► Frontend: POST /tools/content-translator/translate
    │       │        (includes text, targetLanguage, provider slug)
    │       │
    │       ├──► ContentTranslatorService.translate()
    │       │       ├──► Lookup provider in DB (tier, costPerCredit)
    │       │       ├──► Validate plan vs provider tier
    │       │       ├──► Check totalCredits >= costPerCredit
    │       │       └──► Enqueue BullMQ job with text, targetLanguage, provider
    │       │
    │       ├──► BullMQ: "content-translation" queue
    │       │       │
    │       │       └──► ContentTranslatorProcessor.process()
    │       │               ├──► AIEngineService.execute()
    │       │               │       ├──► System prompt: professional translator
    │       │               │       └──► Runtime AI Provider generate() (DeepSeek V4)
    │       │               ├──► CreditService.deduct(creditCost)
    │       │               │       └──► emits "credits.deducted"
    │       │               └──► Emits "translation.completed" via TranslationListenerService
    │       │
    │       └──► Returns { jobId }
    │
    ├──► WebSocket: "tool_job_updated" → { translation, sourceLanguage, targetLanguage }
    │
    └──► Frontend shows translated text, updates credit balance
```

### Event-Driven Flow Example — STT Streaming (Content Translator)

```
User clicks Mic button in Content Translator
    │
    ├──► Frontend: useLiveSpeechToText checks plan tier
    │       ├──► FREE tier: creditCostPerUse = 1 credit/minute, minCreditsForSTT = 5
    │       └──► PRO tier: creditCostPerUse = 2 credits/minute, minCreditsForSTT = 10
    │
    ├──► Frontend: waitForConnection() — ensures WebSocket connected
    │
    ├──► Frontend: AudioContext.createSampleRate(16000)
    │       ├──► navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
    │       ├──► ScriptProcessorNode for real-time PCM capture
    │       └──► downsampleBuffer() — Float32 → Int16, linear16 encoding
    │
    ├──► WebSocket: "stt:start" → { language?, userId }
    │       │
    │       ├──► STTEngineService.startSession()
    │       │       ├──► STTSessionManager.createSession()
    │       │       │       ├──► Create DeepgramProvider (or MockSTTProvider)
    │       │       │       ├──► Connect to wss://api.deepgram.com/v1/listen
    │       │       │       │       ├──► Model: nova-3
    │       │       │       │       ├──► Encoding: linear16
    │       │       │       │       ├──► Sample rate: 16000
    │       │       │       │       ├──► Channels: 1
    │       │       │       │       └──► Smart format: true
    │       │       │       ├──► Start 3-minute hard timeout
    │       │       │       └──► Return session
    │       │       └──► CreditService.deductMinCredits(userId, 5)
    │       │
    │       └──► Returns { session, sessionId }
    │
    ├──► AudioContext captures audio → ScriptProcessorNode callback
    │       │
    │       ├──► downsampleBuffer() → Int16Array (linear16 PCM)
    │       │
    │       └──► WebSocket: "stt:chunk" → { sessionId, audio }
    │               │
    │               └──► STTEngineService.writeAudioChunk()
    │                       ├──► SessionManager.getSession(sessionId)
    │                       └──► DeepgramProvider.sendAudio(buffer)
    │
    ├──► Deepgram → Partial transcript
    │       │
    │       └──► WebSocket: "stt:transcript" → { transcript, isFinal: false }
    │               └──► Frontend: translatorStore.appendLiveTranscript(transcript)
    │                       └──► liveTranscript += text (word-by-word)
    │
    ├──► Deepgram → Final transcript (sentence complete)
    │       │
    │       └──► WebSocket: "stt:transcript" → { transcript, isFinal: true }
    │               └──► Frontend: translatorStore.commitLiveTranscript(transcript)
    │                       ├──► liveTranscriptFinal += text (committed)
    │                       └──► liveTranscript = "" (reset for next chunk)
    │
    ├──► User clicks Mic again (stop) or 3-min timeout fires
    │       │
    │       ├──► Frontend: AudioContext.close() + ScriptProcessorNode disconnect
    │       │
    │       ├──► WebSocket: "stt:end" → { sessionId }
    │       │       │
    │       │       ├──► STTEngineService.endSession()
    │       │       │       ├──► DeepgramProvider.close()
    │       │       │       ├──► Stop hard timeout
    │       │       │       ├──► Calculate duration, billable minutes
    │       │       │       └──► Return transcript
    │       │       │
    │       │       └──► CreditService.deductForDuration(userId, duration, creditCostPerMinute)
    │       │
    │       ├──► WebSocket: "stt:done" → { sessionId, transcript, durationMs }
    │       │
    │       └──► Frontend: sourceText = finalTranscript (ready for translation)
    │
    └──► User can now click "Translate" → normal Content Translator flow
```

### STT Event Types

| Event            | Producer    | Consumer    | Purpose                         |
| ---------------- | ----------- | ----------- | ------------------------------- |
| `stt:start`      | Frontend    | API Gateway | Start STT session               |
| `stt:chunk`      | Frontend    | API Gateway | Stream audio chunk to Deepgram  |
| `stt:transcript` | API Gateway | Frontend    | Partial/final transcript update |
| `stt:end`        | Frontend    | API Gateway | End session, bill remaining     |
| `stt:done`       | API Gateway | Frontend    | Final transcript + duration     |
| `stt:error`      | API Gateway | Frontend    | Session error or credit issue   |

---

## 8. Credit System

### Credit Types

| Field              | Description                                               | Deduction |
| ------------------ | --------------------------------------------------------- | --------- |
| `currentCredits`   | Saldo total del usuario (gratis + comprados + bonus)      | Se usa    |
| `purchasedCredits` | Contador informativo de créditos comprados (solo lectura) | No se usa |

### Flow

```
                    ┌──────────────┐
                    │ Registration │
                    │ (FREE plan)  │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │  User        │
                    │  current     │
                    │  Credits=100 │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌────────────┐   ┌──────────────┐   ┌────────────┐
  │ Tool Use   │   │ Purchase     │   │ Upgrade    │
  │ -5 credit  │   │ +N credits   │   │ Plan       │
  │ (flat)     │   │ (purchased)  │   │            │
  └────────────┘   └──────────────┘   └────────────┘
```

### Credit Decision Flow

```
User requests tool usage
    │
    ├──► Check currentCredits
    │      ├──► Sufficient? → Deduct (decrement currentCredits)
    │      │                  ├──► Execute tool
    │      │                  ├──► Record CreditTransaction
    │      │                  └──► Check thresholds → MarketingEvent
    │      │
    │      └──► Insufficient?
    │             ├──► Return error
    │             └──► Emit "marketing.credit_depleted" → MarketingEvent
    │
    └──► Return result
```

### Marketing Events

Events emitted when credit thresholds are crossed:

| Event Type            | Threshold  | Purpose           |
| --------------------- | ---------- | ----------------- |
| `CREDIT_THRESHOLD_75` | 75 credits | Early engagement  |
| `CREDIT_THRESHOLD_25` | 25 credits | Nudge to purchase |
| `CREDIT_THRESHOLD_10` | 10 credits | Urgency           |
| `CREDIT_THRESHOLD_5`  | 5 credits  | Critical          |
| `CREDIT_DEPLETED`     | 0 credits  | Upgrade modal     |

### Credit Costs

Provider-specific cost: each `Provider` row defines `costPerCredit`. ThumbnailService reads this value at request time and passes it to the worker. Credit deduction uses the actual provider cost, not a flat rate.

### Provider Selection by Plan

```
Frontend
  → GET /ai/providers
  → Render only selectable providers
  → PRO providers disabled for FREE plan

Backend validation
  → FREE + provider.tier=PRO → Error (upgrade required)
  → FREE + provider.tier=FREE + currentCredits >= costPerCredit → OK
  → PAY_AS_YOU_GO / STARTER / PRO + currentCredits >= costPerCredit → OK
```

### Admin Management

Admins can manage providers and users via `AdminModule`:

```
AdminController
  ├── AdminGuard (role === ADMIN)
  ├── Providers CRUD
  └── Users CRUD (soft delete via isActive)
```

User credits are **editable** in admin. Soft delete prevents accidental data loss and preserves historical records.

---

## 9. Payment Gateway

### Architecture — Strategy Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PaymentRegistryService                           │
│  (Orchestrator — resolves strategy by PaymentGateway enum)          │
├─────────────────────────────────────────────────────────────────────┤
│  getGateway(type) → IPaymentGateway                                │
│  listSupported() → PaymentGateway[]                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
   ┌───────▼──────┐   ┌───────▼──────┐   ┌───────▼──────┐
   │ MercadoPago  │   │   PayPal     │   │   Stripe     │
   │   Strategy   │   │  (Planned)   │   │  (Planned)   │
   ├──────────────┤   ├──────────────┤   ├──────────────┤
   │ COP payments │   │ USD payments │   │ Multi-curr   │
   │ HMAC verify  │   │ Webhook verify│  │ Webhook verify│
   └──────────────┘   └──────────────┘   └──────────────┘
           │                   │                   │
           └───────────────────┴───────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │     IPaymentGateway           │
               │     (Contract/Interface)       │
               ├───────────────────────────────┤
               │ getGatewayType()              │
               │ createCheckoutSession(dto)    │
               │ verifyWebhook(headers, body)  │
               └───────────────────────────────┘
```

### Package Structure

```
packages/billing/src/
├── interfaces/
│   └── payment-gateway.interface.ts    # IPaymentGateway, DTOs, enums
├── strategies/
│   └── mercado-pago.strategy.ts        # MercadoPago SDK adapter
├── services/
│   ├── payment-registry.service.ts     # Strategy registry (Map<Gateway, Strategy>)
│   └── credit-billing.service.ts       # Idempotent reconciliation + Redis event
└── billing.module.ts                   # DI: strategies → factory → registry
```

### Interface Contract

```typescript
// IPaymentGateway — every strategy MUST implement this
interface IPaymentGateway {
  getGatewayType(): PaymentGateway;
  createCheckoutSession(data: CreateCheckoutDto): Promise<CheckoutResponse>;
  verifyWebhook(
    headers: any,
    body: any,
    rawBody?: Buffer,
  ): Promise<WebhookVerificationResult>;
}

// DTOs
interface CreateCheckoutDto {
  userId: string;
  amount: number;
  currency: "COP" | "USD";
  creditsToBuy: number;
  description: string;
}

interface CheckoutResponse {
  paymentUrl: string; // Redirect user to pay
  gatewayTxId: string; // Unique ID from gateway (for idempotency)
}

interface WebhookVerificationResult {
  isValid: boolean;
  gatewayTxId: string;
  status: "SUCCESSFUL" | "FAILED" | "PENDING";
  metadata?: Record<string, any>;
}
```

### Payment Flow

```
                    ┌──────────┐
                    │ Frontend │
                    └────┬─────┘
                         │
          POST /api/v1/credits/checkout
          { planId, gateway: "MERCADO_PAGO" }
                         │
                         ▼
          ┌──────────────────────────────┐
          │     CreditsController        │
          │  1. Lookup SubscriptionPlan  │
          │  2. Resolve gateway strategy │
          │  3. Record pending txn in DB │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │ MercadoPagoStrategy          │
          │ .createCheckoutSession()     │
          │  → SDK: preferences.create() │
          │  → Returns init_point URL    │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  Return { redirectUrl }      │
          │  → Frontend redirects user   │
          └──────────────────────────────┘

                    ┌──────────┐
                    │ MercadoPago │
                    │ (External)  │
                    └────┬────────┘
                         │
              POST /api/v1/webhooks/mercado-pago
                         │
                         ▼
          ┌──────────────────────────────┐
          │    WebhooksController        │
          │  1. Resolve gateway strategy │
          │  2. strategy.verifyWebhook() │
          │     (HMAC signature check)   │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  CreditBillingService        │
          │  .reconcilePayment()         │
          │  1. Idempotency check        │
          │  2. CreditService.addCredits │
          │  3. Create CreditTransaction │
          │  4. Publish payment:success  │
          └──────────────┬───────────────┘
                         │
                    Redis Pub/Sub
                         │
                         ▼
          ┌──────────────────────────────┐
          │  PaymentListenerService      │
          │  (apps/api)                  │
          │  subscribe → emitToUser()    │
          └──────────────┬───────────────┘
                         │
                    WebSocket
                         │
                         ▼
          ┌──────────────────────────────┐
          │  Frontend                    │
          │  socket.on("payment:success")│
          │  → Update credit balance     │
          └──────────────────────────────┘
```

### Webhook Security — HMAC Verification

MercadoPago firma cada webhook con un secret compartido. La verificación usa HMAC-SHA256:

```
1. Extract x-signature header → "ts=1718642940,v1=abcdef..."
2. Build manifest: "id:{gatewayTxId};ts:{timestamp};"
3. Compute HMAC-SHA256(secret, manifest)
4. Compare with timing-safe comparison (crypto.timingSafeEqual)
5. If valid → process payment; if invalid → reject (400)
```

Fallbacks (in order):

1. **HMAC verification** (preferred, production)
2. **API fetch** — query MercadoPago API to verify payment status
3. **Dev mode** — allow processing without verification (NODE_ENV !== 'production')

### Idempotency

`CreditBillingService.reconcilePayment()` checks for existing `CreditTransaction` with the same `referenceId` before processing. Duplicate webhooks are safely ignored.

### Event Integration

After successful reconciliation, the billing service publishes a `payment:success` event via Redis pub/sub (`DomainEventPublisher`). A `PaymentListenerService` in the API subscribes to this event and forwards it to the user via WebSocket (`AppGateway.emitToUser()`).

This avoids circular dependencies between `@creator-hub/billing` (package) and `apps/api` (app).

### Adding a New Gateway

```typescript
// 1. Create strategy implementing IPaymentGateway
@Injectable()
export class StripeStrategy implements IPaymentGateway {
  getGatewayType() { return PaymentGateway.STRIPE; }
  async createCheckoutSession(data) { /* Stripe SDK */ }
  async verifyWebhook(headers, body, rawBody?) { /* Stripe signature */ }
}

// 2. Add to PaymentGateway enum
export enum PaymentGateway {
  MERCADO_PAGO = 'MERCADO_PAGO',
  PAYPAL = 'PAYPAL',
  STRIPE = 'STRIP',    // ← new
}

// 3. Register in billing.module.ts
{
  provide: PAYMENT_GATEWAYS,
  useFactory: (mp, paypal, stripe) => [mp, paypal, stripe],
  inject: [MercadoPagoStrategy, PayPalStrategy, StripeStrategy],
}

// 4. Frontend sends gateway: "STRIPE" in checkout request — done.
```

No controller changes, no database changes, no service changes required.

---

## 10. Storage System

```
┌─────────────────────────────────────────────┐
│              StorageService                  │
│  (Abstraction over S3/MinIO)                │
├─────────────────────────────────────────────┤
│  upload(buffer, name, type) → File record   │
│  getSignedUrl(key) → temporary URL          │
│  delete(key)                                │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    ▼                             ▼
┌──────────────┐          ┌──────────────┐
│  AWS S3      │          │   MinIO      │
│  (Prod)      │          │  (Dev/Local) │
└──────────────┘          └──────────────┘
```

### File Organization in S3

```
bucket/
├── users/
│   └── {userId}/
│       ├── {timestamp}-{file}
│       └── ...
├── tools/
│   └── {toolId}/
│       └── {userId}/
│           └── {timestamp}-{file}
└── public/
    └── {toolId}/
        └── {file}
```

---

## 11. Authentication

```
┌────────┐          ┌─────────┐          ┌──────────┐
│ Client │──POST──►│  Auth   │──JWT──►│ Protected │
│ (Web)  │  /login │Service  │  token │ Endpoints │
└────────┘          └─────────┘          └──────────┘

Auth Flow:
1. User sends email + password → AuthService.login()
2. Service validates credentials via bcrypt
3. Service returns JWT access token + refresh token
4. Client stores token (localStorage via Zustand persist)
5. Subsequent requests include Authorization: Bearer <token>
6. JwtAuthGuard validates token on protected routes
```

### Auth Stack

| Component        | Technology                           |
| ---------------- | ------------------------------------ |
| Password hashing | bcryptjs (12 rounds)                 |
| JWT signing      | @nestjs/jwt                          |
| JWT validation   | passport-jwt                         |
| Guard            | JwtAuthGuard (global)                |
| Role check       | RolesGuard                           |
| Email verified   | EmailVerifiedGuard (admin bypass)    |
| Email delivery   | Resend (provider-agnostic)           |
| OAuth ready      | Account model supports Google/GitHub |

### Email Verification Flow

```
┌────────────┐    POST /auth/register     ┌────────────┐
│   Frontend │ ──────────────────────────► │   Auth     │
│            │    { email, password,       │ Controller │
│            │      firstName, lastName }  └─────┬──────┘
└────────────┘                                  │
                                                ▼
                                     ┌─────────────────────┐
                                     │    AuthService      │
                                     │  1. Hash password   │
                                     │  2. Create User     │
                                     │  3. Generate code   │
                                     │  4. Hash code +     │
                                     │     store in DB     │
                                     │  5. Send email      │
                                     └──────────┬──────────┘
                                                │
              ┌─────────────────────────────────┼──────────────────────┐
              │                                 │                      │
              ▼                                 ▼                      ▼
     ┌─────────────────┐             ┌──────────────────┐   ┌─────────────────┐
     │   Email (Resend)│             │  User            │   │  JWT Token      │
     │   6-digit code  │             │  emailVerified   │   │  emailVerified  │
     │   expires: 10min│             │  = false         │   │  = false        │
     └─────────────────┘             └──────────────────┘   └─────────────────┘

              │
              ▼

     ┌─────────────────┐   POST /auth/verify-email   ┌────────────┐
     │   Frontend      │ ──────────────────────────► │   Auth     │
     │   (OTP page)    │   { email, code }           │ Controller │
     │   6 digit boxes │                             └─────┬──────┘
     └─────────────────┘                                   │
                                                           ▼
                                                ┌─────────────────────┐
                                                │    AuthService      │
                                                │  1. Verify code     │
                                                │  2. Check expiry    │
                                                │  3. Set emailVerif  │
                                                │     = true          │
                                                │  4. Clear code      │
                                                └──────────┬──────────┘
                                                           │
                                                           ▼
                                                ┌─────────────────────┐
                                                │  Updated JWT        │
                                                │  emailVerified=true │
                                                └─────────────────────┘
```

### EmailVerifiedGuard

```typescript
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admins bypass verification
    if (user.role === "ADMIN") return true;

    if (!user.emailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        message: "Email verification required",
        error: "UNVERIFIED_EMAIL",
        requiresVerification: true,
      });
    }
    return true;
  }
}
```

### Verification Code Storage

The verification code is stored directly on the `User` model (not a separate table):

| Field                 | Type      | Description               |
| --------------------- | --------- | ------------------------- |
| `verificationCode`    | String?   | Hashed 6-digit code       |
| `verificationExpires` | DateTime? | Expiration time (10 min)  |
| `emailVerified`       | Boolean   | Whether email is verified |

JWT payload includes `emailVerified` to avoid DB calls in guards.

### Email Package Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EmailService                              │
│  (Orchestrator — resolves provider via DI)                   │
├─────────────────────────────────────────────────────────────┤
│  sendVerificationEmail(to, firstName, code)                  │
│  renderTemplate(templateName, data) → Handlebars output     │
└──────────────────────────────┬──────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
   ┌───────▼──────┐   ┌───────▼──────┐   ┌───────▼──────┐
   │   Resend     │   │   AWS SES    │   │   SendGrid   │
   │  (Provider)  │   │  (Planned)   │   │  (Planned)   │
   ├──────────────┤   ├──────────────┤   ├──────────────┤
   │ SDK: resend  │   │ SDK: @aws/   │   │ SDK: sendgrid│
   │ emails.send()│   │ ses-v2       │   │              │
   └──────────────┘   └──────────────┘   └──────────────┘
           │                   │                   │
           └───────────────────┴───────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │     EmailProvider             │
               │     (Abstract Class)          │
               ├───────────────────────────────┤
               │ sendEmail(options)            │
               │ sendBulkEmail(options)        │
               └───────────────────────────────┘
```

### Package Structure

```
packages/email/src/
├── email-provider.interface.ts    # Abstract EmailProvider class
├── email.service.ts               # Orchestrator
├── email.module.ts                # NestJS module with factory provider
├── providers/
│   └── resend/
│       └── resend.provider.ts     # Resend SDK adapter
└── templates/
    ├── template.helper.ts         # Handlebars renderer (with cache)
    └── verification.hbs           # Verification email template
```

### Adding a New Email Provider

```typescript
// 1. Create provider implementing EmailProvider
@Injectable()
export class AwsSesProvider extends EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    // AWS SES SDK implementation
  }
}

// 2. Register in email.module.ts
{
  provide: EMAIL_PROVIDER,
  useFactory: (configService) => {
    const provider = configService.get("EMAIL_PROVIDER");
    if (provider === "ses") return new AwsSesProvider();
    return new ResendProvider(configService);
  },
  inject: [ConfigService],
}
```

No service changes required — swap provider via environment variable.

---

## 12. AI Chat System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatWidget (Frontend)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  FAB (bottom-right) → Slides panel from right       │    │
│  │  Session tabs + Message list + Input                 │    │
│  │  Tool action cards (clickable → navigate to tool)    │    │
│  │  Settings panel (model, temperature, max tokens)     │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/v1/chat (SSE stream)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ChatController                            │
│  @Post() + @Res() → Readable stream (SSE)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ChatService                              │
│  1. Resolve tool routing (ChatRoutingService)               │
│  2. Build system prompt with available tools                │
│  3. Stream via AI provider.generateStream()                 │
│  4. Persist messages in ChatSession/ChatMessage             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
┌───────────────────────────┐  ┌──────────────────────────────┐
│   ChatRoutingService      │  │   AI Provider (GLM-5.2)      │
│                           │  │                              │
│  - ToolRegistry.getActive │  │  generateStream(prompt, opts)│
│  - Confidence scoring     │  │  → Readable stream of chunks │
│  - Trigger words          │  │                              │
│  - System prompt builder  │  │  SiliconFlow SSE API         │
└───────────────────────────┘  └──────────────────────────────┘
```

### Dynamic Tool Routing

The chat system discovers tools at runtime from the `ToolRegistry`:

```typescript
// ChatRoutingService.buildSystemPrompt()
const tools = await this.toolRegistry.getActive();
const toolDescriptions = tools
  .map((t) => `- ${t.name}: ${t.description} [category: ${t.category}]`)
  .join("\n");

const systemPrompt = `
You are an AI assistant for Creator Hub.
You have access to these tools:
${toolDescriptions}

When a user request matches a tool, wrap the action in a JSON code block:
\`\`\`json
{"action":"<tool-id>","params":{...}}
\`\`\`
`;
```

### Tool Action Cards

When the LLM response contains a JSON action block, the frontend parses it and renders a clickable card:

````
User: "Generate a thumbnail of a sunset"
  ↓
LLM: "I'll create that for you!"
     ```json
     {"action":"thumbnail-generator","params":{"prompt":"sunset"}}
     ```
  ↓
Frontend parses → renders ToolActionCard
  ↓
User clicks card → navigates to /tools/thumbnail-generator?prompt=sunset
````

### Chat Models (Prisma)

```prisma
model ChatSession {
  id        String   @id @default(uuid())
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  ChatMessage[]
}

model ChatMessage {
  id        String   @id @default(uuid())
  sessionId String
  role      String   // "user" | "assistant" | "system"
  content   String
  toolCalls Json?    // Tool call metadata
  createdAt DateTime @default(now())
}

model ChatSettings {
  id            String @id @default(uuid())
  userId        String @unique
  model         String @default("zai-org/GLM-5.2")
  temperature   Float  @default(0.7)
  maxTokens     Int    @default(8000)
  reasoning     Float  @default(0.7)
}
```

### Streaming Implementation

The chat uses `@Post` + `Readable` stream (not `@Sse` GET):

```typescript
@Post()
@UseGuards(JwtAuthGuard)
async chat(@Body() dto: ChatDto, @Res() res: Response) {
  const stream = await this.chatService.streamMessage(dto);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
      });
      stream.on("end", () => controller.close());
    },
  });

  // Pipe to NestJS Response
  const nodeStream = Readable.fromWeb(readable);
  nodeStream.pipe(res);
}
```

---

## 13. User Style RAG System

### Concept

The User Style RAG (Retrieval-Augmented Generation) system learns a user's communication style from their content samples and injects this style profile into the AI Chat system prompt. This allows the assistant to generate content that matches the user's tone, vocabulary, sentence structure, and formality level.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UserStyleController                           │
│  GET/PUT/DELETE /user-style/profile                             │
│  POST /user-style/analyze (ThrottlerGuard: 5/hour)             │
│  POST/GET/DELETE /user-style/samples                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
┌──────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ StyleProfileService│ │ContentSampleService│ │StyleAnalyzerService│
│ - CRUD profile   │ │ - CRUD samples  │ │ - LLM analysis      │
│ - upsert on      │ │ - bulk create   │ │ - parse response    │
│   analysis       │ │ - paginated list│ │ - deduct credits    │
└────────┬─────────┘ └────────┬────────┘ └──────────┬──────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prisma (PostgreSQL)                           │
│  UserStyleProfile (1:1 with User)                               │
│  UserContentSample (1:N with User, indexed by userId+createdAt) │
└─────────────────────────────────────────────────────────────────┘

StyleInjectionService (consumed by ChatRoutingService):
  getStylePrompt(userId) → string (injected into system prompt)
```

### Data Model (Prisma)

```prisma
enum ContentSampleSource {
  MANUAL
  CHAT
  TWEET
  POST
  IMPORT
}

model UserStyleProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  tone           String              // "directo, provocativo, profesional"
  vocabKeywords  String[]            // ["blockchain", "escala", "fricción"]
  sentenceLength String   @default("medium")  // short|medium|long
  emojiUsage     String   @default("moderate") // none|low|moderate|high
  formalityLevel String   @default("casual")   // casual|semi-formal|formal
  summary        String?             // 1-2 sentence style description
  sampleCount    Int      @default(0)
  isActive       Boolean  @default(true)
  lastAnalyzedAt DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserContentSample {
  id        String              @id @default(cuid())
  userId    String
  content   String              @db.Text
  source    ContentSampleSource @default(MANUAL)
  metadata  Json?
  isActive  Boolean             @default(true)
  createdAt DateTime            @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isActive])
  @@index([userId, createdAt])
}
```

### Three-Level Architecture

| Level                  | Component               | Purpose                                            | Size        |
| ---------------------- | ----------------------- | -------------------------------------------------- | ----------- |
| **1. Style Profile**   | `UserStyleProfile`      | Lightweight JSON injected into every system prompt | ~200 bytes  |
| **2. Content Samples** | `UserContentSample`     | Raw text for RAG analysis                          | Variable    |
| **3. Style Injection** | `StyleInjectionService` | Builds the style prompt section                    | ~150 tokens |

### Integration with Chat

The `ChatRoutingService.buildSystemPrompt()` is now `async` and accepts `userId`:

```typescript
// chat-routing.service.ts
async buildSystemPrompt(userId: string, userMessage?: string): Promise<string> {
  const basePrompt = /* tool descriptions, rules, language */;
  const stylePrompt = await this.styleInjection.getStylePrompt(userId);

  return stylePrompt ? `${basePrompt}\n\n${stylePrompt}` : basePrompt;
}
```

When a user has an active style profile, the system prompt includes:

```
USER STYLE PROFILE (apply to ALL generated content):
- Tone: directo, provocativo, profesional
- Keywords: blockchain, escala, fricción
- Sentence length: short
- Emoji usage: moderate
- Formality: casual
IMPORTANT: Match this style strictly in your response.
```

### Style Analysis Flow

```
User clicks "Analyze my style"
  │
  ├──► ContentSampleService.getRecentSamples(userId, 10)
  │    └── Returns last 10 active samples
  │
  ├──► Validate: minimum 3 samples required
  │
  ├──► CreditService.hasEnoughCredits(userId, 1)
  │
  ├──► AIEngineService.execute({ taskType: "text-analysis", prompt })
  │    └── LLM analyzes tone, vocabulary, sentence structure
  │
  ├──► Parse JSON response → StyleAnalysisResult
  │
  ├──► StyleProfileService.upsert(userId, result)
  │
  └──► CreditService.deduct(userId, 1, "user-style")
```

### Module Structure

```
apps/api/src/modules/user-style/
├── user-style.module.ts
├── user-style.controller.ts
├── interfaces/
│   └── style-analysis-result.interface.ts
├── dto/
│   ├── create-sample.dto.ts
│   ├── bulk-create-samples.dto.ts
│   └── update-style-profile.dto.ts
└── services/
    ├── style-profile.service.ts
    ├── content-sample.service.ts
    ├── style-analyzer.service.ts
    └── style-injection.service.ts
```

### API Endpoints

```
GET    /api/v1/user-style/profile              # Get style profile
PUT    /api/v1/user-style/profile              # Update profile manually
DELETE /api/v1/user-style/profile              # Delete profile (reset)

POST   /api/v1/user-style/analyze              # Trigger analysis (costs 1 credit)
POST   /api/v1/user-style/samples              # Add single sample (min 10 chars)
POST   /api/v1/user-style/samples/bulk         # Add multiple samples (max 50)
GET    /api/v1/user-style/samples              # List samples (paginated)
DELETE /api/v1/user-style/samples/:id          # Delete a sample
```

### Content Sample Collection

| Source     | Mechanism                       | Description                    |
| ---------- | ------------------------------- | ------------------------------ |
| **MANUAL** | `POST /user-style/samples`      | User pastes text directly      |
| **BULK**   | `POST /user-style/samples/bulk` | Array of texts (tweets, posts) |
| **CHAT**   | Future: auto-collect            | Chat messages saved as samples |

### Security

- All endpoints protected by `JwtAuthGuard`
- All queries filter by `userId` from JWT token (no cross-user access)
- `POST /analyze` rate-limited via `ThrottlerGuard` (5 requests/hour)
- Content samples validated: min 10 chars, max 5000 chars, max 50 per bulk
- Analysis costs 1 credit (verified before execution)

### Error Handling

| Scenario             | Behavior                                   |
| -------------------- | ------------------------------------------ |
| < 3 samples          | `BadRequestException` with sample count    |
| Insufficient credits | `BadRequestException` with cost            |
| LLM parse failure    | `BadRequestException`, retry suggested     |
| No profile exists    | Style prompt omitted (chat works normally) |
| Profile stale        | Warning in response, suggest re-analysis   |

---

## 14b. X (Twitter) Integration

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        X Integration Module                          │
│  apps/api/src/modules/social/                                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   SocialModule    │  │ XSearchTrends    │  │ XPostTweet       │  │
│  │                  │  │ Module           │  │ Module           │  │
│  │ • OAuth 2.0 PKCE │  │                  │  │                  │  │
│  │ • Account CRUD   │  │ • Apify scraper  │  │ • AI drafting    │  │
│  │ • Token encrypt  │  │ • Trend analysis │  │ • RAG style      │  │
│  │ • Audit logging  │  │ • Save results   │  │ • Publish to X   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### OAuth 2.0 PKCE Flow

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│ Frontend │───▶│ SocialModule │───▶│ X OAuth      │───▶│ Callback │
│          │    │ /auth-url    │    │ Authorization│    │ /callback│
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
                     │                                       │
                     │ 1. Generate code_verifier + challenge │
                     │ 2. Store in DB (temporary)            │
                     │ 3. Return authorize URL               │
                     │                                       │ 4. Exchange code + code_verifier
                     │                                       │ 5. Get access_token + refresh_token
                     │                                       │ 6. Encrypt tokens (AES-256-GCM)
                     │                                       │ 7. Store in SocialAccount
                     │                                       │ 8. Redirect to frontend
```

### Token Encryption

X API tokens are encrypted at rest using AES-256-GCM:

```
OAuthEncryptionService:
  encrypt(data: string): string
    → IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
    → Base64 encoded

  decrypt(encrypted: string): string
    → Decode Base64 → Extract IV + Auth Tag + Data
    → Decrypt with AES-256-GCM

  Key: X_SOCIAL_ENCRYPTION_KEY (64-char hex string)
```

### Tweet Draft with RAG Style

```
User sends tweet request
    │
    ├──► TweetDraftService.generateTweet(userId, prompt, model)
    │       │
    │       ├──► StyleInjectionService.getStylePrompt(userId)
    │       │    └── Returns: "USER STYLE PROFILE: Tone, Keywords, ..."
    │       │
    │       ├──► Build tweet prompt:
    │       │    "Write a tweet about {prompt}
    │       │     User style: {stylePrompt}
    │       │     Rules: max 280 chars, concise, engaging"
    │       │
    │       ├──► AIEngineService.execute({ taskType, model, prompt })
    │       │    └── Returns AI-generated tweet
    │       │
    │       ├──► CreditService.deduct(userId, 5, "tweet-draft")
    │       │
    │       └──► TweetDraft.create(content, userId)
    │
    └──► Return { id, content, status: "DRAFT" }
```

### Trend Research Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    X Search Trends Module                             │
│  tools/x-search-trends/backend/src/                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  XApiService     │  │ TweetAnalysis    │  │ TwitterCrawler   │  │
│  │  (Primary)       │  │ Service          │  │ Service (Fallback)│  │
│  │                  │  │                  │  │                  │  │
│  │ • searchTweets() │  │ • Spam filter    │  │ • Crawlee/       │  │
│  │ • X API v2       │  │ • Authority score│  │   Playwright     │  │
│  │ • Pay-as-you-go  │  │ • Sentiment      │  │ • Session cookies│  │
│  └──────────────────┘  │ • Theme extract  │  └──────────────────┘  │
│                        └──────────────────┘                         │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │  AIEngineService │  │ SocialService    │                         │
│  │  (Analysis)      │  │ (Token Refresh)  │                         │
│  │                  │  │                  │                         │
│  │ • Query generation│  │ • Auto-refresh   │                         │
│  │ • Executive sum. │  │   expired tokens │                         │
│  │ • Theme analysis │  │ • /refresh API   │                         │
│  └──────────────────┘  └──────────────────┘                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Search Flow

```
User enters natural language (any language)
    │
    ├──► XSearchTrendsService.research(userId, { prompt, model, providerId })
    │       │
    │       ├──► buildSearchQueries(prompt)  [AI-powered]
    │       │    │
    │       │    ├──► AIEngineService.execute(taskType: "chat", prompt: "Extract search keywords...")
    │       │    │    Input: "tendencias de criptomonedas en español"
    │       │    │    Output: ["criptomonedas tendencias", "crypto trends"]
    │       │    │
    │       │    └──► Returns: string[] (up to 3 queries)
    │       │
    │       ├──► [Query 1] XApiService.searchTweets(query, { maxResults: 50 })
    │       │    │
    │       │    ├──► Check token expiration
    │       │    │    └── If expired → SocialService.refreshToken(accountId)
    │       │    │
    │       │    ├──► GET /2/tweets/search/recent
    │       │    │    Headers: Authorization: Bearer {accessToken}
    │       │    │
    │       │    └──► Return TweetData[]
    │       │
    │       ├──► [Fallback] If X API fails or 0 results
    │       │    │
    │       │    └──► TwitterCrawlerService.searchTweets(query)
    │       │         │
    │       │         ├──► Crawlee with Playwright browser
    │       │         │    Cookies: X_AUTH_TOKEN, X_CT0
    │       │         │
    │       │         └──► Return TweetData[]
    │       │
    │       ├──► TweetAnalysisService.analyze(tweets)
    │       │    │
    │       │    ├──► Quality filters:
    │       │    │    • Spam detection (NSFW, betting, crypto spam keywords)
    │       │    │    • Low-authority filter (<500 followers unless high engagement)
    │       │    │    • Sentiment analysis (positive/negative/neutral)
    │       │    │    • Theme extraction (DeFi, NFT, Bitcoin, AI, etc.)
    │       │    │
    │       │    └──► Return AnalyzedTweet[]
    │       │
    │       ├──► [If >= 5 tweets] AI Analysis
    │       │    │
    │       │    ├──► AIEngineService.execute(taskType: "chat", prompt: analysisPrompt)
    │       │    │    • Executive summary
    │       │    │    • Key themes (only if actually mentioned)
    │       │    │    • Sentiment analysis
    │       │    │    • Key influencers
    │       │    │
    │       │    └──► Return { executiveSummary, themes, sentiment, keyInfluencers }
    │       │
    │       ├──► [If < 5 tweets] Return { insufficientData: true, message: "..." }
    │       │
    │       ├──► CreditService.deduct(userId, 15, "search-trends")
    │       │    + CreditService.deduct(userId, 10, "ai-analysis") [if analysis generated]
    │       │
    │       └──► Return { tweets, analysis, metadata }
    │
    └──► Return { tweets: [...], analysis, metadata }
```

### Token Auto-Refresh

```
X API tokens expire after ~2 hours
    │
    ├──► XApiService.searchTweets() detects 401/expired token
    │       │
    │       ├──► SocialService.getAccountWithFreshToken(userId, platform)
    │       │    │
    │       │    ├──► Check SocialAccount.expiresAt
    │       │    │    └── If expired → call refresh endpoint
    │       │    │
    │       │    ├──► POST /api/v1/social/accounts/:id/refresh
    │       │    │    │
    │       │    │    ├──► XOAuthService.refreshTokens(account)
    │       │    │    │    └── X API: POST /oauth2/token
    │       │    │    │
    │       │    │    ├──► Encrypt new tokens (AES-256-GCM)
    │       │    │    │
    │       │    │    └──► Update SocialAccount in DB
    │       │    │
    │       │    └──► Return fresh access_token
    │       │
    │       └──► Retry original request with new token
    │
    └──► Return tweets[]
```

### Data Model (Prisma)

```prisma
enum SocialPlatform {
  X
  TWITTER  // Alias for X
}

enum TweetDraftStatus {
  DRAFT
  PREVIEW
  PUBLISHED
  FAILED
}

model SocialAccount {
  id              String   @id @default(cuid())
  userId          String
  platform        SocialPlatform
  providerAccountId String
  username        String?
  displayName     String?
  accessToken     String   @db.Text  // Encrypted
  refreshToken    String?  @db.Text  // Encrypted
  expiresAt       DateTime?
  scope           String?
  isActive        Boolean  @default(true)
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, platform, providerAccountId])
  @@index([userId, platform])
}

model TweetDraft {
  id              String           @id @default(cuid())
  userId          String
  content         String           @db.Text
  model           String?
  temperature     Float?
  maxTokens       Int?
  status          TweetDraftStatus @default(DRAFT)
  platformPostId  String?
  publishedAt     DateTime?
  errorMessage    String?
  metadata        Json?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userId, createdAt])
}
```

### Plan Guard Integration

X integration tools require `STARTER` plan minimum:

```typescript
// Tools require STARTER plan minimum
@UseGuards(AuthenticatedPlanGuard)
@MinPlan("STARTER")
@Controller("social")
export class SocialController { ... }

@UseGuards(AuthenticatedPlanGuard)
@MinPlan("STARTER")
@Controller("tweets")
export class TweetDraftController { ... }
```

### API Endpoints

```
# Social Account
GET    /api/v1/social/x/auth-url        # Get OAuth URL (requires STARTER plan)
POST   /api/v1/social/x/callback        # OAuth callback (public endpoint)
GET    /api/v1/social/accounts          # List connected accounts
DELETE /api/v1/social/accounts/:id      # Disconnect account

# Tweet Drafts
POST   /api/v1/social/tweets/draft      # Generate tweet (5 cr)
GET    /api/v1/social/tweets/drafts     # List drafts
GET    /api/v1/social/tweets/drafts/:id # Get draft
PATCH  /api/v1/social/tweets/drafts/:id # Edit draft
DELETE /api/v1/social/tweets/drafts/:id # Delete draft
POST   /api/v1/social/tweets/drafts/:id/publish  # Publish to X (5 cr)

# Trend Research (via tool controller)
POST   /api/v1/tools/x-search-trends/research    # Research trends (15 cr + 10 cr AI analysis)
```

### Security

- OAuth tokens encrypted with AES-256-GCM at rest
- `@Public()` on callback endpoint (no JWT required)
- `JwtAuthGuard` on all other endpoints
- `AuthenticatedPlanGuard` + `@MinPlan("STARTER")` on X endpoints
- Audit logging for all account operations
- Token refresh validation on each use

---

## 14. Testing Strategy

### Test Pyramid

```
        ╱╲
       ╱  ╲          E2E Tests (5%)
      ╱    ╲       SuperTest + full module
     ╱──────╲
    ╱        ╲    Integration Tests (25%)
   ╱          ╲  Service tests with DB
  ╱────────────╲
 ╱              ╲  Unit Tests (70%)
╱────────────────╲ Pure function + component tests
```

### Test Structure

```
apps/api/
├── src/
│   ├── modules/
│   │   └── auth/
│   │       ├── auth.controller.ts
│   │       ├── auth.controller.spec.ts     # Unit tests
│   │       └── ...
│   └── ...
└── test/
    ├── app.e2e-spec.ts                    # E2E tests
    └── jest-e2e.json

tools/thumbnail-generator/
├── backend/
│   └── src/
│       ├── thumbnail.service.ts
│       ├── thumbnail.service.spec.ts       # Integration tests
│       └── thumbnail.controller.spec.ts    # Controller tests
```

### Key Testing Approaches

| Layer        | Tool            | Focus              |
| ------------ | --------------- | ------------------ |
| Shared utils | Vitest          | Pure functions     |
| Services     | Jest            | Business logic     |
| Controllers  | Supertest       | HTTP contracts     |
| E2E          | @nestjs/testing | Full app flows     |
| Frontend     | Testing Library | Component behavior |

---

## 14. CI/CD Strategy

### GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_DB: test, POSTGRES_USER: test, POSTGRES_PASSWORD: test }
        options: --health-cmd pg_isready

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install
      - run: pnpm db:generate
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

### Pipeline Stages

```
Commit → Lint → TypeCheck → Unit Tests → Build → Integration Tests → E2E → Deploy
   │         │        │           │         │           │             │       │
   │         │        │           │         │           │             │       └──► Vercel (web)
   │         │        │           │         │           │             │           Railway (api)
   │         │        │           │         │           │             │
   └─────────┴────────┴───────────┴─────────┴───────────┴─────────────┘
   All checks must pass before merge
```

---

## 15. Scalability Roadmap

### Phase 1: MVP (0 → 100 users)

```
Architecture: Modular Monolith
Deployment: Single server (Railway / Fly.io)
Database: Single PostgreSQL instance
Queue: Single Redis instance
Storage: MinIO (local) / S3
Cache: In-memory + basic Redis
```

### Phase 2: Growth (100 → 10,000 users)

```
Architecture: Modular Monolith (scaled vertically + horizontally)
Deployment: 2-4 API replicas behind load balancer
Database: PostgreSQL with connection pooling (PgBouncer)
Queue: Redis Cluster
Storage: AWS S3
Cache: Redis for session + query cache
CDN: CloudFront for generated images
```

### Phase 3: Scale (10,000 → 100,000 users)

```
Architecture: Modular Monolith → Domain Decomposition
Deployment: Kubernetes (EKS / GKE)
Database: PostgreSQL read replicas + partitioning
Queue: BullMQ with Redis Cluster
Search: Elasticsearch for image search
CDN: Multi-region CloudFront
Monitoring: Datadog / Grafana + Prometheus
```

### Phase 4: Enterprise (100,000 → 1,000,000+ users)

```
Architecture: Microservices (split by domain)
  └── Auth Service
  └── Billing Service
  └── AI Engine Service
  └── Storage Service
  └── Analytics Service
  └── Per-tool services (if high traffic)

Database: Sharded PostgreSQL per service
Cache: Redis Cluster (multi-region)
Queue: Kafka for event streaming
Storage: S3 + CDN multi-region
Observability: OpenTelemetry + distributed tracing
```

### Scaling Decision Tree

```
Scale decision per bottleneck:

CPU-bound?
├── AI providers (external) → Already async
└── Image processing → Dedicated worker queues

Memory-bound?
├── Session store → Redis
├── Cache → Redis + CDN
└── Large payloads → Stream / S3 presigned URLs

Database-bound?
├── Read heavy → Read replicas
├── Write heavy → Queue writes, batch inserts
└── Complex queries → Materialized views + Elasticsearch

Queue-bound?
├── Slow consumers → More workers
├── Queue backpressure → Priority queues
└── Failed jobs → Dead letter queues + alerts
```

---

## 16. Creating a New Tool

### Tool Checklist (< 1 hour)

```
Step 1: Create directory structure
└── tools/
    └── your-tool-name/
        ├── index.ts              # Entry: registerTool()
        ├── package.json
        ├── frontend/
        │   ├── src/
        │   │   ├── index.ts
        │   │   └── components/
        │   │       └── YourToolPage.tsx
        │   └── package.json
        └── backend/
            ├── src/
            │   ├── index.ts
            │   ├── your-tool.module.ts
            │   ├── your-tool.service.ts
            │   ├── your-tool.controller.ts
            │   └── your-tool.processor.ts
            └── package.json

Step 2: Define manifest (index.ts)
└── registerTool({
      id: "your-tool-id",
      name: "Your Tool",
      description: "...",
      category: "...",
      creditsPerUse: 10,
      frontend: { routes: [...] },
      backend: { module: YourToolModule },
    })

Step 3: Create backend module
└── @Module({ imports: [AIEngineModule, BillingModule], ... })

Step 4: Implement service
└── Use AIEngineService, CreditService, StorageService

Step 5: Create frontend component
└── Use @creator-hub/ui components, @tanstack/react-query

Step 6: Register in app.module.ts
└── imports: [YourToolModule]
```

### Tool Template

```typescript
// tools/your-tool/index.ts
import { registerTool } from "@creator-hub/tool-sdk";
export { YourToolModule } from "./backend/src/your-tool.module";

registerTool({
  id: "your-tool",
  name: "Your Tool",
  description: "What this tool does",
  icon: "🔧",
  category: "other",
  creditsPerUse: 5,
  permissions: [{ action: "use", resource: "your-tool" }],
  frontend: {
    routes: [
      {
        path: "/tools/your-tool",
        component: "YourToolPage",
        title: "Your Tool",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "@your-tool/backend",
    events: ["your-tool.used"],
  },
});
```

```

// tools/your-tool/backend/src/your-tool.module.ts
import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { YourToolService } from "./your-tool.service";
import { YourToolController } from "./your-tool.controller";

@Module({
  imports: [AIEngineModule, BillingModule],
  controllers: [YourToolController],
  providers: [YourToolService],
  exports: [YourToolService],
})
export class YourToolModule {}
```

```
// tools/your-tool/backend/src/your-tool.service.ts
import { Injectable } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";

@Injectable()
export class YourToolService {
  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
  ) {}

  async execute(userId: string, params: any) {
    const CREDIT_COST = 5;
    const hasCredits = await this.creditService.hasEnoughCredits(userId, CREDIT_COST);
    if (!hasCredits) throw new Error("Insufficient credits");

    const result = await this.aiEngine.execute({
      taskType: "text-generation",
      prompt: params.prompt,
      userId,
      toolId: "your-tool",
    });

    await this.creditService.deduct(userId, CREDIT_COST, "your-tool");
    return result;
  }
}
```

### Architecture Decision Records

| Decision                         | Rationale                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modular Monolith first**       | Faster iteration, no distributed complexity. Microservices boundaries are well-defined for future split                                           |
| **Tool SDK for registration**    | Loose coupling: tools don't import the registry directly                                                                                          |
| **AI Provider pattern**          | Tools switch providers via config, not code changes. Runtime classes + DB metadata (`Provider`) decouple implementation from pricing/availability |
| **BullMQ for events**            | Redis-backed, supports delays, retries, scheduling. Familiar for NestJS devs                                                                      |
| **Prisma as ORM**                | Type-safe, auto-generated client, strong migration system                                                                                         |
| **Zustand over Redux**           | Minimal boilerplate, TypeScript-native, persist middleware built in                                                                               |
| **React Query**                  | Server state management, caching, deduplication built in                                                                                          |
| **Credits as abstraction**       | Rate limits, monetization, and abuse prevention unified in one system                                                                             |
| **pnpm workspaces**              | Faster than npm/yarn, strict dependency isolation                                                                                                 |
| **S3-compatible storage**        | MinIO for dev, AWS S3 for prod — same interface                                                                                                   |
| **Admin Panel as separate app**  | `apps/admin` isolates admin UI, allows independent deploy and stricter access controls                                                            |
| **Soft delete for users**        | Prevents data loss, preserves analytics and audit trails                                                                                          |
| **Provider-agnostic email**      | `EmailProvider` abstract class — swap Resend for AWS SES by implementing one interface                                                            |
| **Verification code on User**    | Short-lived (10min), single user, no extra joins needed vs separate VerificationToken model                                                       |
| **JWT includes emailVerified**   | Avoids DB call in `EmailVerifiedGuard`                                                                                                            |
| **Admin bypasses verification**  | `EmailVerifiedGuard` checks `user.role === "ADMIN"` — admins always have full access                                                              |
| **Dynamic tool routing**         | `ChatRoutingService` queries `ToolRegistry.getActive()` at runtime — zero code changes for new tools                                              |
| **Chat SSE via POST + Readable** | NestJS `@Sse` creates GET endpoints; frontend sends POST with body. Readable stream for SSE.                                                      |
| **Store-driven widget open**     | `isWidgetOpen` in Zustand store allows any component to open chat via `openWidget()`                                                              |

---

> **Creator Hub** — Built for 1 tool today, 50 tools tomorrow.
