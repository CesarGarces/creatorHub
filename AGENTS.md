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

```txt
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