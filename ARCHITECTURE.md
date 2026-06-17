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
9. [Storage System](#9-storage-system)
10. [Authentication](#10-authentication)
11. [Testing Strategy](#11-testing-strategy)
12. [CI/CD Strategy](#12-cicd-strategy)
13. [Scalability Roadmap](#13-scalability-roadmap)
14. [Creating a New Tool](#14-creating-a-new-tool)

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
│       │       └── webhooks/
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
│   │       ├── event.types.ts
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
│   ├── billing/               # Credits & subscriptions
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

| Tier   | Providers                               | Used By                |
| ------ | --------------------------------------- | ---------------------- |
| `free` | Z-Image-Turbo, SiliconFlow (FLUX.2-pro) | FREE plan users        |
| `pro`  | OpenAI, Gemini, Stability AI, Flux      | PAY_AS_YOU_GO, PREMIUM |

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
│       PREMIUM)           │     │ configSchema (JSON)    │
│ freeCredits (default 100)│     └────────┬───────────────┘
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

- **No `CreditBalance` model** — Credits live directly on `User` as `freeCredits` + `purchasedCredits`
- **`UserPlan` enum** — `FREE`, `PAY_AS_YOU_GO`, `PREMIUM`
- **`UserRole` enum** — `USER`, `ADMIN`
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

GET    /api/v1/credits/balance       # Get balance (freeCredits, purchasedCredits, plan)
GET    /api/v1/credits/marketing-events  # Marketing events for user
GET    /api/v1/credits/plans         # List subscription plans
POST   /api/v1/credits/subscribe     # Subscribe to plan

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

| Event                       | Producer              | Consumer              | Purpose            |
| --------------------------- | --------------------- | --------------------- | ------------------ |
| `tool.used`                 | All tools             | Analytics, Credits    | Track usage        |
| `credits.deducted`          | CreditService         | Notifications         | Alert user         |
| `credits.depleted`          | CreditService         | Notifications         | Prompt purchase    |
| `marketing.credit_depleted` | CreditService         | MarketingEventHandler | Marketing events   |
| `marketing.threshold`       | MarketingEventHandler | MarketingEvent DB     | Threshold tracking |
| `ai.request.completed`      | AIEngine              | Analytics, Billing    | Track costs        |
| `image.generated`           | Thumbnail             | Storage, Notify       | Save & notify      |
| `translation.completed`     | ContentTranslator     | Notify                | Deliver result     |
| `translation.failed`        | ContentTranslator     | Notify                | Error handling     |
| `stt:transcript`            | AppGateway            | Frontend              | Live transcript    |
| `stt:done`                  | AppGateway            | Frontend              | Session complete   |
| `stt:error`                 | AppGateway            | Frontend              | Session error      |

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

| Field              | Description                           | Deduction Priority |
| ------------------ | ------------------------------------- | ------------------ |
| `freeCredits`      | 100 free credits on registration      | First              |
| `purchasedCredits` | Credits from purchase or subscription | Second             |

### Flow

```
                    ┌──────────────┐
                    │ Registration │
                    │ (FREE plan)  │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │  User        │
                    │  freeCredits │
                    │  = 100       │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌────────────┐   ┌──────────────┐   ┌────────────┐
  │ Tool Use   │   │ Purchase     │   │ Upgrade    │
  │ -1 credit  │   │ +N credits   │   │ Plan       │
  │ (flat)     │   │ (purchased)  │   │            │
  └────────────┘   └──────────────┘   └────────────┘
```

### Credit Decision Flow

```
User requests tool usage
    │
    ├──► Check totalCredits (freeCredits + purchasedCredits)
    │      ├──► Sufficient? → Deduct (freeCredits first, then purchasedCredits)
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
  → FREE + provider.tier=FREE + totalCredits >= costPerCredit → OK
  → PAY_AS_YOU_GO / PREMIUM + totalCredits >= costPerCredit → OK
```

### Admin Management

Admins can manage providers and users via `AdminModule`:

```
AdminController
  ├── AdminGuard (role === ADMIN)
  ├── Providers CRUD
  └── Users CRUD (soft delete via isActive)
```

User credits are **read-only** in admin. Soft delete prevents accidental data loss and preserves historical records.

---

## 9. Storage System

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

## 10. Authentication

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
| OAuth ready      | Account model supports Google/GitHub |

---

## 11. Testing Strategy

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

## 12. CI/CD Strategy

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

## 13. Scalability Roadmap

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

## 14. Creating a New Tool

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

| Decision                        | Rationale                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modular Monolith first**      | Faster iteration, no distributed complexity. Microservices boundaries are well-defined for future split                                           |
| **Tool SDK for registration**   | Loose coupling: tools don't import the registry directly                                                                                          |
| **AI Provider pattern**         | Tools switch providers via config, not code changes. Runtime classes + DB metadata (`Provider`) decouple implementation from pricing/availability |
| **BullMQ for events**           | Redis-backed, supports delays, retries, scheduling. Familiar for NestJS devs                                                                      |
| **Prisma as ORM**               | Type-safe, auto-generated client, strong migration system                                                                                         |
| **Zustand over Redux**          | Minimal boilerplate, TypeScript-native, persist middleware built in                                                                               |
| **React Query**                 | Server state management, caching, deduplication built in                                                                                          |
| **Credits as abstraction**      | Rate limits, monetization, and abuse prevention unified in one system                                                                             |
| **pnpm workspaces**             | Faster than npm/yarn, strict dependency isolation                                                                                                 |
| **S3-compatible storage**       | MinIO for dev, AWS S3 for prod — same interface                                                                                                   |
| **Admin Panel as separate app** | `apps/admin` isolates admin UI, allows independent deploy and stricter access controls                                                            |
| **Soft delete for users**       | Prevents data loss, preserves analytics and audit trails                                                                                          |

---

> **Creator Hub** — Built for 1 tool today, 50 tools tomorrow.
