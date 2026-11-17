import type { Locator, Page } from "@playwright/test";
import { webApiRoutes } from "./web-data";

/**
 * API responses for every page of the signed-in web app, on top of
 * `webApiRoutes`. Enough data for each screen to render its real layout
 * (cards, tables, calendar sessions, chat history…), so the responsive specs
 * exercise what users actually see.
 */

const hoursFromNow = (h: number) =>
  new Date(Date.now() + h * 3_600_000).toISOString();
const hoursAgo = (h: number) => hoursFromNow(-h);

/** Today at `hour:minute` local time, shifted by `dayOffset` days. */
function localTime(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const PIXEL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#1a2236"/><circle cx="640" cy="360" r="180" fill="#00bbd9"/></svg>',
  );

export const ASSETS = [
  {
    id: "img-1",
    url: PIXEL,
    prompt: "Gaming thumbnail with neon lights and a shocked face",
    provider: "siliconflow",
    model: "FLUX.1-schnell",
    type: "IMAGE",
    width: 1280,
    height: 720,
    credits: 1,
    isPublic: true,
    likeCount: 4,
    createdAt: hoursAgo(5),
  },
  {
    id: "img-2",
    url: PIXEL,
    prompt: "Minimal cooking channel cover, warm colors",
    provider: "siliconflow",
    model: "FLUX.1-schnell",
    type: "IMAGE",
    width: 1280,
    height: 720,
    credits: 1,
    isPublic: false,
    likeCount: 0,
    createdAt: hoursAgo(30),
  },
  {
    id: "img-3",
    url: PIXEL,
    prompt: "Tech review thumbnail, smartphone on a desk",
    provider: "openai",
    model: "gpt-image-1",
    type: "IMAGE",
    width: 1280,
    height: 720,
    credits: 4,
    isPublic: false,
    likeCount: 0,
    createdAt: hoursAgo(50),
  },
];

export const PLANNER_EVENTS = [
  {
    id: "ev-1",
    projectId: "proj-1",
    title: "Script the unboxing video",
    type: "SCRIPTING",
    status: "PLANNED",
    startAt: localTime(0, 10),
    endAt: localTime(0, 11, 30),
    notes: null,
    reminderMinutes: 15,
    project: {
      id: "proj-1",
      title: "Phone unboxing",
      platform: "youtube-long",
    },
  },
  {
    id: "ev-2",
    projectId: "proj-1",
    title: "Record the unboxing",
    type: "RECORDING",
    status: "PLANNED",
    startAt: localTime(1, 9),
    endAt: localTime(1, 12),
    notes: "Bring the ring light",
    reminderMinutes: null,
    project: {
      id: "proj-1",
      title: "Phone unboxing",
      platform: "youtube-long",
    },
  },
  {
    id: "ev-3",
    projectId: null,
    title: "Weekly livestream",
    type: "LIVESTREAM",
    status: "DONE",
    startAt: localTime(-1, 18),
    endAt: localTime(-1, 20),
    notes: null,
    reminderMinutes: null,
    project: null,
  },
];

export const PLANNER_PROJECTS = [
  {
    id: "proj-1",
    title: "Phone unboxing",
    platform: "youtube-long",
    publishAt: localTime(5, 17),
    notes: null,
    progress: { total: 4, done: 1 },
    nextEvent: {
      id: "ev-1",
      title: "Script the unboxing video",
      type: "SCRIPTING",
      status: "PLANNED",
      startAt: localTime(0, 10),
      endAt: localTime(0, 11, 30),
      customType: null,
    },
  },
];

