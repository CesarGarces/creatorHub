````markdown
# Creator UI Skill

## Purpose

This skill defines the visual language, UX principles, component architecture, and design standards for Creator Hub.

Every UI implementation must follow these rules before creating components, layouts, pages, or user experiences.

This skill takes precedence over generic frontend recommendations.

---

# Product Vision

Creator Hub is an AI-native operating system for content creators.

It is not a traditional dashboard.

It is not an admin panel.

It is not a collection of disconnected tools.

Creator Hub is a workspace where creators use AI Agents and AI Tools to generate content, assets, and workflows.

Users should feel:

- Empowered
- Creative
- Productive
- Professional

The interface should communicate:

> Describe what you want and AI helps you build it.

---

# Design Philosophy

## Simplicity

Reduce visual noise.

Every element must have a purpose.

Avoid unnecessary decorations.

---

## Focus

Guide attention toward the primary action.

Avoid competing visual elements.

Use whitespace intentionally.

---

## Scalability

Design for 1 tool or 100 tools.

Components must remain usable as the platform grows.

Never hardcode layouts around a single feature.

---

## AI First

The platform revolves around AI.

Agents and AI workflows should always feel central.

Forms are secondary.

Conversations and actions are primary.

---

# Design References

Use these products as inspiration:

- Linear
- Vercel
- Cursor
- Notion
- OpenAI
- Canva
- Framer

Never copy designs.

Only adopt:

- Hierarchy
- Spacing
- Navigation
- Interaction Patterns
- Visual Polish

---

# Visual Style

## Theme

Dark Mode First

The platform should feel:

- Premium
- Modern
- Fast
- Creative
- AI-Native

---

## Colors

### Background

```css
#0B0F19
```

### Surface

```css
#121826
```

### Primary

```css
#7C3AED
```

### Secondary

```css
#22C55E
```

### Accent

```css
#06B6D4
```

### Warning

```css
#F59E0B
```

### Danger

```css
#EF4444
```

### Border

```css
rgba(255,255,255,0.08)
```

---

# Typography

Preferred:

- Geist
- Inter

Fallback:

- system-ui

Rules:

- Large headings
- Strong hierarchy
- Readable body text
- Consistent spacing

Avoid tiny fonts.

---

# Layout Principles

Use a modern SaaS structure.

```txt
┌────────────┬─────────────────────────────┬─────────────┐
│ Sidebar    │ Main Workspace              │ Context     │
│ Navigation │ Dynamic Content             │ Activity    │
└────────────┴─────────────────────────────┴─────────────┘
```

Desktop Layout:

- Sidebar
- Content Area
- Optional Context Panel

---

# Navigation

Primary navigation:

- Dashboard
- Agents
- Studio
- Assets
- Analytics
- Credits
- Settings

Do NOT use:

```txt
Tools
```

Prefer:

```txt
Studio
```

This creates a more premium experience.

---

# Dashboard UX

The dashboard should provide:

- Quick Actions
- Recent Activity
- Recent Generations
- Recommended Agents
- Credit Balance
- Workspace Shortcuts

Users should immediately know what to do next.

Avoid empty dashboards.

---

# Tool UX

Every Tool page should follow:

```txt
Header
  ↓
Workspace
  ↓
Results
  ↓
Actions
```

Example:

```txt
Thumbnail Generator

Prompt Panel
      ↓
Generation Area
      ↓
Results Gallery
      ↓
Download Actions
```

Users should never feel lost.

---

# Agent UX

Agents should feel conversational.

Never build agents as large forms.

Preferred:

```txt
User
  ↓
Agent
  ↓
Actions
  ↓
Results
```

Example:

```txt
User:
Create a viral YouTube video idea about React.

Agent:
✓ Analyzes trends
✓ Generates titles
✓ Creates outline
✓ Generates thumbnail prompt
```

The interaction should feel collaborative.

---

# Cards

Use cards extensively.

Cards should:

- Have clear hierarchy
- Have comfortable spacing
- Support hover states
- Support loading states

Avoid excessive borders.

Use subtle elevation.

---

# Components

Prefer reusable components.

Create shared components before page-specific components.

## Shared UI

```txt
components/ui

├── Button
├── Card
├── Badge
├── Input
├── Dialog
├── Tabs
├── Tooltip
└── Skeleton
```

## Creator Components

```txt
components/creator

├── ToolCard
├── AgentCard
├── CreditWidget
├── AssetCard
├── ActivityFeed
├── PromptInput
├── GenerationGallery
└── WorkspaceHeader
```

---

# Forms

Keep forms minimal.

Prefer:

- AI prompts
- Smart defaults
- Progressive disclosure

Avoid overwhelming users with settings.

Advanced settings should be collapsible.

---

# Empty States

Every empty state must:

- Explain the feature
- Guide the next action
- Provide a CTA

Example:

```txt
No thumbnails yet.

Create your first thumbnail with AI.

[ Generate Thumbnail ]
```

Never show blank screens.

---

# Loading States

Always include:

- Skeleton loaders
- Progress indicators
- Optimistic UI when possible

Avoid sudden layout shifts.

---

# Responsive Design

Desktop First.

Primary breakpoints:

```txt
1920px
1440px
1280px
1024px
768px
480px
```

Support:

- Desktop
- Tablet
- Mobile

Navigation should collapse gracefully.

---

# Animations

Use subtle motion.

Allowed:

- Fade
- Slide
- Scale
- Hover transitions

Avoid:

- Excessive bouncing
- Flashy effects
- Distracting animations

Motion should improve clarity.

---

# Accessibility

Every implementation must include:

- Keyboard navigation
- Focus states
- ARIA labels where needed
- Sufficient color contrast
- Semantic HTML

Accessibility is mandatory.

---

# Design System Rules

Always:

- Reuse existing components
- Follow spacing scale
- Maintain visual consistency
- Prefer composition over duplication

Never:

- Create one-off components unnecessarily
- Introduce random colors
- Break layout conventions
- Ignore responsiveness

---

# Creator Hub Principle

Tools solve problems.

Skills provide capabilities.

Agents orchestrate skills.

AI powers everything.

The UI should make creators feel like they have an entire creative team working alongside them.
````
