import type { BrowserContext, Locator, Page } from "@playwright/test";
import { fakeJwt, type MockHandler } from "./api-mock";

export const ADMIN_TOKEN = fakeJwt({
  sub: "admin-1",
  email: "admin@local",
  role: "ADMIN",
});

/** Starts the context signed in to the admin panel (cookie + localStorage). */
export async function signInAdmin(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "admin_token", value: ADMIN_TOKEN, url: baseURL },
  ]);
  await context.addInitScript(
    (token) => localStorage.setItem("admin_token", token),
    ADMIN_TOKEN,
  );
}

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString();

const baseModel = {
  contextLength: 128000,
  maxOutputTokens: 8192,
  supportsStreaming: true,
  supportsVision: false,
  promptPricePer1k: 0.00015,
  completionPricePer1k: 0.0006,
  imagePricePerGen: null,
  profitMargin: 2,
  description: null,
  tags: [],
  integratedAt: daysAgo(12),
  createdAt: daysAgo(12),
  updatedAt: daysAgo(2),
};

export const ADMIN_MODELS = [
  {
    ...baseModel,
    id: "m-1",
    providerSlug: "openrouter",
    modelId: "openai/gpt-4o-mini-2024-07-18-long-identifier",
    displayName: "GPT-4o mini",
    taskType: "text-generation",
    tier: "FREE",
    creditCost: 1,
    isActive: true,
    isCustom: false,
  },
  {
    ...baseModel,
    id: "m-2",
    providerSlug: "siliconflow",
    modelId: "black-forest-labs/FLUX.1-schnell",
    displayName: "FLUX.1 schnell",
    taskType: "image-generation",
    tier: "PRO",
    creditCost: 4,
    isActive: true,
    isCustom: true,
  },
  {
    ...baseModel,
    id: "m-3",
    providerSlug: "deepgram",
    modelId: "nova-3",
    displayName: "Deepgram Nova 3",
    taskType: "speech-to-text",
    tier: "FREE",
    creditCost: 2,
    isActive: false,
    isCustom: true,
  },
];

export const ADMIN_USERS = [
  {
    id: "u1",
    email: "ana.creator.with.a.long.address@example.com",
    name: "Ana Creator",
    role: "USER",
    plan: "STARTER",
    currentCredits: 500,
    purchasedCredits: 1000,
    totalCredits: 1500,
    isActive: true,
    createdAt: daysAgo(40),
    lastLoginAt: daysAgo(1),
  },
  {
    id: "u2",
    email: "admin@local",
    name: "Admin",
    role: "ADMIN",
    plan: "PRO",
    currentCredits: 6000,
    purchasedCredits: 0,
    totalCredits: 6000,
    isActive: true,
    createdAt: daysAgo(90),
    lastLoginAt: daysAgo(0),
  },
  {
    id: "u3",
    email: "bruno@example.com",
    name: null,
    role: "USER",
    plan: "FREE",
    currentCredits: 0,
    purchasedCredits: 0,
    totalCredits: 0,
    isActive: false,
    createdAt: daysAgo(10),
    lastLoginAt: null,
  },
];

const MODES = [
  {
    id: "mode-1",
    slug: "image",
    name: "Image",
    description: "Image generation tools",
    icon: "🎨",
    color: "#00bbd9",
    isActive: true,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
    _count: { tools: 2, providers: 3 },
  },
  {
    id: "mode-2",
    slug: "text",
    name: "Text",
    description: "Writing and translation",
    icon: "✍️",
    color: "#22c55e",
    isActive: true,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
    _count: { tools: 4, providers: 5 },
  },
];

/** `GET /admin/voice-settings` (Admin → Voice: STT & TTS). */
export const ADMIN_VOICE_SETTINGS = {
  settings: {
    stt: { provider: "deepgram", model: "nova-3", creditsPerSecond: 1 },
    tts: {
      provider: "deepgram",
      creditsPerSecond: 2,
      voices: {
        en: { model: "aura-2", voice: "aura-2-andromeda-en" },
        es: { model: "aura-2", voice: "aura-2-celeste-es" },
        pt: { model: "aura-2", voice: "aura-2-bianca-pt" },
      },
    },
    freeTier: { minutes: null as number | null, period: "monthly" },
    updatedAt: daysAgo(1),
  },
  ttsProvider: "deepgram",
};