const CHAT_MODELS = [
  {
    id: "m-text",
    providerSlug: "siliconflow",
    modelId: "deepseek-ai/DeepSeek-V4-Flash",
    displayName: "DeepSeek V4 Flash",
    taskType: "text-generation",
    tier: "free",
    creditCost: 1,
    isActive: true,
    supportsStreaming: true,
    supportsVision: false,
    description: "Fast general-purpose model",
    tags: ["fast"],
  },
  {
    id: "m-vision",
    providerSlug: "openrouter",
    modelId: "google/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    taskType: "text-generation",
    tier: "free",
    creditCost: 4,
    isActive: true,
    supportsStreaming: true,
    supportsVision: true,
    description: "Multimodal (vision) model",
    tags: ["vision"],
  },
  {
    id: "m-image",
    providerSlug: "siliconflow",
    modelId: "black-forest-labs/FLUX.1-schnell",
    displayName: "FLUX.1 schnell",
    taskType: "image-generation",
    tier: "free",
    creditCost: 1,
    isActive: true,
    supportsStreaming: false,
    supportsVision: false,
    description: "Quick image generation",
    tags: [],
  },
  {
    id: "m-video",
    providerSlug: "siliconflow",
    modelId: "Wan-AI/Wan2.2-T2V-A14B",
    displayName: "Wan 2.2 T2V",
    taskType: "video-generation",
    tier: "free",
    creditCost: 50,
    isActive: true,
    supportsStreaming: false,
    supportsVision: false,
    description: "Text to video",
    tags: [],
  },
];

export const CHAT_SESSIONS = [
  {
    id: "chat-1",
    title: "Thumbnail ideas for my gaming channel",
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(3),
  },
  {
    id: "chat-2",
    title: "Translate my intro",
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(26),
  },
];

