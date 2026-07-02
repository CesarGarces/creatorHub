# Creator Hub — Agent Skills Index

When working on this project, ALWAYS load the relevant skill(s) BEFORE writing code.

This repository follows a modular architecture based on:

- Turborepo
- Reactjs
- NestJS
- Prisma
- PostgreSQL
- Zustand
- TailwindCSS
- AI Engine
- Tools
- Agents
- Skills

---

# ⛔ CRITICAL RULES — NEVER BREAK THESE

## NEVER use `prisma migrate reset`

```
prisma migrate reset --force   ← THIS DESTROYS ALL DATA. NO UNDO.
```

- It drops ALL tables, ALL data, ALL users, ALL history
- There is NO backup created automatically
- There is NO way to recover
- **This caused a production data loss incident**

**If you need to fix schema drift, use instead:**

```bash
npm run db:migrate     # create a new migration
npm run db:push        # push schema changes directly
```

**Before ANY destructive database operation:**

```bash
npm run db:backup      # saves to packages/database/backups/
```

---

# How To Use

1. Identify the task.
2. Find matching skills below.
3. Read the corresponding SKILL.md files.
4. Follow ALL patterns defined in those skills.
5. Multiple skills may be loaded simultaneously.
6. Architecture and type safety rules always take priority.

---

# Global Architecture Rules

All development must respect:

- Modular Monolith Architecture
- Clean Architecture
- Domain Driven Design
- SOLID Principles
- Dependency Injection
- Tool Registry Pattern
- Agent Registry Pattern
- Provider Registry Pattern
- Event Driven Design

---

# Repository Structure

````txt
apps/
├── web
└── api

packages/
├── ai-engine
├── auth
├── billing
├── database
├── storage
├── analytics
├── tool-sdk
├── agent-sdk
├── skill-sdk
├── shared-types
└── shared-utils

tools/
├── thumbnail-generator
├── title-generator
├── stream-games
└── future-tools

agents/
├── thumbnail-agent
├── youtube-agent
├── twitch-agent
└── future-agents

skills/
├── image-generation
├── text-generation
├── image-analysis
├── trend-analysis
└── future-skills

---

# Database Commands

Run from `packages/database/`:

```bash
npm run db:backup       # Create backup before ANY changes
npm run db:restore      # Restore from latest backup (requires confirmation)
npm run db:migrate      # Create new migration
npm run db:push         # Push schema changes without migration
npm run db:seed         # Seed base data (Tools, Plans, Providers)
npm run db:generate     # Regenerate Prisma client
npm run db:studio       # Open Prisma Studio
````

**Backup location:** `packages/database/backups/`
**Backups are gitignored** — never committed to repo.

---

# Tool Chat Input Params Pattern (MANDATORY)

Every tool that can be invoked from the AI chat MUST define `chatInputParams` in its `ToolManifest`. This is a **contract** between the tool definition, the AI system prompt, and the frontend.

## Why

When a user says "write a tweet about AI", the AI responds with a JSON action:

```json
{
  "action": "route_to_tool",
  "toolId": "x-post-tweet",
  "params": { "prompt": "write a tweet about AI" }
}
```

The frontend then navigates to the tool page with query params:

```
/tools/x-post-tweet?prompt=write%20a%20tweet%20about%20AI
```

The tool page reads these params and auto-sends to the chat. **All of this happens automatically** if the tool defines `chatInputParams`.

## How to add chatInputParams to a new tool

### 1. Define in tool registration (`tools/<tool-id>/index.ts`)

```typescript
registerTool({
  id: "my-tool",
  // ...
  chatInputParams: [
    {
      name: "prompt", // URL param name
      type: "string", // "string" | "number" | "boolean"
      required: true,
      description: "what the user wants to generate",
      maxLength: 500, // optional
    },
  ],
});
```

### 2. Add the hook to the tool page (`apps/web/src/app/(authed)/tools/<tool-id>/page.tsx`)

```typescript
import { useToolQueryParams } from "@/hooks/use-tool-query-params";

export default function MyToolPage() {
  useToolQueryParams(); // reads ?prompt=..., auto-sends to chat
  // ...
}
```

That's it. The hook handles:

- Reading `text`, `prompt`, `topic`, `query`, `content` from URL
- Auto-sending the message to chat
- Clearing params from URL after sending
- Preventing duplicate sends

### 3. The AI system prompt is generated automatically

`ChatRoutingService` reads `chatInputParams` from all active tools and includes them in the system prompt:

```
**My Tool** (id: "my-tool", design)
   Chat params: { "prompt": "<what the user wants to generate>" }
```

The AI uses these param names in its JSON response. No hardcoding needed.

## Param name conventions

**ALL tools MUST use `prompt` as the param name.** This is the standard across the entire project.

The hook reads `prompt` first, then falls back to: `text`, `topic`, `query`, `content`.

```json
{
  "action": "route_to_tool",
  "toolId": "any-tool",
  "params": { "prompt": "<user request>" }
}
```

## Checklist for new tools

- [ ] `chatInputParams` defined in `registerTool()`
- [ ] `useToolQueryParams()` added to tool page
- [ ] No hardcoded param names in chat system prompt (use manifest)
- [ ] `backend.modulePath` points to correct NestJS module (not `module`)
