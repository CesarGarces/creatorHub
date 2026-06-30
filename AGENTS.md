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