/** Every API call the signed-in pages make, with representative data. */
export const webPageRoutes: Record<string, unknown> = {
  ...webApiRoutes,
  "/chat/sessions": CHAT_SESSIONS,
  "/ai/models": CHAT_MODELS,
  "/user/favorites": ["thumbnail-generator", "video-generator"],
  "/images": ({ search }: { search: URLSearchParams }) => {
    const type = search.get("type");
    const data = type ? ASSETS.filter((a) => a.type === type) : ASSETS;
    return {
      data,
      meta: { page: 1, limit: 8, total: data.length, totalPages: 2 },
    };
  },
  "/tools/content-planner/events": { data: PLANNER_EVENTS },
  "/tools/content-planner/projects": { data: PLANNER_PROJECTS },
  "/tools/content-planner/stats": {
    data: { sessions: 12, plannedMinutes: 1260, done: 5 },
  },
  "/tools/content-planner/types": { data: [] },
  "/tools/content-planner/platforms": { data: [] },
  "/tools/content-planner/steps": { data: [] },
  "/tools/content-planner/ai-plans/estimate": {
    data: {
      modelId: "deepseek-ai/DeepSeek-V4-Flash",
      modelName: "DeepSeek V4 Flash",
      modelCost: 3,
      embeddingModel: "Built-in",
      embeddingCost: 0,
      total: 3,
    },
  },
  "/tools/video-clipper/analyses": {
    success: true,
    data: [
      {
        id: "va-1",
        fileName: "pasta-vlog.mp4",
        durationSec: 185,
        frameCount: 20,
        modelId: "google/gemini-2.5-flash",
        creditsCharged: 8,
        highlights: 3,
        topTitle: "Fresh pasta in 10 minutes (no machine)",
        createdAt: hoursAgo(4),
      },
    ],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  },
  "/tools/video-clipper/estimate": ({
    search,
  }: {
    search: URLSearchParams;
  }) => {
    const frames = Number(search.get("frames") ?? 12);
    const units = Math.max(1, Math.ceil(frames / 12));
    return {
      success: true,
      data: {
        modelId: "google/gemini-2.5-flash",
        modelName: "Gemini 2.5 Flash",
        modelCost: 4,
        frames,
        units,
        total: 4 * units,
      },
    };
  },
  "/tools/script-writer/scripts": {
    success: true,
    data: [
      {
        id: "script-1",
        title: "10 tips to grow on YouTube in 2026",
        topic: "Growing a YouTube channel",
        content: "HOOK: ...",
        platform: "youtube",
        tone: "casual",
        hookType: "question",
        estimatedDuration: 480,
        wordCount: 1200,
        thumbnailPrompt: null,
        status: "COMPLETED",
        createdAt: hoursAgo(8),
      },
    ],
  },
  "/tools/social-research/sessions/x-search-trends": [
    {
      id: "research-1",
      toolId: "x-search-trends",
      title: "AI video tools",
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
      messages: [],
      _count: { messages: 2 },
    },
  ],
  "/social/tweets/drafts": {
    success: true,
    data: [
      {
        id: "draft-1",
        topic: "Launching my new course",
        content: "I just launched my new course on video editing! 🎬",
        status: "DRAFT",
        createdAt: hoursAgo(2),
        updatedAt: hoursAgo(2),
      },
    ],
  },
  "/community-bot/config": {
    success: true,
    data: {
      id: "cfg-1",
      userId: "u1",
      isEnabled: true,
      modelId: "deepseek-ai/DeepSeek-V4-Flash",
      temperature: 0.7,
      maxTokens: 400,
      systemPromptExtra: null,
      useStyleProfile: true,
      historyLength: 10,
      dailyReplyLimit: 200,
      perContactCooldownSec: 30,
    },
  },
  "/community-bot/channels": {
    success: true,
    data: [
      {
        id: "ch-1",
        type: "TELEGRAM",
        status: "ACTIVE",
        externalIdentity: "@ana_creator_bot",
        lastConnectedAt: hoursAgo(1),
        lastError: null,
        createdAt: hoursAgo(100),
      },
    ],
  },
  "/community-bot/conversations": {
    data: [
      {
        id: "conv-1",
        messageCount: 6,
        lastMessageAt: hoursAgo(1),
        contact: {
          externalId: "12345",
          username: "fan_of_ana",
          displayName: "Carlos Fan",
          isBlocked: false,
        },
        channel: { type: "TELEGRAM" },
        messages: [
          {
            content: "When is the next video coming out?",
            direction: "INBOUND",
            status: "PROCESSED",
            createdAt: hoursAgo(1),
          },
        ],
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
};

export interface PageSpec {
  path: string;
  /** Something every render of the page shows once its data is in. */
  ready: (page: Page) => Locator;
}

const h1 = (name: string | RegExp) => (page: Page) =>
  page.getByRole("heading", { level: 1, name });
const heading = (name: string | RegExp) => (page: Page) =>
  page.getByRole("heading", { name }).first();

/** Every page of the signed-in web app. */
export const WEB_PAGES: PageSpec[] = [
  { path: "/dashboard", ready: h1(/Good (morning|afternoon|evening)/) },
  { path: "/agents", ready: h1("Agents") },
  { path: "/tools", ready: h1("Tools") },
  {
    path: "/tools/thumbnail-generator",
    ready: (page) =>
      page.getByRole("radiogroup", { name: "Aspect ratio selection" }),
  },
  {
    path: "/tools/video-generator",
    ready: (page) =>
      page.getByRole("radiogroup", { name: "Aspect ratio selection" }),
  },
  {
    path: "/tools/content-translator",
    ready: (page) =>
      page.getByRole("button", { name: "Translate", exact: true }),
  },
  { path: "/tools/script-writer", ready: heading("Script Writer") },
  { path: "/tools/x-post-tweet", ready: heading(/Post to X/) },
  { path: "/tools/x-search-trends", ready: heading(/X Trend Research/) },
  { path: "/tools/content-planner", ready: h1("Content Planner") },
  {
    path: "/tools/video-clipper",
    ready: h1("AI Video Analyzer & Smart Clipper"),
  },
  { path: "/assets", ready: h1("Assets") },
  { path: "/history", ready: h1("History") },
  { path: "/community-bot", ready: h1("Community Bot") },
  { path: "/credits", ready: heading("Credit Plans") },
  { path: "/settings", ready: h1("Settings") },
];

/** Public pages (no session needed). */
export const PUBLIC_WEB_PAGES: PageSpec[] = [
  { path: "/login", ready: h1("Welcome to Creator Hub") },
  { path: "/register", ready: h1("Create your account") },
  { path: "/auth/forgot-password", ready: h1("Forgot password?") },
  { path: "/terms", ready: heading("Terms of Service") },
  { path: "/privacy", ready: heading("Privacy Policy") },
  { path: "/cookies", ready: heading("Cookie Policy") },
];