/** Every API call the admin pages make, with representative data. */
export function adminApiRoutes(): Record<string, unknown> {
  const listModels: MockHandler = () => ({
    data: ADMIN_MODELS,
    meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
  });
  return {
    "PATCH /auth/preferences": ({ body }: { body: unknown }) => body,
    "/admin/dashboard/stats": {
      totalUsers: 1250,
      activeUsers: 1100,
      inactiveUsers: 150,
      totalProviders: 4,
      activeProviders: 3,
      totalCreditsUsed: 48200,
      totalCreditsRemaining: 91000,
      totalFavorites: 320,
    },
    "/admin/dashboard/usage": {
      byProvider: [
        { toolId: "thumbnail-generator", usageCount: 40, credits: 400 },
        { toolId: "video-generator", usageCount: 12, credits: 600 },
        { toolId: "content-translator", usageCount: 25, credits: 25 },
      ],
    },
    "/admin/dashboard/favorites": {
      byTool: [
        { toolId: "video-generator", favoriteCount: 12 },
        { toolId: "thumbnail-generator", favoriteCount: 30 },
      ],
    },
    "/admin/dashboard/top-users": {
      users: [
        {
          userId: "u1",
          userName: "Ana Creator",
          userEmail: "ana.creator.with.a.long.address@example.com",
          userPlan: "STARTER",
          usageCount: 12,
          creditsUsed: 1500,
        },
      ],
    },
    "/admin/dashboard/registrations": {
      byDay: [
        { date: daysAgo(3).slice(0, 10), count: 4 },
        { date: daysAgo(2).slice(0, 10), count: 9 },
        { date: daysAgo(1).slice(0, 10), count: 6 },
      ],
    },
    "GET /admin/models": listModels,
    // The "Configure" dialog loads one model.
    "GET /admin/models/m-1": {
      ...ADMIN_MODELS[0],
      description: "Fast, low-cost general model.",
      tags: ["chat", "fast"],
    },
    "/admin/models/stats": {
      total: 45,
      active: 38,
      byProvider: {},
      byTaskType: { "image-generation": 9, "text-generation": 30 },
      byTier: {},
    },
    "/admin/voice-settings": ADMIN_VOICE_SETTINGS,
    "/admin/users": {
      data: ADMIN_USERS,
      meta: { page: 1, limit: 20, total: 60, totalPages: 3 },
    },
    "/admin/users/u1": ADMIN_USERS[0],
    "/admin/modes": MODES,
    "/admin/tools-with-modes": [
      {
        id: "thumbnail-generator",
        name: "Thumbnail Generator",
        description: "AI-powered thumbnail generation for YouTube videos",
        icon: "🎨",
        category: "thumbnail",
        status: "active",
        creditsPerUse: 1,
        modes: [MODES[0]],
      },
      {
        id: "content-translator",
        name: "Content Translator",
        description: "Translate content across multiple languages",
        icon: "🌐",
        category: "translator",
        status: "beta",
        creditsPerUse: 1,
        modes: [MODES[1]],
      },
    ],
    "/admin/credit-plans": [
      {
        id: "plan-1",
        slug: "PAY_AS_YOU_GO",
        name: "Pay as you go",
        description: "Buy credits anytime, no commitment",
        usdAmount: 10,
        creditsGiven: 1000,
        isActive: true,
        sortOrder: 0,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(3),
      },
      {
        id: "plan-2",
        slug: "STARTER",
        name: "Starter",
        description: "Best value for getting started",
        usdAmount: 25,
        creditsGiven: 2700,
        isActive: true,
        sortOrder: 1,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(3),
      },
    ],
    "/admin/credit-email-triggers": [
      {
        id: "trig-1",
        state: "CREDIT_THRESHOLD_50",
        subject: "You have 50 credits left",
        heading: "Running low",
        body: "Top up to keep creating.",
        ctaLabel: "Buy credits",
        ctaUrl: "https://app.example.com/credits",
        isActive: true,
        createdAt: daysAgo(20),
        updatedAt: daysAgo(2),
      },
    ],
    "/admin/credit-email-logs": [
      {
        id: "log-1",
        userId: "u1",
        state: "CREDIT_THRESHOLD_50",
        credits: 48,
        email: "ana.creator.with.a.long.address@example.com",
        subject: "You have 50 credits left",
        status: "SENT",
        error: null,
        isTest: false,
        createdAt: daysAgo(1),
      },
    ],
    "/admin/backups": [
      {
        id: "bk-1",
        filename: "creatorhub-production-2026-11-14T03-00-00.sql.gz",
        key: "backups/creatorhub-production-2026-11-14.sql.gz",
        size: 48_234_112,
        createdAt: daysAgo(2),
        database: "creatorhub",
        environment: "production",
        status: "completed",
      },
      {
        id: "bk-2",
        filename: "creatorhub-development-2026-11-15.sql.gz",
        key: "backups/creatorhub-development-2026-11-15.sql.gz",
        size: 1_204_000,
        createdAt: daysAgo(1),
        database: "creatorhub_dev",
        environment: "development",
        status: "failed",
        error: "pg_dump exited with code 1",
      },
    ],
  };
}

export interface AdminPageSpec {
  path: string;
  /** The page's `<h1>` once its data is in. */
  ready: (page: Page) => Locator;
}

const h1 = (name: string) => (page: Page) =>
  page.getByRole("heading", { level: 1, name, exact: true });

/** Every page of the admin panel (signed in). */
export const ADMIN_PAGES: AdminPageSpec[] = [
  { path: "/", ready: h1("Dashboard") },
  { path: "/models", ready: h1("AI Models") },
  { path: "/voice", ready: h1("Voice (STT & TTS)") },
  { path: "/tools", ready: h1("Tools") },
  { path: "/modes", ready: h1("Modes") },
  { path: "/users", ready: h1("Users") },
  { path: "/users/new", ready: h1("New User") },
  { path: "/users/u1/edit", ready: h1("Edit User") },
  { path: "/credit-plans", ready: h1("Credit Plans") },
  { path: "/credit-emails", ready: h1("Credit Emails") },
  { path: "/database-backups", ready: h1("Database Backups") },
];
