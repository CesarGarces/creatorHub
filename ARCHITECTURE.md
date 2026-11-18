# Creator Hub — Architecture Document

> **Software Architecture Document**
> Modular SaaS platform for content creators. Designed for 1 → 50+ tools.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
   2f. [Dashboard widgets](#2f-dashboard-widgets)
3. [Tool Registry System](#3-tool-registry-system)
4. [AI Engine Design](#4-ai-engine-design)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [Event Architecture](#7-event-architecture)
8. [Credit System](#8-credit-system)
9. [Payment Gateway](#9-payment-gateway)
10. [Storage System](#10-storage-system)
11. [Authentication](#11-authentication)
12. [AI Chat System](#12-ai-chat-system)
13. [User Style RAG System](#13-user-style-rag-system)
14. [X (Twitter) Integration](#14b-x-twitter-integration)
    14c. [Script Writer](#14c-script-writer)
    14d. [Community Bot](#14d-community-bot)
    14e. [Content Planner — AI Planning Assistant](#14e-content-planner--ai-planning-assistant)
    14f. [AI Video Analyzer & Smart Clipper](#14f-ai-video-analyzer--smart-clipper)
    14g. [Robotina — AI Voice Assistant](#14g-robotina--ai-voice-assistant)
15. [Testing Strategy](#14-testing-strategy)
16. [CI/CD Strategy](#14-cicd-strategy)
17. [Scalability Roadmap](#15-scalability-roadmap)
18. [Creating a New Tool](#16-creating-a-new-tool)
19. [Observability — Sentry](#17-observability--sentry)
20. [Security Hardening](#18-security-hardening)

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
│   │   │   │   ├── credit-emails/     # Emails per credit state (50, 0, ...)
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
│       │       ├── credit-emails/  # Credit state email listener (credit.state_reached)
│       │       ├── websocket/      # WebSocket gateway + payment listener
│       │       └── community-bot/  # Community bot REST + WS bridge
│       ├── test/
│       │   └── jest-e2e.json
│       └── nest-cli.json
│
│   └── community-worker/     # Long-running worker for community bot
│       ├── src/
│       │   ├── main.ts
│       │   ├── worker.module.ts
│       │   ├── channel-manager.service.ts
│       │   ├── processors/
│       │   │   ├── inbound.processor.ts
│       │   │   ├── outbound.processor.ts
│       │   │   └── channel-command.processor.ts
│       │   └── services/
│       │       ├── reply-generator.service.ts
│       │       └── community-guard.service.ts
│       └── package.json
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
│   ├── community-bot/         # Shared connectors, crypto, style prompt builder
│   │   └── src/
│   │       ├── connectors/
│   │       │   ├── channel-connector.interface.ts
│   │       │   ├── telegram.connector.ts
│   │       │   └── whatsapp.connector.ts
│   │       ├── crypto/
│   │       │   └── credential-cipher.ts
│   │       └── style/
│   │           ├── style-prompt.ts
│   │           └── style-context.service.ts
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
│   ├── stt-engine/            # Speech-to-text streaming (Deepgram Nova-3, Mock)
│   ├── tts-engine/            # Text-to-speech (Deepgram Aura-2, Mock) — see §14g
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
│   └── script-writer/         # AI video script generation (SSE streaming)
│       ├── index.ts           # Tool manifest (registerTool)
│       ├── backend/
│       │   └── src/
│       │       ├── script-writer.module.ts
│       │       ├── script-writer.controller.ts
│       │       ├── script-writer.service.ts
│       │       └── style-injection.service.ts
│       └── package.json
│
│   └── video-clipper/         # AI Video Analyzer & Smart Clipper (see §14f)
│       ├── index.ts           # Tool manifest (registerTool)
│       ├── backend/
│       │   └── src/
│       │       ├── video-clipper.module.ts
│       │       ├── video-clipper.controller.ts
│       │       ├── video-clipper.service.ts
│       │       ├── analysis-prompt.ts   # Prompt + defensive JSON parser
│       │       ├── pricing.ts
│       │       └── dto/analyze-video.dto.ts
│       └── package.json

│   └── voice-assistant/       # Robotina — AI voice assistant (see §14g)
│       ├── index.ts           # Tool manifest (registerTool)
│       ├── backend/
│       │   └── src/
│       │       ├── voice-assistant.module.ts
│       │       ├── voice-assistant.controller.ts  # SSE reply + conversations
│       │       ├── voice-assistant.service.ts     # model → sentences → Aura-2
│       │       ├── language.ts        # en/es/pt detection → reply language + voice
│       │       ├── speech-text.ts     # markdown → speech, sentence chunker
│       │       ├── persona-prompt.ts  # Robotina's system prompt
│       │       ├── pricing.ts
│       │       └── dto/send-message.dto.ts
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
| `ZoomableImage`       | Touch + portal   | Pinch estilo Instagram: crece sobre la página difuminada y vuelve      |

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

## 2c. Responsive UI — Mobile-First (web & admin)

Both Next.js apps are designed mobile-first: base classes target phones and
`sm:` / `md:` / `lg:` layer the larger layouts on top. Only layout, styling and
navigation components are involved — stores, API calls, sockets and event
flows are the same on every screen size.

### Breakpoints

| Range             | Devices                       | Navigation                                       |
| ----------------- | ----------------------------- | ------------------------------------------------ |
| `< 640px`         | Phones                        | Drawer (closed by default) + top-bar menu button |
| `sm` 640 – 1023px | Large phones, tablets (port.) | Drawer (closed by default) + top-bar menu button |
| `lg` ≥ 1024px     | Tablets (landscape), desktop  | Docked sidebar (collapsible in the web app)      |

### App shell

- **Web** — `DashboardLayout` renders one `<aside id="app-sidebar">` that is an
  off-canvas drawer below `lg` and docked from `lg`. Its open state lives in
  `store/mobile-nav.store.ts` (UI-only Zustand store) shared by the `TopBar`
  menu button (`aria-controls`, `aria-expanded`) and the sidebar. The drawer
  closes on navigation, backdrop tap and `Escape`; focus moves into it and back
  to the menu button. On phones the language selector moves into the drawer
  and the credits pill shows its short form (`CreditDisplay compactOnMobile`).
- **Admin** — `AdminLayout` adds a sticky mobile top bar and the same drawer
  pattern (`#admin-sidebar`) with local React state.
- `<main>` keeps bottom room on every screen so the assistant button never
  covers the last row of content. Pages with their own bottom composer mark it
  with `data-composer`; the shell then drops that padding and lifts the button
  above the composer (CSS `:has()`, no JS). Desktop split layouts sized to the
  viewport mark their root `data-full-height` and keep no room from `lg`.
- The assistant launcher (`ChatLauncher` + `useAutoCollapse`) is expanded on
  load, then after 5 s without interaction or as soon as anything scrolls it
  tucks into a 44px tab against the right edge. Hover and keyboard focus
  expand it; on touch the first tap expands it and the second opens the chat.
  Only the inner pill animates (`translate`, radius, colours) inside a fixed
  slot that ignores the pointer: no layout shift (CLS), and content beside the
  tab stays clickable. E2E specs open the chat with `openChat()`.

### On-screen keyboard

- Root layouts export `viewport` with `interactive-widget=resizes-content`
  (Chromium shrinks the layout when the keyboard opens) and
  `viewport-fit=cover` (safe-area insets).
- `VisualViewportObserver` (`@creator-hub/ui`) publishes `--app-vvh`,
  `--app-vv-top` and `--app-keyboard` from `window.visualViewport` (covers iOS,
  which only moves the visual viewport). Full-height surfaces — dialogs, the
  chat panel, admin modals — size themselves with
  `h-[var(--app-vvh,100dvh)]`, so headers, inputs and action buttons stay
  above the keyboard.
- Form fields are 16px on phones and touch devices (global CSS), which stops
  iOS/iPadOS from zooming into a focused field.

### Components & conventions

| Concern          | Convention                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Touch targets    | ≥ 44px on touch (`pointer-coarse:h-11` …); nothing is revealed only on hover (`pointer-coarse:opacity-100`)  |
| Grids            | Always `grid-cols-1` first, columns added at a breakpoint                                                    |
| Dialogs          | `DialogContent` has `role="dialog"`, is labelled by its `DialogTitle`, never exceeds the visible viewport    |
| Split tool views | Controls and preview stack below `lg`; chat-like tools open their history as an overlay drawer               |
| Calendar         | Phones open the planner on the agenda; week/month grids scroll sideways inside their card (`data-scroll-x`)  |
| Admin tables     | `table-stack` inside an `@container`: under 48rem of room each row is a card, cells labelled by `data-label` |
| Scrollers        | Intentional horizontal scrollers (chip rows, tabs, wide grids) carry `data-scroll-x`                         |
| Image previews   | `ZoomableImage`: pinch lifts the image over a blurred page and springs back; the page never zooms            |

### App-shell z-index (web, below dialogs and popovers)

| Layer                               | z-index       |
| ----------------------------------- | ------------- |
| Chat backdrop / panel / button      | 90 / 95 / 100 |
| Navigation drawer backdrop / drawer | 105 / 110     |
| Asset preview / share modal         | 120 / 130     |
| Pinch zoom layer (above everything) | 100000        |

### Testing

`apps/e2e` covers every page of both apps at 360px, 390px, 768px and
1024px (touch emulation) plus a desktop regression pass: no sideways
scrolling, drawer behaviour, keyboard shortcuts (⌘/Ctrl+K, `Escape`),
dialogs and the chat with the keyboard open, card actions without hover and
touch-target sizes. Screenshots are saved to `apps/e2e/artifacts/responsive/`.

---

## 2d. Storybook — component workshop

`apps/storybook` (`@creator-hub/storybook`) documents and exercises the UI of
the whole monorepo: the `@creator-hub/ui` primitives, the shared
`@creator-hub/i18n` language selector and components of the web and admin
apps.

### Setup

| Concern      | Choice                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Version      | Storybook 10.6.5 (all `@storybook/*` packages pinned together)                                                |
| Framework    | `@storybook/nextjs-vite` — `next/link`, `next/navigation` (App Router) and `next/image` work                  |
| Styling      | Tailwind CSS v4 via `@tailwindcss/vite`; `.storybook/preview.css` imports the web tokens                      |
| Dark mode    | `@storybook/addon-themes`, class strategy on `<html>` (`dark` default; "Light (preview)" tokens)              |
| TypeScript   | Prop tables from `react-docgen-typescript` (`tsconfig.docgen.json`); two `tsc` programs (web/admin)           |
| Viewports    | Built-in viewport addon: Mobile S 360 · Mobile 390 · Tablet 768 · Tablet landscape 1024 · Desktop 1280 · 1440 |
| Other addons | `@storybook/addon-docs` (autodocs, MDX guides), `@storybook/addon-a11y`                                       |

### Monorepo wiring

- Workspace packages resolve to their **sources** (`.storybook/monorepo-aliases.ts`), so docs read
  the real props and there is a single copy of every React context.
- Both apps map `@/*` to their own `src/`: a Vite plugin resolves `@/` per importer
  (admin files → admin sources, everything else → web); stories import admin components through
  `@admin/*`.
- App components are wrapped in the app's own `Providers` (`withWebApp` / `withAdminApp`);
  stores are seeded per story (`seedWebSession`) and `window.fetch` is mocked
  (`.storybook/mocks/api.ts`, `parameters.api`) — stories never reach a backend.
- Toolbar globals: theme, **language** (en/es/pt) and viewport.

### Rules (enforced)

- Every `*.tsx` component under `packages/ui/src/components`, `packages/i18n/src`,
  `apps/web/src/components` and `apps/admin/src/components` needs a story at the mirrored path in
  `apps/storybook/stories/` — `tests/story-coverage.spec.ts` (Vitest) fails with the file to create.
  Non-visual modules are listed in `story-coverage.config.ts` with a reason; pre-existing
  components without stories are in a pending list that can only shrink.
- Each story file declares `title`, `component`, a `description` for every `argTypes` entry and at
  least one story; titles are unique.
- `apps/e2e/tests/storybook.stories.spec.ts` renders every story and docs page of the static build
  in Chromium (play functions included), fails on blocking accessibility violations found by the
  a11y addon (§2e) and checks the viewport, theme and language globals.

## 2e. Accessibility & performance gates (web & admin)

### Accessibility (axe-core)

| Where                                      | What                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `apps/e2e/tests/{web,admin}.a11y.spec.ts`  | Every page at 390px and 1280px, plus drawers, dialogs, popovers, palette, chat and the cookie banner |
| `apps/e2e/tests/storybook.stories.spec.ts` | The a11y addon's axe report of every story (`parameters.a11y`, same rule set)                        |
| `apps/e2e/fixtures/a11y.ts`                | Rule set (WCAG 2.0–2.2 A/AA + best practices) and the gate                                           |

**Gate:** zero colour-contrast violations (`color-contrast`, `link-in-text-block`), zero
missing names/labels (`label`, `button-name`, `link-name`, `image-alt`, `aria-dialog-name`,
`aria-*-name`, `document-title`, …) and zero `critical` violations. Other findings are attached
to the report.

Conventions that keep it green:

- Text tokens meet 4.5:1 on every surface: `text-dim` is `#8391a7`, `error` `#f87171`. Text on
  `bg-primary` (and the premium/free gradients) uses `text-primary-foreground` (dark ink, 8.3:1);
  white text sits on `bg-error-solid` (`#dc2626`). On dark tints use `-400` hues.
- No `opacity-*` on readable text (coming-soon cards, inactive rows, done or unfocused calendar
  sessions): quieter tokens, `grayscale`, dashed borders or line-through instead.
- Every dialog has a name: `DialogTitle`, `aria-label` (e.g. `CommandDialog label`), or the
  title of `ActionConfirmDialog` (wired with `aria-labelledby`). Radix popovers get `aria-label`.
- Links inside text are underlined. Runtime colours (admin modes) go through
  `apps/admin/src/lib/contrast.ts` (`readableOnDark`, `readableInk`).

### Performance (Core Web Vitals)

`apps/e2e/tests/{web,admin}.performance.spec.ts` load every page of the production builds on a
phone (390×844, 4× slower CPU, 4G) and a desktop, with PerformanceObserver (layout shifts, paint,
LCP, long tasks, event timing) and the apps' own field reporter:

| Metric                                        | Gate                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| CLS (lab and field reporter)                  | < 0.1 on every page, both profiles                                              |
| FCP                                           | < 1.8 s on every page, both profiles                                            |
| LCP                                           | < 2.5 s on desktop; reported (warning) on the phone                             |
| INP (drawer, popovers, typing, chat, dialogs) | < 200 ms on desktop; < 500 ms (never "poor") on the phone, warning above 200 ms |
| TBT                                           | reported (warning above 200 ms)                                                 |

Results per page: `apps/e2e/artifacts/perf/{web,admin}-web-vitals.{jsonl,md}` and `*-inp.jsonl`.

How pages stay stable and paint at once:

- **Server-rendered shells.** The `(authed)` layout renders `AppShellSkeleton` and the admin
  `AuthGuard` renders `AdminShellSkeleton` until the session is restored on the client (they
  used to render nothing): the first HTML already paints the shell (logo / app name, menu icon)
  with the real geometry. `DialogContent` renders in place before hydration, so dialogs open on
  load (`/terms`, `/privacy`, `/cookies`) are in the first paint.
- **Reserve space for data.** Lists and grids that fill in after a request keep their size while
  loading (dashboard tool cards and activity rows, admin model stats with "—", credit-email rows
  with control-sized placeholders).
- **Less work on the main thread.** `@creator-hub/ui` is `"sideEffects": false` and listed in
  `optimizePackageImports` (pages ship only the components they use); the cookie-policy texts
  and the admin charts (recharts) load on demand (`next/dynamic`, size-matched placeholders);
  the admin dashboard applies its data in a `startTransition`; the dashboard quick prompt keeps
  its state local (typing doesn't re-render the page); the full-screen chat on phones is opaque
  (no full-viewport `backdrop-filter`). Dashboard widgets are separate chunks that load, with
  their data, only when shown and near the viewport (§2f).

### Field telemetry (real users)

`WebVitalsReporter` (`apps/{web,admin}/src/components/web-vitals-reporter.tsx`, mounted in the
root layouts) reports CLS, LCP, INP, FCP and TTFB of every page view with Next.js'
`useReportWebVitals`: as a `creatorhub:web-vital` DOM event (read by the e2e suite) and, when
`NEXT_PUBLIC_WEB_VITALS_ENDPOINT` is set at build time, as JSON via `navigator.sendBeacon` to
that collector. Unset, nothing leaves the browser.

> Note: `apps/web/sentry.client.config.ts` is not part of the client bundle with Next.js 16
> (Turbopack) — `@sentry/nextjs` v10 loads the browser SDK from `instrumentation-client.ts`.
> Until it is wired, Sentry does not collect client errors or page performance for the web app.

## 2f. Dashboard widgets

The dashboard is a grid of **widgets** — Quick prompt, Favorite tools, Plans
for today, Recent activity, Recommendations, Pro tip, Likes & views, Robotina,
Credits — that each user shows, hides and orders. They choose them in **Settings → Dashboard** (preview of every widget,
live preview of the layout on a desktop or a phone) and rearrange them on the
dashboard itself by **pressing and holding** one, iOS home-screen style.

### Layers

```
packages/shared-types   dashboard.types.ts — the contract
                        DASHBOARD_WIDGET_IDS · DEFAULT_DASHBOARD_WIDGETS
                        normalizeDashboardWidgets(unknown) → complete list
        │
        ├── apps/api  modules/dashboard-layout/
        │     GET · PUT · DELETE /user/dashboard-layout  (JwtAuthGuard)
        │     DTO: known ids, unique, boolean visibility, ≤ one per widget
        │     DashboardLayoutService → Prisma DashboardLayout (1 row / user)
        │
        └── apps/web
              lib/dashboard-widgets/   pure: catalog (name, icon, span),
                                       layout ops, drag rules, user cache
              store/dashboard-layout.store.ts   optimistic + serial saves
              components/dashboard-widgets/
                widget-grid.tsx        DndContext, reflow, overlay, modes
                sortable-widget.tsx    cell: lazy mount, wobble, badges
                widget-loader.tsx      next/dynamic — one chunk per widget
                widgets/*.tsx          the widgets (own data fetching)
                widget-preview.tsx · layout-preview.tsx   (Settings)
              components/settings/dashboard-widgets-card.tsx
```

A layout is the **complete, ordered list** `[{ id, visible }]`. Hidden widgets
keep their place, so showing one again puts it back where it was; a drag
reorders only the visible ones (`reorderVisible`). Every read and write goes
through `normalizeDashboardWidgets()` (API and web): unknown ids and
duplicates are dropped, missing widgets are appended with their default
visibility — a layout saved by an older or newer app is always valid, and a
new widget reaches existing users without a migration.

### Plans for today

`today-plans` lists the Content Planner sessions (§14e) of the user's day: name,
description (the session notes; else the video it belongs to), time and type in
the calendar's colours (`eventStyle`), with "Now", "In progress" and "Done"
marks. It reads the planner's own `GET /tools/content-planner/events?from&to`
— no new endpoint: "today" is the **local** day (midnight → midnight, DST-safe),
which only the browser knows. The rules live in
`lib/dashboard-widgets/today-plans.ts` (pure: `dayRange`, `selectTodayPlans` —
cancelled left out, done kept, sessions crossing midnight kept and labelled
"From …"/"Until …"). On the right of each row, a live countdown: "in 30 min",
"in 1 h 30 min", "Now", or how long ago it passed ("1 h 30 min ago"); a
session whose time is over and isn't marked done is **red** (`overdue`; done
ones stay quiet). `selectTodayPlans` gives each session its `phase`
(upcoming/now/past), `minutes` (to the start, rounded up; since the end,
rounded down) and `overdue`, and **orders them by closeness to now**: the
sessions happening now, then the others by distance — an upcoming one by the
time until it starts, a past one by the time since it ended (ties: now,
upcoming, past, then start time). At 10:30, 11:00 comes before one that ended
at 9:00, which comes before 15:00; the furthest ones are those left for
"+N more". `useMinuteClock` moves it all on each minute
and, after midnight, re-keys the query to the new day. At most five sessions, then
"+N more"; each one opens the planner on its week (`?date=`). Added after the
first layouts were saved: existing layouts get it at the end (normalizer).

### Pro tips

`tips` shows one of **100 tips** on using Creator Hub (dashboard, calendar, AI
planner, scripts, thumbnails, assistant, clipper, social, assets, credits,
account) and growing a channel (viral videos). They are **JSON content**, not
dictionary strings: `apps/web/src/content/pro-tips/{en,es,pt}.json` —
`{ version, locale, tips: [{ id, category, title, body }] }`, the same ids,
order and categories in every language (category labels are UI strings:
`dashboard.tips.categories.*`). `lib/dashboard-widgets/pro-tips.ts` loads only
the user's language (one lazy chunk per locale) and validates it.

- **A new tip every hour**, at :00 on the user's clock (`localHour`): a seeded
  shuffle per cycle of 100 hours (`tipIndexForHour`) — every tip once per
  cycle, a new random order each cycle and per user (salted with the user
  id), never the same tip twice in a row (also across cycles), and the same
  tip on every reload within the hour. `useMinuteClock` switches it while
  the dashboard is open.
- Adding or editing tips: change the three files (same id/category/order);
  `pro-tips.spec.ts` checks 100 valid tips per language, unique ids, same
  shape across languages, real translations, lengths and category coverage.
  Name UI elements exactly as the app shows them in each language.

### Likes & views

`asset-stats` shows the total likes and views of the user's assets and the most
liked ones (then most viewed) as rows with a small 16:9 **still** and their own
counts — a half-width card the size of "Plans for today" (same row geometry). Likes
and views happen on the public share page (`SharingService`: one view per
visitor per 24 h, one like per fingerprint) and are kept as counters on each
`GeneratedImage` (`likeCount`, `viewCount`), so no new table is needed.

```
GET /api/v1/user/assets/engagement?limit=1..12   (default 4, JwtAuthGuard)
→ { totals: { likes, views, assets, publicAssets },
    top: [{ id, type, title, previewUrl, likeCount, viewCount, isPublic, createdAt }] }
```

- `modules/asset-engagement/`: one aggregate (sums), one count (shared) and one
  `findMany` (likes or views > 0, ordered likes → views → newest, `take`), over
  the same assets as the Assets page (user + current storage).
- **Previews are stills, never videos:** an image's own file, a video's
  first-frame JPEG (`metadata.thumbnailKey`, made by the video worker), else
  `null` (placeholder). Storage references become 1-hour signed URLs
  (`resolveStorageRef`; a signing failure gives `null`, not an error).
- Web: `lib/dashboard-widgets/asset-stats.ts` normalizes any body (zeros, no
  assets) and decides where an asset opens (`assetLink`): a shared one, its
  public page `/share/:id` in a **new tab** (`rel="noopener noreferrer"`, an ↗
  and "(opens in a new tab)" for screen readers) so the dashboard stays open;
  a private one, `/assets` in the same tab. Images
  are `loading="lazy"`, low fetch priority, in fixed 64×36 boxes (no layout
  shift); a preview that fails (e.g. an expired URL) shows the placeholder.
  Counts are compact on screen (1.2K) and in full for screen readers.
- Types in `@creator-hub/shared-types` (`AssetEngagement`,
  `ASSET_ENGAGEMENT_MAX_TOP`).

### Robotina (voice assistant)

`voice-assistant` is the AI voice assistant of §14g on the dashboard: a
glowing **orb** with particles floating around it (`RobotinaOrb`, canvas
2D). Tap it and talk: while the user speaks its rim **waves with the
microphone level**, while Robotina answers out loud (Deepgram Aura-2, in the
user's language) it waves with **her voice**, and rings spread out on loud
syllables; thinking swirls light inside. A second tap sends at once; a tap
while she talks interrupts her (barge-in). **Conversation mode** (switch,
saved in the browser) listens again after each answer and pauses after 8 s
of silence. "Open chat" continues the same conversation in the tool (shared
`voice-assistant.store`). Half width, a fixed-size card (320 px) with the
orb's place in its skeleton (no layout shift); it loads **no data** on
mount — the STT socket and the audio context start on the first tap. The
animation runs only while the orb is on screen and the tab is visible;
reduced motion freezes the particles (the rim still swells with the voice).
New for existing users: appended at the end, shown (normalizer).

### Adding a widget

1. Its id in `DASHBOARD_WIDGET_IDS` and `DEFAULT_DASHBOARD_WIDGETS` (shared-types).
2. Its entry in `lib/dashboard-widgets/catalog.ts` (i18n name/description, icon, `span`).
3. Its component in `components/dashboard-widgets/widgets/` + `widget-loader.tsx`,
   its placeholder in `widget-skeleton.tsx`, its miniature in `widget-preview.tsx`.
4. A story (§2d) and the name/description in the three dictionaries.

### Performance

| Concern | How                                                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code    | Each widget is its own `next/dynamic` chunk; the page ships the grid only. Settings draws miniatures and loads no widget code                                                                        |
| Data    | Widgets fetch their own data on mount; a cell mounts its widget when the layout is known and it is within 200px of the viewport (`useInView`). Hidden widgets cost nothing                           |
| CLS     | Until then a `WidgetSkeleton` with the widget's geometry holds the cell; the user's last layout is cached per user (`creator_hub.dashboard.layout`) so returning users paint their own order at once |
| Drag    | The lifted widget is a static DOM copy (`cloneNode`), not a second mount; cells memoize their widget element so pointer moves skip the widgets' subtrees; animations are transform-only              |
| Saves   | Optimistic; one request at a time, each sending the latest list (quick toggles collapse, a reset can't be overtaken). A failed save restores the last saved layout and shows a toast                 |

### Rearranging (press and hold)

| Input       | Picks a widget up                                                                                                             | While rearranging                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Mouse / pen | Hold ~0.4 s without moving > 8px (`LONG_PRESS_MS`, as the clip timeline §14f)                                                 | Drags after 4px                            |
| Touch       | Same hold; a swipe scrolls the page (touch sensor, no `touch-action: none` on widgets)                                        | Short hold (150 ms) so swipes still scroll |
| Keyboard    | "Customize" (greeting row) → grip button → Space/Enter; ← ↑ / → ↓ one place earlier / later; Space/Enter drops; all announced | Escape cancels the move / finishes         |
| No dragging | Settings → Dashboard: up/down buttons and switches (WCAG 2.5.7)                                                               |                                            |

- Never from a text field or an element marked `NO_WIDGET_DRAG` (the favorites'
  own card handles), so long presses still select text and reorder favorites.
- Picking a widget up switches the dashboard to rearranging: a haptic tap
  (`navigator.vibrate`), every widget wobbles (`widget-jiggle`, per-widget phase
  and direction; the angle depends on the widget's width so edges move ~2px),
  content is `inert`, a "−" badge hides a widget (toast with **Undo**), the
  titles slide aside for the badges, a sticky bar offers **Add widgets**
  (→ `/settings#dashboard`) and **Done**.
- The widget lifts with a bounce (`widget-lift`) and follows the pointer; the
  grid **reflows live** as it moves (neighbours glide — FLIP via dnd-kit layout
  animations — and widgets of different sizes never overlap). On release it
  glides with a slight overshoot and lands with a bounce (`widget-land`), then
  the order is saved. Reduced motion turns all of it off.
- Pointer swaps follow the pointer only: the widget under it
  (`pointerWithin`), never the neighbour swapped with until the pointer leaves
  it, and only after the drag moved ≥ 16px since the last swap — a reflow
  alone can't trigger another swap (no back-and-forth loops between full- and
  half-width widgets).
- Keyboard moves are by **position**, not geometry: each arrow swaps with the
  previous/next widget in the order (a custom coordinate getter picks it and
  the collision rule returns exactly that widget) — one swap per key press,
  whatever the sizes, and "position N of M" is announced.

### Layout

One column below `lg`, two from `lg`: `full` widgets (Quick prompt, Favorites)
span both, `half` widgets sit side by side. Widgets adapt to their own width
with container queries (`@container`, e.g. Recommendations goes two-up from
`@xl`). Touch targets are 44px (badges keep a 28px dot with a 44px hit area).

### Tests

- shared-types: contract ids and `normalizeDashboardWidgets`.
- API (vitest): service (default, normalization, upsert, reset), DTO through the
  global `ValidationPipe`, controller path/guard.
- Web (vitest + RTL): layout ops, catalog/i18n coverage, drag rules, cache,
  store (cache-first load, server wins, offline, optimistic saves, serial queue,
  revert, reset), grid (order, lazy gate, empty state, edit mode, hide/undo,
  keyboard moves by position, long press with fake timers, Space types in
  widgets), Settings card, widgets; Plans for today (local day range, order,
  cancelled/done/now, midnight crossing, countdown and overdue, more/empty/error)
  and the minute clock; Pro tips (content of the three JSON files, parser,
  hourly rotation: stable within the hour, every tip once per cycle, no
  repeats across 3,000 cycle boundaries, per-user order, local hours; widget
  changes at :00);
  Likes & views (normalization, totals, stills, no `<video>`, broken preview,
  links, empty/error); Robotina (orb states, listen → live transcript → end
  of speech → spoken reply, second tap, barge-in, silence, conversation
  mode, STT errors, speaking with a fake Web Audio). API: engagement service (sums, query, image/video
  previews, no video file signed), `resolveStorageRef`, query DTO, controller.
- E2E (`web.dashboard-widgets.spec.ts`): mouse press-hold-drag with the lift/land
  animations and persistence, a drag across mixed sizes with jitter (no loops),
  keyboard moves with announcements, hide/undo, hidden widgets load no data,
  reduced motion, touch (hold to drag, swipe scrolls, 44px targets), Settings
  (switch, preview, order, reset, "Add widgets" anchor), Plans for today (names,
  descriptions, countdown and red past sessions on a fixed clock, local-day
  request, planner links), Pro tip (a tip from the JSON, same tip within the
  hour, another the next hour), Likes & views (lazy load on
  scroll, totals, stills, no media requests, shared asset in a new tab) and axe.

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
  readonly supportsImageInput?: boolean; // Reads AIRequest.images (vision)
}
```

### Multimodal (vision) input

`AIRequest.images?: AIImageInput[]` (`{ url, caption?, detail? }`, `@creator-hub/shared-types`)
attaches images to a text-generation request. Providers that declare
`supportsImageInput` (OpenRouter, SiliconFlow — both OpenAI-compatible) send
the user message as content parts via `buildUserMessageContent()`: the prompt,
then each image preceded by its caption. Gateways accept
`content: string | AIChatContentPart[]`. Tools must pick a model whose
`ModelMetadata.supportsVision` is true (the web `ProviderSelect` has a
`requireVision` filter).

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
│  75/50/25/10/5/DEPLETED) │ │ width, height           │
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
- **`CreditEmailTrigger`** — Admin-managed email per credit state (`state` is a unique `MarketingEventType`)
- **`CreditEmailLog`** — Credit state email deliveries; unique `dedupeKey` makes each email exactly-once (see §8)
- **`GeneratedScript`** — Stores AI-generated video scripts with platform, tone, hook type, and thumbnail prompt
- **`CommunityBotConfig`** — Per-creator bot settings (model, temperature, limits, style toggle)
- **`CommunityChannel`** — Connected Telegram/WhatsApp channels with encrypted credentials
- **`CommunityContact`** — Fans who messaged the bot (external platform ID, blocked flag)
- **`CommunityConversation`** — Thread between a channel and a contact
- **`CommunityMessage`** — Individual messages (INBOUND/OUTBOUND, credits used, skip reason)
- **`Provider` model** — Metadata de proveedores IA (slug, name, model, tier, costPerCredit, isActive, supportedTasks, config)
- **`GeneratedImage.providerId`** — Relación con `Provider`; `isProModel` se deriva del tier del proveedor
- **`DashboardLayout`** — One row per user (`userId` unique): `widgets` JSON `[{ id, visible }]` in display order; no row = default dashboard (§2f). Migration `20261126000000_add_dashboard_layout`
- **`VoiceConversation` / `VoiceMessage`** — Robotina's conversations (§14g): title, last language, model; messages with language, `spoken`, Aura-2 `voice`, `audioMs`, `creditsCharged`, `interrupted`. Text only — audio is streamed, never stored. Migration `20261127000000_add_voice_assistant`
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

POST   /api/v1/tools/script-writer/generate    # Generate script (SSE streaming)
GET    /api/v1/tools/script-writer/scripts      # List scripts
GET    /api/v1/tools/script-writer/scripts/:id  # Get a script
DELETE /api/v1/tools/script-writer/scripts/:id  # Delete a script

GET    /api/v1/tools/video-clipper/limits             # Browser limits, platforms, roadmap
GET    /api/v1/tools/video-clipper/estimate           # ?model&frames → credits
POST   /api/v1/tools/video-clipper/analyses           # Keyframes + metadata → structured JSON
GET    /api/v1/tools/video-clipper/analyses           # History (paginated)
GET    /api/v1/tools/video-clipper/analyses/:id       # One analysis
DELETE /api/v1/tools/video-clipper/analyses/:id       # Delete an analysis

POST   /api/v1/tools/voice-assistant/messages                  # Robotina reply (SSE: text + Aura-2 audio) (§14g)
GET    /api/v1/tools/voice-assistant/conversations             # History (paginated)
GET    /api/v1/tools/voice-assistant/conversations/:id         # One conversation with its messages
DELETE /api/v1/tools/voice-assistant/conversations/:id         # Delete a conversation

GET    /api/v1/community-bot/config                # Get bot config
PUT    /api/v1/community-bot/config                # Update bot settings
GET    /api/v1/community-bot/channels              # List channels
POST   /api/v1/community-bot/channels/telegram/connect  # Connect Telegram
POST   /api/v1/community-bot/channels/whatsapp/connect  # Connect WhatsApp
DELETE /api/v1/community-bot/channels/:type/disconnect   # Disconnect
GET    /api/v1/community-bot/conversations              # List conversations
GET    /api/v1/community-bot/conversations/:id/messages  # Message thread
POST   /api/v1/community-bot/playground                  # Test reply

GET    /api/v1/user/favorites                 # Favorite tool ids, in order
POST   /api/v1/user/favorites/:toolId/toggle  # Add/remove a favorite
POST   /api/v1/user/favorites/reorder         # Favorites order
GET    /api/v1/user/dashboard-layout          # Dashboard widgets {widgets:[{id,visible}], updatedAt} (§2f)
GET    /api/v1/user/assets/engagement         # Likes & views: totals + most liked assets with still previews (§2f)
PUT    /api/v1/user/dashboard-layout          # Save order + visibility (normalized)
DELETE /api/v1/user/dashboard-layout          # Back to the default dashboard

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

GET    /api/v1/admin/credit-email-triggers           # Emails per credit state
POST   /api/v1/admin/credit-email-triggers           # Create email for a state
PUT    /api/v1/admin/credit-email-triggers/:id       # Update email / toggle isActive
DELETE /api/v1/admin/credit-email-triggers/:id       # Delete email
POST   /api/v1/admin/credit-email-triggers/preview   # Render unsaved email (HTML)
POST   /api/v1/admin/credit-email-triggers/:id/test  # Send test to the admin
GET    /api/v1/admin/credit-email-logs               # Recent credit state emails

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

| Event                        | Producer              | Consumer              | Purpose                  |
| ---------------------------- | --------------------- | --------------------- | ------------------------ |
| `tool.used`                  | All tools             | Analytics, Credits    | Track usage              |
| `credits.deducted`           | CreditService         | Notifications         | Alert user               |
| `credits.depleted`           | CreditService         | Notifications         | Prompt purchase          |
| `marketing.credit_threshold` | CreditService         | MarketingEventHandler | Threshold crossed        |
| `marketing.credit_depleted`  | CreditService         | MarketingEventHandler | Marketing events         |
| `credit.state_reached`       | MarketingEventHandler | CreditEmailListener   | Credit state email       |
| `community.channel.status`   | Worker (ChannelMgr)   | API (Listener) → WS   | Channel status updates   |
| `community.message.received` | Worker (InboundProc)  | API → WS              | Fan message notification |
| `community.reply.sent`       | Worker (OutboundProc) | API → WS              | Bot reply confirmation   |
| `community.reply.skipped`    | Worker (InboundProc)  | API → WS              | Skip reason notification |
| `marketing.threshold`        | MarketingEventHandler | MarketingEvent DB     | Threshold tracking       |
| `payment:success`            | CreditBillingService  | PaymentListener       | Real-time credit update  |
| `ai.request.completed`       | AIEngine              | Analytics, Billing    | Track costs              |
| `image.generated`            | Thumbnail             | Storage, Notify       | Save & notify            |
| `translation.completed`      | ContentTranslator     | Notify                | Deliver result           |
| `translation.failed`         | ContentTranslator     | Notify                | Error handling           |
| `payment:success`            | CreditBillingService  | PaymentListener       | Notify user via WS       |
| `stt:transcript`             | AppGateway            | Frontend              | Live transcript          |
| `stt:done`                   | AppGateway            | Frontend              | Session complete         |
| `stt:error`                  | AppGateway            | Frontend              | Session error            |

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

### Event-Driven Flow Example — Robotina voice turn

Voice in reuses the STT flow above unchanged; the reply is a POST that
streams Server-Sent Events (see §14g).

```
User taps the orb (widget or tool page)
    │
    ├──► SpeechPlayer.unlock()  (audio allowed: inside the gesture)
    ├──► useVoiceButton → stt:start … stt:chunk …  (Deepgram Nova-3, multi)
    │       └──► stt:partial → live transcript + TurnDetector
    │               (final phrase + 3 s pause, UtteranceEnd, or a 2nd tap)
    ├──► stt:end → gateway bills the minutes → stt:result {fullTranscript}
    │
    ├──► POST /tools/voice-assistant/messages {content, spoken: true, model}
    │       │
    │       └──► VoiceAssistantService.reply()
    │               ├──► resolve model (tier) · hasEnoughCredits(1)
    │               ├──► detect language (en/es/pt) → Aura-2 voice
    │               ├──► save user message
    │               ├──► SSE start {conversationId, language, voice}
    │               ├──► model stream ──► SSE delta …
    │               │       └──► SpeechChunker: first sentence at once
    │               │               └──► TTSEngineService.synthesize() ──► SSE audio {index, mp3 base64}
    │               ├──► save reply → CreditService.deduct(1 cr/min of speech)
    │               └──► SSE done {messageId, audioMs, credits, balance}
    │
    ├──► SpeechPlayer plays segments in order (orb waves with her voice)
    └──► her last word → conversation mode? listen again : idle
```

| SSE event     | Payload                                                     |
| ------------- | ----------------------------------------------------------- |
| `start`       | conversationId, userMessageId, language, voice \| null      |
| `delta`       | text as the model writes it                                 |
| `audio`       | index, mimeType, base64 data, durationMs, text              |
| `audio_error` | the voice failed — the reply continues as text              |
| `action`      | id, name, status (running/done/failed), args, summary, data |
| `done`        | messageId, content, language, audioMs, credits, balance     |
| `error`       | status, message (nothing charged)                           |

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
    │      │                  └──► Check thresholds (crossing) → MarketingEvent
    │      │                         └──► credit.state_reached → Credit state email
    │      │
    │      └──► Insufficient?
    │             ├──► Return error
    │             └──► Emit "marketing.credit_depleted" → MarketingEvent
    │                    └──► credit.state_reached → Credit state email (once per cycle)
    │
    └──► Return result
```

### Marketing Events

Events emitted when credit thresholds are crossed:

| Event Type            | Threshold  | Purpose           |
| --------------------- | ---------- | ----------------- |
| `CREDIT_THRESHOLD_75` | 75 credits | Early engagement  |
| `CREDIT_THRESHOLD_50` | 50 credits | Low balance email |
| `CREDIT_THRESHOLD_25` | 25 credits | Nudge to purchase |
| `CREDIT_THRESHOLD_10` | 10 credits | Urgency           |
| `CREDIT_THRESHOLD_5`  | 5 credits  | Critical          |
| `CREDIT_DEPLETED`     | 0 credits  | Upgrade modal     |

The thresholds live in `CREDIT_THRESHOLDS` (`@creator-hub/shared-types`) and map
1:1 to `MarketingEventType`. Adding a credit state = add the number to
`CREDIT_THRESHOLDS` + add the enum value (migration).

**Detection** — `CreditService.deduct()` checks thresholds right after the
atomic debit (SEC-07), using `getCrossedCreditStates()` (`@creator-hub/billing`).
A state is entered when the balance **crosses** it (from above to at/below),
so a 3-credit debit from 52 → 49 enters `CREDIT_THRESHOLD_50`. When one debit
crosses several thresholds, only the most severe state is emitted. A rejected
debit (insufficient credits) keeps emitting `marketing.credit_depleted`.

### Credit State Emails

Admins attach an email to any credit state in **Admin → Credit Emails**
(`CreditEmailTrigger`, one per state). Defaults seeded: 50 credits (low balance)
and `CREDIT_DEPLETED` (purchase credits).

```
CreditService.deduct()                         (API or community-worker)
    └──► EventEmitter2 "marketing.credit_threshold" | "marketing.credit_depleted"
            └──► MarketingEventHandler
                    ├──► MarketingEvent row (+ Notification when depleted)
                    └──► Redis "credit.state_reached" (DomainEventPublisher)
                            └──► CreditEmailListenerService (apps/api)
                                    └──► CreditEmailService
                                            ├──► active trigger for the state?
                                            ├──► claim CreditEmailLog (unique dedupeKey)
                                            └──► EmailService → Resend (credit-state.hbs)
```

| Decision                                   | Rationale                                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis channel, not in-process event        | The community worker also deducts credits; same pattern as `payment:success`                                                                                                                                         |
| One email per state per **credit cycle**   | `dedupeKey = {userId}:{state}:{latest credit-adding CreditTransaction id}`. Unique index → exactly-once across API replicas, Redis redelivery and repeated rejected debits. The email re-arms after a purchase/bonus |
| Most severe state with an active email     | 60 → 20 enters `CREDIT_THRESHOLD_25`; if only the 50 email exists, it is sent                                                                                                                                        |
| FAILED deliveries can be re-claimed        | A later event for the same cycle retries a failed send                                                                                                                                                               |
| Admin text is never compiled by Handlebars | Only `{{name}}`, `{{credits}}`, `{{threshold}}`, `{{purchaseUrl}}` are substituted; the fixed template escapes all values. Button links must be http(s)                                                              |

Known limitation: admin credit edits (`PUT /admin/users/:id`) set
`currentCredits` directly without a `CreditTransaction`, so they do not start a
new credit cycle.

### Credit Costs

Provider-specific cost: each `Provider` row defines `costPerCredit`. ThumbnailService reads this value at request time and passes it to the worker. Credit deduction uses the actual provider cost, not a flat rate.

Model-priced features read `ModelMetadata.creditCost` (Admin → AI Models):
the Content Planner's AI analysis (chosen text model + active embedding
model), voice input (active `speech-to-text` model, **per minute**,
default 1), and the Video Clipper's analysis (chosen vision model ×
started batches of 12 keyframes). See [14e](#14e-content-planner--ai-planning-assistant)
and [14f](#14f-ai-video-analyzer--smart-clipper).

Robotina (§14g) charges **1 credit per reply**, or **1 credit per started
minute** of Aura-2 speech for spoken replies (`TTS_CREDITS_PER_MINUTE`, a
platform constant: text-to-speech is not an admin-configurable model). Her
voice input is the platform's STT, billed per minute like every voice
button.

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
  ├── Users CRUD (soft delete via isActive)
  ├── AI Models (sync, config, "Add model" by hand, delete custom ones)
  └── Credit Emails CRUD (email per credit state, preview, test send, delivery log)
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
├── credit-state-content.ts        # {{variable}} substitution for admin-written credit emails
└── templates/
    ├── template.helper.ts         # Handlebars renderer (with cache)
    ├── verification.hbs           # Verification email template
    └── credit-state.hbs           # Credit state email (50 credits left, out of credits, ...)
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
│  │  XApiService     │  │ TweetAnalysis    │  │ ApifyService     │  │
│  │  (Primary)       │  │ Service          │  │ (Fallback)       │  │
│  │                  │  │                  │  │                  │  │
│  │ • searchTweets() │  │ • Spam filter    │  │ • Apify API      │  │
│  │ • X API v2       │  │ • Authority score│  │ • Auto-scaling   │  │
│  │ • Auto-refresh   │  │ • Sentiment      │  │ • No cookies     │  │
│  │   expired tokens │  │ • Theme extract  │  │   needed         │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
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
    │       │    └──► Returns: string[] (up to 2 queries)
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
    │       │    └──► ApifyService.searchTweets(query, { maxResults: 50 })
    │       │         │
    │       │         ├──► Apify API with APIFY_API_TOKEN
    │       │         │    Actor: apidojo/twitter-scraper-lite
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
POST   /api/v1/social/tweets/drafts/:id/publish  # Publish to X (15 cr)

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

## 14c. Script Writer

### Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Script Writer Tool                             │
│  tools/script-writer/                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Frontend         │  │  Controller      │  │  Service         │  │
│  │  (Next.js page)   │  │  (REST + SSE)    │  │  (AI streaming)  │  │
│  │                   │  │                  │  │                  │  │
│  │ • Chat UI         │  │ • POST /generate │  │ • System prompt  │  │
│  │ • Config panel    │  │   (SSE stream)   │  │ • Style inject   │  │
│  │ • History sidebar │  │ • GET /scripts   │  │ • Credit billing │  │
│  │ • Voice input     │  │ • DELETE /scripts│  │ • DB persistence │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  StyleInjection  │  │  AIEngine        │  │  BillingModule   │  │
│  │  Service         │  │  (ProviderRegistry│  │  (CreditService) │  │
│  │                  │  │   streaming)     │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### How It Works

1. User enters a topic, selects platform (YouTube/TikTok/Reels/Shorts), tone, hook type, and target duration
2. Controller validates input, sets SSE headers, and pipes the service's readable stream
3. Service builds a system prompt with platform-specific rules, optional style injection, and output format
4. AI provider streams tokens → each chunk pushed as SSE `data:` event
5. Post-processing extracts thumbnail prompt, word count, estimated duration
6. Credits deducted after successful generation
7. Script saved to `GeneratedScript` table

### System Prompt Structure

```
Platform rules (YouTube Long / Shorts / TikTok / Reels)
  + Output format (HOOK → DEVELOPMENT → CLIMAX → CTA → THUMBNAIL PROMPT)
  + Hook type (Mystery / Shocking Data / Rhetorical / Contradiction)
  + Tone preset (Emotional / Controversial / Analytical / Comedic / Direct)
  + Visual cues in brackets [visual cue]
  + Optional: User Style Profile (tone, vocab, sentence length, emoji, formality)
  + Language matching (respond in user's language)
```

### Streaming SSE Protocol

```
Frontend: POST /tools/script-writer/generate
  Body: { topic, platform, tone, hookType, targetDuration, model, useStyle }

Response: text/event-stream

data: {"type":"content","content":"HOOK\n[visual cue]..."}    ← token chunks
data: {"type":"content","content":"opening phrase..."}
...
data: {"type":"done","scriptId":"...","wordCount":250,         ← final event
        "estimatedDuration":120,"thumbnailPrompt":"..."}
```

### Database Model

```prisma
enum ScriptStatus {
  GENERATING
  COMPLETED
  FAILED
}

model GeneratedScript {
  id                String       @id @default(cuid())
  userId            String
  title             String?
  topic             String
  content           String       @db.Text
  platform          String       // "youtube-long" | "youtube-shorts" | "tiktok" | "reels"
  tone              String?
  hookType          String?
  targetDuration    Int?
  estimatedDuration Int?
  wordCount         Int?
  thumbnailPrompt   String?      @db.Text
  model             String?
  metadata          Json?
  status            ScriptStatus @default(COMPLETED)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([userId, status])
}
```

### API Endpoints

```
POST   /api/v1/tools/script-writer/generate    # Generate script (SSE streaming)
GET    /api/v1/tools/script-writer/scripts      # List scripts (paginated)
GET    /api/v1/tools/script-writer/scripts/:id  # Get a script
DELETE /api/v1/tools/script-writer/scripts/:id  # Delete a script
```

### Package Structure

```
tools/script-writer/
├── index.ts                              # Tool manifest (registerTool)
├── package.json
└── backend/
    ├── src/
    │   ├── index.ts                      # Barrel exports
    │   ├── script-writer.module.ts       # NestJS module (AIEngine, Billing, Analytics)
    │   ├── script-writer.controller.ts   # REST endpoints + SSE
    │   ├── script-writer.service.ts      # Core logic + system prompt builder
    │   └── style-injection.service.ts    # User style profile loader
    └── package.json
```

---

## 14d. Community Bot

### Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        COMMUNITY BOT SYSTEM                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  API (apps/api)                                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ Controller    │  │ Config       │  │ Channel      │            │  │
│  │  │ (REST)        │  │ Service      │  │ Service      │            │  │
│  │  │               │  │              │  │              │            │  │
│  │  │ • Config CRUD │  │ • Per-user   │  │ • Validate   │            │  │
│  │  │ • Connect/    │  │   settings   │  │   tokens     │            │  │
│  │  │   Disconnect  │  │ • Model tier │  │ • Encrypt    │            │  │
│  │  │ • Conversations│  │   validation │  │   creds      │            │  │
│  │  │ • Playground  │  │              │  │ • Enqueue    │            │  │
│  │  └──────────────┘  └──────────────┘  │   commands   │            │  │
│  │                                       └──────────────┘            │  │
│  │  ┌──────────────┐  ┌──────────────┐                               │  │
│  │  │ Playground   │  │ Listener     │  ← Redis domain events        │  │
│  │  │ Service      │  │ Service      │  → Socket.IO → Frontend       │  │
│  │  └──────────────┘  └──────────────┘                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                              │ BullMQ commands                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Worker (apps/community-worker)                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ ChannelMgr   │  │ Inbound      │  │ Outbound     │            │  │
│  │  │ Service      │  │ Processor    │  │ Processor    │            │  │
│  │  │              │  │              │  │              │            │  │
│  │  │ • Live conn. │  │ • Persist    │  │ • Human delay│            │  │
│  │  │ • Rehydrate  │  │   message    │  │ • Send via   │            │  │
│  │  │ • Status     │  │ • Guard      │  │   connector  │            │  │
│  │  │   events     │  │ • AI reply   │  │ • Mark sent  │            │  │
│  │  │ • Keepalive  │  │ • Bill       │  │              │            │  │
│  │  └──────────────┘  │ • Enqueue    │  └──────────────┘            │  │
│  │                     │   outbound   │                               │  │
│  │  ┌──────────────┐  └──────────────┘                               │  │
│  │  │ ReplyGen     │  ┌──────────────┐                               │  │
│  │  │ Service      │  │ Guard        │                               │  │
│  │  │              │  │ Service      │                               │  │
│  │  │ • Style ctx  │  │              │                               │  │
│  │  │ • Conversation│ │ • Disabled?  │                               │  │
│  │  │   history    │  │ • Blocked?   │                               │  │
│  │  │ • AI engine  │  │ • Cooldown?  │                               │  │
│  │  │              │  │ • Daily limit│                               │  │
│  │  └──────────────┘  │ • Credits?   │                               │  │
│  │                     └──────────────┘                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│               ┌──────────────┴──────────────┐                           │
│               ▼                              ▼                           │
│  ┌──────────────────────┐      ┌──────────────────────┐                │
│  │  Telegram Connector  │      │  WhatsApp Connector   │                │
│  │  (telegraf)          │      │  (baileys)            │                │
│  │                      │      │                       │                │
│  │  • Long polling      │      │  • QR code pairing    │                │
│  │  • Private chats only│      │  • Auto-reconnect     │                │
│  │  • 4096 char split   │      │  • 30s keepalive      │                │
│  └──────────────────────┘      │  • Auth state persist │                │
│                                └──────────────────────┘                │
└──────────────────────────────────────────────────────────────────────────┘
```

### Three-Process Architecture

| Process            | Package                  | Role                                                     |
| ------------------ | ------------------------ | -------------------------------------------------------- |
| **Shared Package** | `packages/community-bot` | Connectors, credential encryption, style prompt builder  |
| **API**            | `apps/api`               | REST endpoints, WebSocket bridge, playground             |
| **Worker**         | `apps/community-worker`  | Live connections, BullMQ processors, AI reply generation |

### Data Flow

```
Fan sends message on Telegram/WhatsApp
  → ChannelConnector normalizes → NormalizedInboundMessage
  → ChannelManagerService enqueues to BullMQ "community-inbound"
  → InboundProcessor:
      1. Persists fan message + upserts contact/conversation
      2. Runs CommunityGuardService (cost/abuse checks)
      3. Calls ReplyGeneratorService (StyleContextService + AIEngine)
      4. Deducts credits via CreditService
      5. Enqueues outbound reply to "community-outbound"
  → OutboundProcessor:
      1. Adds human-like delay (500-1500ms)
      2. Sends reply through ChannelConnector
      3. Marks message as SENT
      4. Publishes domain event via Redis pub/sub
  → CommunityBotListenerService (API) → Socket.IO → Frontend
```

### Queue Architecture

| Queue Name                   | Processor                 | Purpose                                      |
| ---------------------------- | ------------------------- | -------------------------------------------- |
| `community-inbound`          | `InboundProcessor`        | Fan message processing + AI reply generation |
| `community-outbound`         | `OutboundProcessor`       | Deliver replies through connectors           |
| `community-channel-commands` | `ChannelCommandProcessor` | CONNECT/DISCONNECT commands from API         |

### Guard Pipeline

`CommunityGuardService` evaluates in order (cheapest checks first):

1. **Bot disabled** — `isEnabled === false`
2. **Blocked contact** — fan was manually blocked
3. **Per-contact cooldown** — last reply was less than N seconds ago
4. **Daily reply limit** — total outbound replies today exceeds cap
5. **Sufficient credits** — creator has enough billing credits for the model's cost

File: `apps/community-worker/src/services/community-guard.service.ts`

### Style Profile Integration

The bot uses the creator's `UserStyleProfile` and `UserContentSample` entries to generate replies in the creator's voice:

```
StyleContextService.buildSystemPrompt()
  → Load UserStyleProfile (tone, vocab, sentence length, emoji, formality, language)
  → Load last 5 UserContentSample entries
  → Assemble system prompt: creator identity + style rules + few-shot examples + extra instructions
```

### Credential Encryption

AES-256-GCM symmetric encryption for channel credentials at rest:

```
Format: v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>
Key: COMMUNITY_BOT_ENCRYPTION_KEY (env var, SHA-256 derived)
```

Used by both API (write) and worker (read) through the shared package.

### Channel Connectors

| Connector | Library                   | Connection Method                               |
| --------- | ------------------------- | ----------------------------------------------- |
| Telegram  | `telegraf`                | Long polling (no public URL needed)             |
| WhatsApp  | `@whiskeysockets/baileys` | WhatsApp Web multi-device protocol (QR pairing) |

WhatsApp-specific:

- QR code pairing (same as WhatsApp Web)
- 30-second keepalive pings to prevent idle disconnect
- Auto-reconnect with exponential backoff (3s → 6s → 12s → ... → 5min max)
- Auth state persistence with credential sanitization (NaN/Infinity stripping)
- `@lid` JID support for WhatsApp v7 contacts

### Domain Events

| Event                        | Published By            | Consumed By                |
| ---------------------------- | ----------------------- | -------------------------- |
| `community.channel.status`   | Worker (ChannelManager) | API (Listener) → WebSocket |
| `community.message.received` | Worker (InboundProc)    | API → WebSocket            |
| `community.reply.sent`       | Worker (OutboundProc)   | API → WebSocket            |
| `community.reply.skipped`    | Worker (InboundProc)    | API → WebSocket            |

### WebSocket Events (Socket.IO)

| WS Event Name                | Payload                           | Trigger                  |
| ---------------------------- | --------------------------------- | ------------------------ |
| `community:channel_status`   | Channel status + optional QR data | Connect/disconnect/error |
| `community:message_received` | Preview text, contact name        | Fan sends message        |
| `community:reply_sent`       | Credits used, model ID            | Bot sends reply          |
| `community:reply_skipped`    | Reason string                     | Reply skipped            |

### Database Models

```prisma
model CommunityBotConfig {
  id                 String   @id @default(cuid())
  userId             String   @unique
  isEnabled          Boolean  @default(true)
  modelId            String?
  temperature        Float    @default(0.7)
  maxTokens          Int      @default(256)
  useStyleProfile    Boolean  @default(true)
  dailyReplyLimit    Int      @default(100)
  perContactCooldown Int      @default(60)
  conversationMemory Int      @default(10)
  extraInstructions  String?  @db.Text
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user     User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  channels CommunityChannel[]
}

model CommunityChannel {
  id            String              @id @default(cuid())
  configId      String
  type          CommunityChannelType // TELEGRAM | WHATSAPP | INSTAGRAM
  status        ChannelStatus       @default(AWAITING_QR)
  credentials   String              @db.Text  // Encrypted JSON
  externalId    String?
  lastActiveAt  DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  config        CommunityBotConfig  @relation(fields: [configId], references: [id], onDelete: Cascade)
  conversations CommunityConversation[]
}

model CommunityContact {
  id            String   @id @default(cuid())
  userId        String
  externalId    String
  displayName   String?
  isBlocked     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversations CommunityConversation[]

  @@unique([userId, externalId])
}

model CommunityConversation {
  id            String   @id @default(cuid())
  channelId     String
  contactId     String
  messageCount  Int      @default(0)
  lastMessageAt DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  channel       CommunityChannel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  contact       CommunityContact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  messages      CommunityMessage[]

  @@unique([channelId, contactId])
}

model CommunityMessage {
  id              String            @id @default(cuid())
  conversationId  String
  direction       MessageDirection  // INBOUND | OUTBOUND
  content         String            @db.Text
  status          MessageStatus     @default(PENDING)
  creditsUsed     Int               @default(0)
  modelId         String?
  skipReason      String?
  externalMessageId String?
  createdAt       DateTime          @default(now())

  conversation    CommunityConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}
```

### API Endpoints

```
GET    /api/v1/community-bot/config                # Get bot config
PUT    /api/v1/community-bot/config                # Update bot settings
GET    /api/v1/community-bot/channels              # List channels
POST   /api/v1/community-bot/channels/telegram/connect  # Connect Telegram
POST   /api/v1/community-bot/channels/whatsapp/connect  # Connect WhatsApp
DELETE /api/v1/community-bot/channels/:type/disconnect   # Disconnect
GET    /api/v1/community-bot/conversations              # List conversations
GET    /api/v1/community-bot/conversations/:id/messages  # Message thread
POST   /api/v1/community-bot/playground                  # Test reply
```

### Package Structure

```
packages/community-bot/
├── src/
│   ├── community-bot.module.ts
│   ├── connectors/
│   │   ├── channel-connector.interface.ts  # ChannelConnector contract
│   │   ├── telegram.connector.ts           # Telegraf long polling
│   │   └── whatsapp.connector.ts           # Baileys (QR, reconnect, keepalive)
│   ├── crypto/
│   │   └── credential-cipher.ts            # AES-256-GCM encryption
│   └── style/
│       ├── style-prompt.ts                 # buildCommunitySystemPrompt()
│       └── style-context.service.ts        # Loads profile + samples

apps/community-worker/
├── src/
│   ├── main.ts
│   ├── worker.module.ts
│   ├── channel-manager.service.ts          # Live connections, rehydration
│   ├── processors/
│   │   ├── inbound.processor.ts            # Full reply pipeline
│   │   ├── outbound.processor.ts           # Delivery with human delay
│   │   └── channel-command.processor.ts    # CONNECT/DISCONNECT
│   └── services/
│       ├── reply-generator.service.ts      # AI reply generation
│       └── community-guard.service.ts      # Cost/abuse guards
```

## 14e. Content Planner — AI Planning Assistant

"Plan with AI" in the Content Planner turns an idea into a scheduled
production plan. The creator describes the video (typed, dictated with the
voice button, and/or up to 5 attached files), picks any active text model,
and gets back: a complexity rating, the steps with realistic durations based
on their own past productions, a suggested platform tool per step (with its
intention and a ready-to-send prompt), and the sessions placed on the
calendar.

### Architecture

```
┌────────────────────────── apps/web ──────────────────────────┐
│ AiPlannerDialog                                              │
│  ProviderSelect (text models) · VoiceButton (STT, per min)   │
│  files (.pdf .docx .txt .json .md) · platform · publish date │
│  GET estimate ──► cost shown before running                  │
│  POST multipart ──► SSE: stage… → done{plan, planId, credits}│
│  Result: complexity · similar productions · steps + tools    │
│   ├─ "Add to calendar" → POST /projects {aiPlanId, events[]} │
│   └─ "Review and edit" → PlanVideoDialog (prefilled)         │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──── tools/content-planner/backend/src/ai-planner ────────────┐
│ AiPlannerController  (FilesInterceptor, SSE, abort on close) │
│ AiPlannerService.analyze()                                   │
│  1 reading     document-extractor (unpdf, fflate; limits)    │
│  2 indexing    KnowledgeIndexService.syncProjectHistory()    │
│  3 retrieving  similar productions + best excerpts (cosine)  │
│  4 analyzing   planning-prompt → ProviderRegistry model      │
│                parsePlanResponse (validate/clamp/normalise)  │
│  5 saving      ContentAiPlan → CreditService.deduct()        │
└──────────┬───────────────────────┬───────────────────────────┘
           ▼                       ▼
  @creator-hub/ai-engine     PostgreSQL
  EmbeddingService           ContentKnowledgeChunk (real[] vectors)
  (admin model | local)      ContentAiPlan · ContentEvent.toolAction
```

`ContentPlannerAiModule` is separate from `ContentPlannerModule`, so the
calendar keeps working without AI, billing or providers.

### Vector RAG layer

- **Index** — one vector per past production of the user
  (`ContentKnowledgeChunk`, `sourceType = "project"`, at most the 50 most
  recent). The vector embeds the project's **topic** (title + notes); the
  stored `content` is the full summary (sessions, durations, done/planned),
  which is what the model sees as evidence. Sync is incremental: a project is
  re-embedded only when its topic changes; new sessions just refresh the
  stored summary.
- **Scoping** — every vector carries `userId` and `embeddingModel`. Searches
  only compare vectors of the current model; vectors of a previous model are
  deleted on the next sync (switching models rebuilds the index).
- **Retrieval** — the query is the idea + transcript + the opening of each
  file. Top 3 projects above the embedder's threshold (`minSimilarity`)
  become "similar productions" (with their real total time). When the files
  don't fit the prompt budget (12k chars), they are chunked and the chunks
  most similar to the query are kept, in document order.
- **Embedders** — `EmbeddingService.resolve()` uses the admin-activated
  `embedding` model when its provider is available (SiliconFlow, e.g.
  `BAAI/bge-m3`; `minSimilarity` 0.5), otherwise the built-in
  `LocalHashEmbeddingProvider` (`local:hash-v2`: 384-d hashed words, accent
  and stopword aware, creator-domain stopwords like "video"/platform names;
  `minSimilarity` 0.15; free, no network). The local one is lexical: it
  finds "Sourdough starter" for a sourdough idea but not "pizza dough" —
  activate a semantic model for that.
- **Uploaded files are transient** — extracted, used for the prompt and
  discarded; only a summary (file names, text lengths) is kept in
  `ContentAiPlan.inputSummary`.
- **Scale path** — vectors are `real[]` compared in Node (fine for ≤ 50 per
  user). For large corpora, move to `pgvector` with an HNSW index; the
  `embeddingModel` column already keeps models apart.

### Complexity, steps and time

The prompt carries the brief, the excerpts, the similar productions with
their real durations, a heuristic score (size of the brief, number of
sources/tools mentioned, history) and the catalogue of platform tools
(`ToolRegistry.getActive()` minus the planner itself). The reply is parsed
defensively (`parsePlanResponse`): JSON extracted from prose/fences, known
session types only, durations clamped to 15–720 min in 15-min steps, unknown
tools dropped, names de-duplicated, max 12 steps, exactly one publishing
step (last), and a timeframe of at least one working day per session
(`suggestedPublishInDays ≥ work sessions + 1`, so nothing lands in the past).
An invalid reply is an error, not a charge.

### Tool actions

Robotina (§14g) can also create sessions and read the agenda by voice,
through the actions the planner registers (`calendar.create_event`,
`calendar.list_events`).

A step may carry `toolAction = { toolId, intention, prompt }`. It travels to
the calendar (`ContentEvent.toolAction`, JSON) and is shown in the plan, in
"Plan a video" (wrench chip) and in the session dialog. "Open tool" links to
`/tools/{toolId}?prompt=…`; tool pages read it with `useToolQueryParams()`
and **prefill** their input (the user still sends it; nothing is charged
until then).

### Credits

Integrated with the existing credit flow (`CreditService.deduct()` — atomic
conditional debit, `CreditTransaction`, threshold events, credit emails):

| What             | Price                                                                      | Where it is set   |
| ---------------- | -------------------------------------------------------------------------- | ----------------- |
| Analysis         | `creditCost` of the chosen text model                                      | Admin → AI Models |
| Knowledge search | `creditCost` of the active embedding model (0 with the local embedder)     | Admin → AI Models |
| Voice input      | `creditCost` of the active speech-to-text model **per minute** (default 1) | Admin → AI Models |

- `GET …/ai-plans/estimate` shows the total before running; the web disables
  "Analyze" when the balance is lower.
- Order: save the plan → charge (description "AI plan: {title}"). If the
  charge fails the saved plan is deleted; if the user cancels (closes the
  stream) before the end, nothing is charged. PRO models are refused for FREE
  users (same rule as other tools). Usage is logged with `PlatformUsageLogger`.
- Voice input is billed by the STT gateway at the end of each session:
  `calculateCredits(durationMs, creditsPerMinute)` with the rate read from the
  active `speech-to-text` model (`getSttCreditsPerMinute`, cached 60 s,
  fallback `STT_CREDITS_PER_MINUTE` = 1). The web voice buttons show the same
  rate (`useSttCreditsPerMinute`). Keep one speech-to-text model active.

### Admin — AI Models

- **Add model** (`POST /admin/models`): provider (OpenRouter, SiliconFlow,
  Deepgram), model id, name, task type (`text-generation`,
  `image-generation`, `video-generation`, `embedding`, `speech-to-text`),
  tier, credit cost (0–1000), context length, tags, streaming/vision, active.
  Stored with `isCustom = true`: model sync never updates or deactivates it.
  Generative models also get their `Provider` row (as synced ones do).
- Custom models can be **deleted** (`DELETE /admin/models/:id`, disables its
  Provider); synced ones can only be deactivated.
- A new active text model appears at once in every text tool's model
  selector (AI Planner, Script Writer, chat…).

### Data model

```prisma
model ContentAiPlan {            // one analysis
  id, userId, modelId, status (ANALYZED | APPLIED), title, complexity,
  result Json,                   // AiPlanResult (steps, tools, similar…)
  inputSummary Json?, creditsCharged, projectId?   // set when added to the calendar
}
model ContentKnowledgeChunk {    // vector index
  id, userId, sourceType, sourceId, content, contentHash,
  embedding Float[] @db.Real, embeddingModel
  @@unique([userId, sourceType, sourceId, embeddingModel])
}
ContentEvent.toolAction Json?    // { toolId, intention, prompt }
ModelMetadata.isCustom Boolean   // added by hand in Admin
```

Migration: `20261124000000_add_ai_planner`.

### Limits and errors

Files: 5 per run, 5 MB each, 60 000 extracted characters kept per file;
DOCX archives are checked against zip bombs; unreadable or empty files are
reported by name. Idea and transcript ≤ 20 000 chars each. Errors before the stream are HTTP
errors (validation, 413); later ones are SSE `{type:"error", status, error}`
(5xx are replaced by a generic message). All messages are translated in the
web (`i18n/errors.ts`).

### Tests

- Unit (vitest, `tools/content-planner/backend`): extractor (real PDF/DOCX
  buffers), chunking, prompt/parser, knowledge index, service (charge order,
  refunds, abort, tiers), controller (SSE), DTOs.
- Integration (real PostgreSQL, skipped without `DATABASE_URL`):
  `ai-planner.integration.spec.ts` — vectors in `real[]`, retrieval excludes
  unrelated projects, atomic debit + transaction, plan applied to the
  calendar with tool actions, stale vectors of other models removed.
- ai-engine (jest): vector math, local embedder calibration (related vs
  unrelated projects), SiliconFlow client, `EmbeddingService` selection.
- Web (vitest + RTL): `ai-plan.ts` (SSE parsing, files, schedule), dialog
  (model, voice, files, cost, stages, cancel, errors, result, add/review),
  STT price hook, Plan a video prefill, session tool card.
- Admin: `model-form` helpers (vitest) and `admin.models.spec.ts`
  (Playwright): add / validate / delete models.

---

## 14f. AI Video Analyzer & Smart Clipper

Upload a video, let a multimodal model find the moments worth clipping, get
hooks and optimized titles, then preview and export short clips — with the
video **never leaving the browser** (zero upload, zero storage cost).

### Architecture

```
Browser (apps/web /tools/video-clipper)                    API (tools/video-clipper/backend)
┌──────────────────────────────────────────────┐          ┌──────────────────────────────────────┐
│ File (≤ 250 MB) → URL.createObjectURL()      │          │ VideoClipperController               │
│   │  readVideoMetadata()  (duration, size)   │          │  GET  /estimate   GET /limits        │
│   │  planKeyframeTimestamps(duration)        │  JSON    │  POST /analyses  (DTO-validated)     │
│   │  extractKeyframes() <video>→<canvas>→JPEG├─────────►│  GET/DELETE /analyses[/:id]          │
│   │    6–32 frames, ≤ 512 px, ~30–60 KB each │ frames + │            │                         │
│   │                                          │ metadata │ VideoClipperService                  │
│   ▼                                          │          │  resolve vision model (tier check)   │
│ Player · timeline · keyframe strip           │◄─────────┤  hasEnoughCredits → AI (images) →    │
│ Clip cards: preview, trim ±1 s, export       │ analysis │  parse/clamp → save → deduct         │
│   exportClip(): <video>→<canvas> (orig/9:16) │   JSON   │            │                         │
│     + WebAudio → MediaRecorder → download    │          │  ProviderRegistry → OpenRouter /     │
└──────────────────────────────────────────────┘          │  SiliconFlow (supportsImageInput)    │
                                                          └──────────────────────────────────────┘
```

### How it works

1. **Ingest (browser):** `useLocalVideo` validates the file (video type, ≤ 250 MB;
   larger files show the roadmap note), opens it as an object URL (revoked on
   change/unmount) and reads duration/resolution.
2. **Keyframes (browser):** `keyframeCount(d) = clamp(round(6 + 5·log2(1 + d/30)), 6, 32)`
   (15 s → 9, 1 min → 14, 10 min → 28, ≥ 17 min → 32), sampled at the centre of
   equal slices, scaled to ≤ 512 px and encoded as JPEG (re-encoded lower if a
   frame exceeds the 450 KB server limit). They stream into the UI as extracted.
3. **Model + cost:** the dropdown lists active `text-generation` models with
   `supportsVision` (`ProviderSelect requireVision`). `GET /estimate` returns
   `creditCost × ceil(frames / 12)`; the button is disabled when the balance is
   lower, with a link to buy credits.
4. **Analysis (API):** keyframes are sent as `AIRequest.images`, each captioned
   with its timestamp, plus a system prompt holding a strict JSON contract
   (summary, contentType, highlights `{start,end,title,hook,reason,score,tags}`,
   hooks, titles, hashtags) in the UI language, with the platform's clip-length
   rules (Shorts 5–60 s, TikTok/Reels 5–90 s, YouTube 10–180 s).
5. **Parsing:** `parseAnalysisResponse()` extracts JSON from prose/fences,
   accepts `mm:ss` and alternative keys, clamps clips to the video and the
   platform rules, resolves overlaps, keeps the 8 best (time order) and caps
   texts. No valid highlight → 400, nothing charged.
6. **Clips (browser):** preview seeks the page player and stops at the out
   point. Trims: ±1 s buttons on the clip card, or drag the selected clip's
   start/end handles on the timeline (Pointer Events — mouse, touch or pen;
   `touch-action: none`; 44px on touch; arrow keys; snapped to 0.1 s; the
   player seeks to the handle while dragging). Move a whole clip: press and
   hold it on the timeline (~400 ms; moving > 8 px first cancels, so taps and
   scrolls still work) until it lifts, then drag — the change is shown at once
   (optimistic) and the clip glides after the pointer (`useSmoothedValue`,
   frame-rate independent easing, instant with reduced motion); it is
   committed on release, reverted on Escape / cancelled gesture; arrow keys
   move it too. Always ≥ 1 s, ≤ platform max, inside the video. Export plays the
   segment in an off-screen `<video>`, paints a `<canvas>` (original, or a 9:16
   centre crop), routes audio through WebAudio (recorded, not heard) and records
   with `MediaRecorder` — H.264/AAC MP4 where supported (Chrome ≥ 126, Safari),
   else WebM — then downloads it. Real time; pauses with the tab.

### Leaving the page

The video exists only in the tab's memory, so while one is loaded
(`useLeaveGuard`) the page shows a notice and:

- **refresh / close / other sites** → the browser's own "Leave site?" prompt
  (`beforeunload`; browsers ignore custom text, hence the notice);
- **links inside the app** → an in-app dialog ("Leave and delete" / "Stay").

Accepting discards the analysis made from that video: on `pagehide` its id is
written to `localStorage` and a `keepalive` DELETE is fired; the next visit of
the tool (`flushPendingDeletions()`) deletes whatever didn't complete **before**
loading the history (404 = already gone). Analyses reopened from history
without their video are never touched. Credits are not refunded.

### Credits

Same rules as §14e: vision model `creditCost` (Admin → AI Models) × units;
PRO models refused on FREE; `hasEnoughCredits` before the model call; **save →
`CreditService.deduct()` → delete the row if the debit fails** (atomic, threshold
events and credit emails included). Model/provider failures (502), invalid
replies (400) and client disconnects (499, detected with `res.on("close")`)
charge nothing. Usage is logged with `PlatformUsageLogger`.

### Data model

```prisma
model VideoAnalysis {   // only the JSON result — never the video or frames
  id, userId, modelId, fileName, durationSec Float, frameCount Int,
  result Json,          // VideoAnalysisResult
  creditsCharged Int, createdAt
  @@index([userId, createdAt])
}
```

Migration: `20261125000000_add_video_analysis`. A reopened analysis asks for the
original file (matched by duration ± 1.5 s) to enable preview/export.

### Roadmap

Heavy camera files (4K/ProRes, up to **10 GB**) need a server/worker pipeline
(multipart upload to storage, FFmpeg keyframes and lossless cuts in a BullMQ
worker). The UI shows this as a "Coming soon" note; `GET /limits` exposes
`roadmap.heavyFilesMaxBytes`.

### Tests

- Backend (vitest, `tools/video-clipper/backend`): prompt/parser, pricing, DTOs,
  service (charge order, tiers, vision-only, abort, 502, refund on failed
  debit), controller (defaults, 499).
- API (`apps/api`, supertest): HTTP contract through the global ValidationPipe
  (250 MB limit, no video payload, query coercion) and Tool SDK discovery.
- ai-engine (jest): multimodal content parts for OpenRouter and SiliconFlow.
- Web (vitest + RTL): sampling plan, file checks, export geometry/format/file
  names, keyframe extraction + export with fake media elements, store, hook,
  components, and the page flow (upload → analyze → preview → export).
- E2E (Playwright, `web.video-clipper.spec.ts`): a real WebM in Chromium —
  keyframes decoded, request payload, preview stop, MediaRecorder export
  (playable 9:16 file), phone layout, touch targets and axe on the results.

---

## 14g. Robotina — AI Voice Assistant

**Robotina** is an AI companion to talk with about any topic, out loud, in
real time. The user speaks (or types) in English, Spanish or Portuguese;
she answers in the same language — with her **voice** when the user spoke.
Two entry points share one conversation: the tool page
(`/tools/voice-assistant`, the same layout as Post to X / X Trend Research:
history, model settings, voice button, composer) and the dashboard widget
(§2f, the orb). The sidebar has a "Robotina" button next to "Planner", and
she appears in Tools, Agents and the command palette.

### Architecture

```
┌──────────────────────────── apps/web ────────────────────────────────┐
│ VoiceAssistantPage · VoiceAssistantWidget                            │
│   RobotinaOrb (canvas: particles, waves from the live audio level)   │
│   useRobotina ── state machine idle → listening → thinking → speaking │
│     ├─ useVoiceButton / useLiveSpeechToText  (STT socket, mic level) │
│     ├─ TurnDetector       (end of speech → send, silence → pause)    │
│     ├─ voice-assistant.store ── streamAssistantReply (SSE POST)      │
│     └─ SpeechPlayer       (Web Audio: ordered, gapless, analyser)    │
└───────────────┬───────────────────────────────────┬──────────────────┘
      WebSocket stt:* (unchanged)          POST /tools/voice-assistant/messages
                ▼                                   ▼
┌─ apps/api AppGateway ─────────┐   ┌─ tools/voice-assistant/backend ─────────────┐
│ STTEngineService (Nova-3)     │   │ VoiceAssistantController (SSE, abort)       │
│ bills minutes at stt:end      │   │ VoiceAssistantService.reply()               │
└───────────────────────────────┘   │  language.ts → reply language + voice       │
                                    │  persona-prompt.ts → Robotina               │
                                    │  ProviderRegistry (chosen text model)       │
                                    │  SpeechChunker → TTSEngineService           │
                                    │  CreditService · PlatformUsageLogger        │
                                    └──────────┬─────────────────┬────────────────┘
                                               ▼                 ▼
                              packages/tts-engine          PostgreSQL
                              DeepgramTTSProvider          VoiceConversation
                              (Aura-2, REST /v1/speak)     VoiceMessage (text only)
```

### Voice in, voice out

| Step        | How                                                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Listen      | The platform's STT, unchanged (WebSocket `stt:*`, Deepgram Nova-3 `language=multi`). `useLiveSpeechToText` also exposes the **mic level** (an `AnalyserNode` tap) for the orb.                                                                                                                               |
| End of turn | `TurnDetector`: a 3 s pause after the last final phrase (any new word restarts it; room to think), Deepgram's `UtteranceEnd` when no final phrase is pending, or a second tap. No speech for 8 s ends the turn as silence (conversation mode pauses).                                                        |
| Language    | `detectLanguage()` — function words and letters only one language uses (ñ ¿ ¡ vs ã õ ç ê ô); shared words count for none. Unclear → the conversation's language → the interface language → English. The system prompt pins the reply language.                                                               |
| Think       | Any active **text** model (same `ModelSettingsPanel` as the X tools: model, temperature, max tokens). PRO models need a paid plan. Last 20 messages as history.                                                                                                                                              |
| Speak       | `SpeechChunker` sends the **first sentence** to Aura-2 as soon as it is complete (she starts talking while the model still writes); later sentences are grouped (≥ 140 chars, ≤ 400). Markdown, code, URLs and emojis are never read (`toSpeakableText`). Requests run in parallel and are emitted in order. |
| Play        | `SpeechPlayer` decodes each MP3 segment and schedules it right after the previous one (gapless) through an analyser (the orb's waves). `stop()` silences at once (barge-in).                                                                                                                                 |
| Loop        | Conversation mode (default on, saved in the browser) reopens the mic 350 ms after her last word.                                                                                                                                                                                                             |

Typed messages get a written reply (no audio). Replies of the current visit
keep their audio in memory for "Play again" (no new charge); audio is never
stored on the server.

### Actions — she can do things, not just talk

Robotina can act in the user's account: "schedule the recording tomorrow
from 3 to 4" puts a session in the Content Planner in real time. Tools
**register** what the assistant may do; the assistant discovers it at
runtime — a new tool brings new abilities without changing her (Open/Closed,
like the Tool Registry).

```
packages/tool-sdk   AssistantActionRegistry (global, ToolSdkModule)
                      register(handler) · list() · execute(name, args, ctx)
                      validateActionArgs(): names, required, types, date/time
                      formats, enums, ranges — model output is never trusted
        ▲ registers at startup (OnModuleInit)
tools/content-planner  ContentPlannerAssistantActions
                      calendar.create_event  title, date, startTime,
                                             endTime | durationMinutes,
                                             type?, notes?, reminderMinutes?
                      calendar.list_events   date, days? (1–14)
                      → ContentPlannerService (same validation, default
                        reminder and overlap warnings as the calendar UI)
        ▼ used by
tools/voice-assistant  persona prompt lists the actions + rules
                      ActionStreamParser hides <action>{…}</action>
                      from text and voice → registry.execute() → SSE
                      `action` → the model gets "ACTION RESULT …" and
                      tells the user (≤ 3 actions per reply)
```

| Concern           | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gathering details | The prompt lists each action's parameters. For actions that change data she needs every required detail **from the user** (never invents a name, date or time) and asks for what's missing, one natural question at a time; optional ones (type) she infers.                                                                                                                                                                                                                                                                                                                               |
| Real time         | She says one short sentence ("I'm adding it now"), writes the action, and stops. The server runs it at once, streams `action` (`running` → `done`/`failed`) and starts a new model round with the result; she confirms the day and time or explains the error.                                                                                                                                                                                                                                                                                                                             |
| Time zones        | The browser sends its IANA zone (`timeZone`); the prompt gives her the user's local date, time and UTC offset; `zonedDateTimeToUtc()` (`shared-utils`, `Intl` only) turns "2026-11-28 15:00" into the instant, DST-safe (skipped times are refused).                                                                                                                                                                                                                                                                                                                                       |
| Safety            | Runs as the authenticated user only (`context.userId`); arguments validated against the declared parameters; unknown actions, bad arguments and handler errors come back as `{ ok: false, summary }` — never thrown; past start times refused.                                                                                                                                                                                                                                                                                                                                             |
| Feedback          | `AssistantActionCard` in the chat (and compact on the widget): the session with its type, day, time, overlaps and "Open in planner"; the agenda she read; running/failed states. A created session invalidates the `["content-planner"]` queries, so "Plans for today" shows it at once.                                                                                                                                                                                                                                                                                                   |
| Self-correction   | Models sometimes say "let me check" / "lo busco" and end the reply without the action (or write it in another format), so nothing would happen and the turn would pass to the user. The parser accepts common variants (`<action name="…">`, `name {…}`, top-level arguments, OpenAI-style `function.arguments`); if a round still has no usable action but announces one (`announcesAction()`, en/es/pt) or has an unreadable one, the server sends the model **one** "SYSTEM NOTE" in the same reply to write it. Tools also ship a worked `example` per action, rendered in the prompt. |
| Her turn          | While an action runs her voice may pause: the player reports `onDrain`, the orb goes back to _thinking_ and the status says what she's doing ("Checking your calendar…"); conversation mode only reopens the mic after her last word of the whole reply.                                                                                                                                                                                                                                                                                                                                   |
| Memory            | Each reply stores its actions (`VoiceMessage.actions`); the history sent to the model appends `[calendar.create_event done: Created …]`, so she knows what she did.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Price             | Actions are free (the calendar is free); the reply still costs 1 credit (per minute when spoken), even with the extra model round.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Without registered actions the prompt tells her she can't change anything —
she never offers what she can't do.

### Text-to-speech — `packages/tts-engine`

Mirrors `stt-engine`: `TTSProviderInterface`, `TTSProviderBase`,
`TTSProviderRegistry`, `TTSProviderFactory` (OnModuleInit) and
`TTSEngineService` (`synthesize`, `calculateCredits`, `isAvailable`).

- **Always Deepgram Aura-2** (`POST https://api.deepgram.com/v1/speak`,
  MP3 48 kbps), with the same `DEEPGRAM_API_KEY` as speech-to-text. The
  voice is **not configurable** — not in Admin → AI Models, not in the
  settings panel (the DTO rejects any voice field); it follows the
  language of the reply (`TTS_VOICES`, `@creator-hub/shared-types`):

  | Language   | Voice     | Model                 | Accent, gender      |
  | ---------- | --------- | --------------------- | ------------------- |
  | English    | Andromeda | `aura-2-andromeda-en` | American, feminine  |
  | Spanish    | Celeste   | `aura-2-celeste-es`   | Colombian, feminine |
  | Portuguese | Bianca    | `aura-2-bianca-pt`    | Brazilian, feminine |

- Speech length is measured from the MP3 **frame headers**
  (`mp3DurationMs`), not estimated — it is what gets billed.
- One retry on 429/5xx/network errors; 20 s timeout; aborts with the client.
- `MockTTSProvider` (silent WAV as long as the text) only in
  development/test. In production without a Deepgram key there is **no
  voice**: replies come as text (`start.voice = null`) and cost 1 credit —
  never charged for silence. A failed synthesis mid-reply sends
  `audio_error` once and the reply continues as text.

### Credits

| What         | Price                                                                   | Where                               |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------- |
| Voice input  | `creditCost` of the active speech-to-text model per minute (default 1)  | STT gateway (as every voice button) |
| Reply        | 1 credit (`VOICE_ASSISTANT_REPLY_CREDITS`)                              | `pricing.ts`                        |
| Spoken reply | 1 credit per started minute of Aura-2 speech (`TTS_CREDITS_PER_MINUTE`) | `pricing.ts`                        |

- `hasEnoughCredits(1)` before anything is saved. Order: **save → charge**
  (`CreditService.deduct()`: atomic debit, thresholds, credit emails). If the
  balance dropped meanwhile (a long spoken reply, another tool), what is
  left is taken (the reply was already heard) and the message records it.
- A model failure before any text charges nothing and undoes the turn (a
  new conversation is deleted, else the user message). A reply interrupted
  before its first word is free; an interrupted reply is saved as
  `interrupted` and billed for what was delivered (audio not delivered is
  not counted).
- Usage is logged with `PlatformUsageLogger` (language, voice, audioMs,
  interrupted).

### Data model

```prisma
model VoiceConversation {   // one talk
  id, userId, title, language ("en"|"es"|"pt"), modelId?, createdAt, updatedAt
  @@index([userId, updatedAt])
}
model VoiceMessage {        // text only — audio is never stored
  id, conversationId, role ("user"|"assistant"), content, language,
  spoken, voice?, audioMs, creditsCharged, interrupted, modelId?,
  actions Json?,            // AssistantActionRecord[] run during the reply
  createdAt
  @@index([conversationId, createdAt])
}
```

Migrations: `20261127000000_add_voice_assistant`,
`20261128000000_add_voice_message_actions`.

### Related changes

- `OpenRouterProvider` now reads `parameters.conversationHistory` (the key
  every other provider and `ChatService` use; `history` still works) — so
  OpenRouter models remember the conversation.
- The web socket client (`lib/socket.ts`) falls back to the same API URL as
  the REST client (`http://localhost:3001/api/v1`) when
  `NEXT_PUBLIC_API_URL` is unset, instead of throwing (local dev, e2e
  builds); production always sets it.
- `ModelSettings` / `DEFAULT_MODEL_SETTINGS` live in `lib/model-settings.ts`
  (re-exported by the panel) so stores and widgets don't load the panel;
  the panel accepts a `footer` (Robotina's fixed-voice note and
  conversation mode).

### Tests

- Actions: `AssistantActionRegistry` + `validateActionArgs` (tool-sdk),
  time-zone helpers incl. DST (shared-utils), the planner's actions
  (local time → instant, duration past midnight, missing/backwards/past
  times, DST gap, overlaps, agenda), the stream parser (tags split in any
  chunk size, fenced/unclosed/malformed), the service loop (event order,
  tag never shown or spoken, result round, failures, unknown actions, max
  3, model failure after an action, memory), the API wiring (the real
  ContentPlannerModule registers into the global registry), the store,
  cards and planner refresh, and an E2E scheduling flow.
- tts-engine (vitest): MP3 frame parser (MPEG-2, ID3, junk), WAV helpers,
  Aura-2 requests per language (URL, auth, body), retries, errors, abort,
  factory (no mock in production), billing by started minute.
- Backend (vitest, `tools/voice-assistant/backend`): language detection
  (en/es/pt sentences, ambiguous text), speakable text and chunking, pricing,
  persona prompt, DTO, service (event order, voice by language, speech
  while writing and in order, history, language switch, text-only replies,
  no-voice fallback, TTS failure, partial model failure, refusals, undo on
  failure, partial charge, interruptions), controller (SSE, abort, errors).
- API (`apps/api`, supertest): HTTP contract through the global
  ValidationPipe (trimmed content, no voice field accepted, paging) and
  Tool SDK discovery. ai-engine: OpenRouter history.
- Web (vitest + RTL): SSE client, preferences, turn detector, orb math,
  speech player (fake Web Audio: order, gapless, end, barge-in, replay, no
  Web Audio), store, widget and page flows (listen → send → reply,
  conversation mode, silence, second tap, barge-in, stop, errors, speaking,
  typed replies, settings without any voice choice), sidebar button.
- E2E (Playwright, `web.voice-assistant.spec.ts`): a full voice turn in
  real Chromium — fake microphone, a fake Deepgram STT on the Socket.IO
  connection, end of speech, the SSE reply whose audio really plays through
  Web Audio, "Play again", conversation mode reopening the mic, ending the
  talk; typed replies and history; settings without a voice choice; phone
  layout and touch targets; the dashboard widget; axe. The page is also in
  the every-page a11y/responsive/performance gates (`WEB_PAGES`).
- Storybook: `RobotinaOrb` (every state, synthetic voice) and
  `VoiceAssistantWidget`.

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
| **Credit states on crossing**    | Thresholds checked in `CreditService.deduct()` (single debit path for all tools) by crossing, not exact match                                     |
| **Credit emails once per cycle** | Deterministic `dedupeKey` + unique index (like SEC-06): one email per state until the user gets credits again                                     |
| **Provider-agnostic email**      | `EmailProvider` abstract class — swap Resend for AWS SES by implementing one interface                                                            |
| **Verification code on User**    | Short-lived (10min), single user, no extra joins needed vs separate VerificationToken model                                                       |
| **JWT includes emailVerified**   | Avoids DB call in `EmailVerifiedGuard`                                                                                                            |
| **Admin bypasses verification**  | `EmailVerifiedGuard` checks `user.role === "ADMIN"` — admins always have full access                                                              |
| **Dynamic tool routing**         | `ChatRoutingService` queries `ToolRegistry.getActive()` at runtime — zero code changes for new tools                                              |
| **Chat SSE via POST + Readable** | NestJS `@Sse` creates GET endpoints; frontend sends POST with body. Readable stream for SSE.                                                      |
| **Dashboard layout: one list**   | Order + visibility always change together and are read together; normalized on every read/write, so new widgets need no migration                 |
| **Movement-gated widget swaps**  | Widgets of different sizes reflow truthfully while dragging; swaps need pointer movement, so a reflow can't start swap loops                      |
| **Store-driven widget open**     | `isWidgetOpen` in Zustand store allows any component to open chat via `openWidget()`                                                              |
| **Sentry for observability**     | Separate projects for API + Web, breadcrumbs for context, PII sanitization, flush on Render shutdown                                              |
| **TTS fixed, not a setting**     | Always Deepgram Aura-2, voice picked by the reply language: nothing to configure or misconfigure, one price per minute                            |
| **Sentence-level TTS over SSE**  | First sentence spoken while the model still writes; plain REST + the existing SSE pattern; parallel synthesis, in-order                           |
| **Assistant actions registry**   | Tools register what the assistant may do and she discovers them at runtime: no tool-to-tool imports, new abilities without changing her           |
| **Lexical language detection**   | Transcripts and typed text carry no language: a tiny en/es/pt detector is instant, free and testable, with fallbacks                              |
| **Apify over Crawlee**           | Apify handles authentication and scraping at scale; no cookie management needed. Crawlee was fragile and required manual cookie refresh.          |

---

## 17. Observability — Sentry

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SENTRY OBSERVABILITY                                      │
│                                                                             │
│  ┌─────────────────────────┐       ┌─────────────────────────┐             │
│  │  FRONTEND (Next.js)     │       │  BACKEND (NestJS)       │             │
│  │  @sentry/nextjs         │       │  @sentry/nestjs         │             │
│  │                         │       │                         │             │
│  │  Sentry Project:        │       │  Sentry Project:        │             │
│  │  "creatorhub-web"       │       │  "creatorhub-api"       │             │
│  │                         │       │                         │             │
│  │  • Client errors        │       │  • Exception filter     │             │
│  │  • React rendering      │       │  • HTTP interceptor     │             │
│  │  • Session Replay       │       │  • Breadcrumbs          │             │
│  │  • Fetch failures       │       │  • Performance spans    │             │
│  │  • Page performance     │       │  • User context         │             │
│  └─────────────────────────┘       └─────────────────────────┘             │
│              │                              │                              │
│              └──────────────┬───────────────┘                              │
│                             │                                              │
│                    ┌────────▼────────┐                                     │
│                    │  SENTRY.IO       │                                     │
│                    │                   │                                     │
│                    │  • Issues         │                                     │
│                    │  • Performance    │                                     │
│                    │  • Breadcrumbs    │                                     │
│                    │  • Session Replay │                                     │
│                    │  • Alerts         │                                     │
│                    └───────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sentry Projects

Each app has its own Sentry project with a separate DSN:

| Sentry Project   | App                  | DSN Variable             | Deployment |
| ---------------- | -------------------- | ------------------------ | ---------- |
| `creatorhub-api` | `apps/api` (NestJS)  | `SENTRY_DSN`             | Render     |
| `creatorhub-web` | `apps/web` (Next.js) | `NEXT_PUBLIC_SENTRY_DSN` | Vercel     |

### Package Structure

```
apps/api/src/common/sentry/
├── index.ts                        # Barrel export
├── sentry.config.ts                # Centralized config + PII sanitization
├── sentry.init.ts                  # Early init (before NestFactory)
├── sentry.service.ts               # NestJS service (context, breadcrumbs, flush)
└── sentry.module.ts                # Global NestJS module

apps/api/src/common/filters/
└── sentry-exception.filter.ts      # Global exception filter

apps/api/src/common/interceptors/
└── sentry.interceptor.ts           # HTTP performance tracking

apps/web/
├── sentry.client.config.ts         # Client-side config + Session Replay
├── sentry.server.config.ts         # Server-side config
├── sentry.edge.config.ts           # Edge runtime config
└── next.config.js                  # withSentryConfig wrapper
```

### Breadcrumb Trail — What Sentry Captures

```
User clicks "Generate Thumbnail"
    │
    ├──► [breadcrumb] HTTP request received (SentryInterceptor)
    │
    ├──► ThumbnailService → BullMQ job enqueued
    │
    ├──► [breadcrumb] Thumbnail completed (thumbnail-listener)
    │       ├──► [breadcrumb] Presigned URL generated
    │       └──► [breadcrumb] tool_job_updated emitted
    │
    ├──► AI Engine → execute()
    │       ├──► [breadcrumb] Provider selection: [openai, siliconflow]
    │       ├──► [breadcrumb] Calling openai API — task: image-generation
    │       ├──► [breadcrumb] openai responded in 2340ms
    │       └──► [breadcrumb] Deducting 10 credits for user xxx
    │
    └──► If error occurs:
            ├──► [breadcrumb] openai failed: 429 Too Many Requests
            ├──► [breadcrumb] Retrying with next provider (failed: openai)
            ├──► [breadcrumb] siliconflow responded in 1800ms
            └──► [breadcrumb] Credit deduction: insufficient credits
```

### PII Sanitization (GDPR/Compliance)

The `beforeSend` hook in `sentry.config.ts` sanitizes all events before sending:

| What                    | Action                                   |
| ----------------------- | ---------------------------------------- |
| Passwords, tokens       | Replaced with `[Filtered]`               |
| User prompts >200 chars | Truncated + `...[truncated]`             |
| Nested body data        | Same rules at every depth; arrays ≤ 10   |
| Request headers         | `authorization`, `cookie` → `[Filtered]` |
| IP addresses            | Never sent (`sendDefaultPii: false`)     |
| Session Replays         | All text masked, all media blocked       |

### Error Filtering Strategy

The `SentryExceptionFilter` intelligently filters what gets reported:

| HTTP Status | Captured? | Rationale                              |
| ----------- | --------- | -------------------------------------- |
| 401         | No        | Expected (unauthenticated users)       |
| 403         | No        | Expected (unauthorized access)         |
| 404         | No        | Client requesting nonexistent resource |
| 499         | No        | Client closed the request (cancelled)  |
| 429         | **Yes**   | Rate limit = operational issue         |
| 400/422     | **Yes**   | Possible validation bug                |
| 5xx         | **Yes**   | Server-side bugs (always)              |

### Performance Sampling

| Environment | Traces Sample Rate    | Profiles Sample Rate |
| ----------- | --------------------- | -------------------- |
| Development | 100%                  | 100%                 |
| Production  | 20% (API) / 10% (Web) | 20%                  |

Lower rates in production reduce Sentry costs and minimize performance impact on Render free tier.

### Flush on Shutdown (Critical for Render)

Render free tier can kill processes at any time (spindown, OOM, deploy). The implementation ensures events are flushed:

```
Process receives SIGTERM/SIGINT
    │
    ├──► Sentry.flush(5000)  # Wait up to 5s for events to send
    │
    ├──► process.exit(0)
    │
    └──► OnModuleDestroy → SentryService.flush()  # NestJS lifecycle hook
```

Additionally, `unhandledRejection` and `uncaughtException` handlers capture errors before crashing.

### Source Maps Upload

Source maps allow Sentry to show original TypeScript code in stack traces instead of minified JavaScript.

**Setup:**

1. Create Auth Token: https://sentry.io/settings/auth-tokens/
   - Permissions: `org:read`, `project:releases` (read & write)
2. Set environment variables in Vercel:

```env
SENTRY_AUTH_TOKEN="sntrys_..."
SENTRY_ORG="cesar-garces"
SENTRY_PROJECT="creatorhub-web"
```

3. The `withSentryConfig` wrapper in `next.config.js` automatically uploads source maps during `next build`.

### Environment Variables

```env
# Backend (Render)
SENTRY_DSN="https://xxx@xxx.sentry.io/xxx"       # Project: creatorhub-api
SENTRY_ENVIRONMENT="production"
SENTRY_RELEASE=""                                  # Auto-detects git SHA
SENTRY_TRACES_SAMPLE_RATE="0.2"                    # 20% in production

# Frontend (Vercel)
NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.sentry.io/xxx"  # Project: creatorhub-web
NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_SENTRY_RELEASE=""

# Source Maps Upload (Vercel build time)
SENTRY_AUTH_TOKEN="sntrys_..."
SENTRY_ORG="cesar-garces"
SENTRY_PROJECT="creatorhub-web"
```

### Packages with Sentry

| Package                  | Dependency               | Version    | Purpose                   |
| ------------------------ | ------------------------ | ---------- | ------------------------- |
| `@creator-hub/api`       | `@sentry/nestjs`         | `^10.63.0` | NestJS integration        |
| `@creator-hub/api`       | `@sentry/node`           | `^10.63.0` | Node.js SDK               |
| `@creator-hub/api`       | `@sentry/profiling-node` | `^10.63.0` | CPU profiling             |
| `@creator-hub/ai-engine` | `@sentry/node`           | `^10.63.0` | Breadcrumbs in AI calls   |
| `@creator-hub/billing`   | `@sentry/node`           | `^10.63.0` | Breadcrumbs in credit ops |
| `@creator-hub/web`       | `@sentry/nextjs`         | `^10.63.0` | Next.js integration       |

### Breadcrumb Categories

| Category          | Layer       | Example                                             |
| ----------------- | ----------- | --------------------------------------------------- |
| `http`            | Interceptor | `POST /api/v1/tools/thumbnail/generate → 200`       |
| `ai.engine`       | AI Engine   | `Selected 2 provider(s) for task: image-generation` |
| `ai.api_call`     | AI Engine   | `Calling openai API — task: image-generation`       |
| `billing.credit`  | Credit Svc  | `Deducted 10 credits for user xxx`                  |
| `payment.webhook` | Webhooks    | `Webhook received from mercado-pago`                |
| `tool.thumbnail`  | Listener    | `Thumbnail completed for user xxx`                  |
| `stt.session`     | WebSocket   | `STT session started for user xxx`                  |

---

## 18. Security Hardening

### Overview

A comprehensive security hardening pass addresses race conditions in user registration, credit grants, and payment reconciliation. All guarantees are enforced at the database level via unique constraints and atomic transactions — application code is a secondary defense.

### SEC-01/SEC-02 — Atomic User Registration

Registration is a single `$transaction` that creates the user, subscription, and signup bonus atomically. If a duplicate email arrives concurrently, Prisma P2002 is mapped to HTTP 409 (ConflictException) — never an unhandled 500.

```
AuthService.register()
  └──► prisma.$transaction(async (tx) => {
          1. tx.user.create({ email, passwordHash, plan: "FREE", currentCredits: 0 })
          2. tx.subscription.create({ planId: "free", status: "ACTIVE" })
          3. tx.creditTransaction.create({
               type: "BONUS",
               amount: 100,
               referenceId: "signup:{userId}",   ← deterministic idempotency key
             })
        })
  └──► P2002 on unique constraint → ConflictException (409)
```

**Shared helper:** `createUserWithSignupBonus(tx, email, passwordHash, name?)` is reused by both `register()` and `validateOAuth()` to guarantee consistent behavior.

### SEC-03 — Idempotent Payment Reconciliation

Duplicate payment webhooks (from gateway retries or network partitions) are safely ignored. `reconcilePayment()` catches Prisma P2002 on the `referenceId` unique constraint:

```
CreditBillingService.reconcilePayment()
  └──► prisma.creditTransaction.create({ referenceId: gatewayTxId })
        └──► P2002 → already processed, return true (acknowledged)
```

Both concurrent webhooks return `true` to the gateway (HTTP 200), preventing infinite retries.

### SEC-06 — CreditTransaction.referenceId Unique Constraint

The `referenceId` column on `CreditTransaction` has a database-level unique index. This makes duplicate credit grants physically impossible, regardless of application logic:

```sql
CREATE UNIQUE INDEX "CreditTransaction_referenceId_key"
  ON "CreditTransaction"("referenceId");

CREATE INDEX "CreditTransaction_userId_createdAt_idx"
  ON "CreditTransaction"("userId", "createdAt");

CREATE INDEX "CreditTransaction_type_idx"
  ON "CreditTransaction"("type");
```

PostgreSQL allows multiple NULLs in unique columns, so rows without `referenceId` are unaffected.

**Convention:** All credit-granting operations use deterministic reference IDs:

- Signup bonus: `signup:{userId}`
- Payment gateway: gateway transaction ID (e.g. `mp_tx_123`)

### SEC-07 — Atomic Conditional Debit

`CreditService.deduct()` uses an atomic `UPDATE ... WHERE currentCredits >= amount` instead of the previous read-check-then-decrement flow. This eliminates the race condition where concurrent debits could drive the balance negative.

```sql
-- Atomic conditional debit (single row lock)
UPDATE "User"
SET "currentCredits" = "currentCredits" - $amount
WHERE id = $userId AND "currentCredits" >= $amount
```

```typescript
// CreditService.deduct()
const debit = await tx.user.updateMany({
  where: { id: userId, currentCredits: { gte: amount } },
  data: { currentCredits: { decrement: amount } },
});
if (debit.count === 0) return null; // insufficient funds — race-free
```

The balance check and decrement are a single SQL statement that takes a row lock. Concurrent debits serialize at the database level.

### Rate Limiting (ThrottlerGuard)

Global rate limiting via `@nestjs/throttler` with Redis storage (`@nest-lab/throttler-storage-redis`):

| Endpoint                         | Limit          | Scope |
| -------------------------------- | -------------- | ----- |
| `POST /auth/register`            | 5 / hour       | IP    |
| `POST /auth/login`               | 10 / minute    | IP    |
| `POST /auth/verify-email`        | 10 / 5 minutes | IP    |
| `POST /auth/resend-verification` | 3 / 5 minutes  | IP    |
| `POST /auth/forgot-password`     | 3 / 5 minutes  | IP    |
| `POST /auth/reset-password`      | 5 / 5 minutes  | IP    |
| `POST /user-style/analyze`       | 5 / hour       | User  |
| Sharing endpoints                | Default        | User  |

- `ThrottlerGuard` is registered as `APP_GUARD` (applies globally)
- `@SkipThrottle()` on webhook endpoints (payment gateways retry, authenticated via HMAC)
- `trust proxy: 1` in `main.ts` for correct IP resolution behind Render's reverse proxy

### Idempotency Interceptor

A Stripe-style idempotency layer prevents duplicate mutations from double-submits:

```
IdempotencyInterceptor (on POST /auth/register)
  1. Client generates UUID: crypto.randomUUID()
  2. Frontend sends header: X-Idempotency-Key: <uuid>
  3. Interceptor computes fingerprint: SHA-256(method + path + body)
  4. Redis SET NX key=idempotency:{uuid} value={fingerprint, response} EX 86400
  5. If key exists + fingerprint matches → return cached response
  6. If key exists + fingerprint differs → 422 Unprocessable Entity
  7. If key doesn't exist → proceed, cache response
```

### Sentry Integration — P2002 → 409 Mapping

The `SentryExceptionFilter` maps Prisma P2002 (unique constraint violation) to HTTP 409, preventing duplicate/conflict errors from polluting Sentry dashboards. 409 errors are also ignored from Sentry reporting (`Sentry.captureException` is skipped for ConflictException).

### trust proxy

```typescript
// main.ts
app.set("trust proxy", 1);
```

Required for correct `X-Forwarded-For` IP resolution behind Render's reverse proxy. Without this, all requests appear to originate from the same internal IP, defeating rate limiting.

### Integration Tests

Concurrency guarantees are verified by integration tests that run against a real PostgreSQL database:

| Test                                     | Validates                             |
| ---------------------------------------- | ------------------------------------- |
| Two concurrent registrations             | Exactly one user, one 409             |
| Duplicate signup bonus referenceId       | P2002 at DB level                     |
| Two concurrent payment webhooks          | Exactly one credit, both acknowledged |
| 10 concurrent debits against balance 100 | Exactly 3 succeed, never negative     |

Tests use `vitest` with real Prisma queries against a test database. In CI without a database, tests gracefully skip via `beforeAll` schema check.

### Database Migration

```sql
-- packages/database/prisma/migrations/20260723213000_credit_txn_referenceid_unique_indexes/migration.sql
CREATE UNIQUE INDEX "CreditTransaction_referenceId_key" ON "CreditTransaction"("referenceId");
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");
```

Deployed via `prisma db push --accept-data-loss` on Render (safe because 0 duplicate referenceIds were verified before applying).

### Security Report

Full audit report: [`security_best_practices_report.md`](./security_best_practices_report.md)

---

> **Creator Hub** — Built for 1 tool today, 50 tools tomorrow.
