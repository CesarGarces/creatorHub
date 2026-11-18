import {
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";
import { useDashboardLayoutStore } from "@/store/dashboard-layout.store";
import { STORY_USER } from "../../.storybook/decorators/web";

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

/** Tools as GET /tools returns them. */
export const DASHBOARD_TOOLS = [
  {
    id: "thumbnail-generator",
    name: "Thumbnail Generator",
    description: "AI-powered thumbnail generation for YouTube videos",
    icon: "🎨",
    category: "thumbnail",
    creditsPerUse: 1,
    status: "active",
  },
  {
    id: "video-generator",
    name: "Video Generator",
    description: "Generate stunning AI videos with Wan AI models",
    icon: "🎬",
    category: "video",
    creditsPerUse: 50,
    status: "active",
  },
  {
    id: "content-translator",
    name: "Content Translator",
    description:
      "Translate content across multiple languages with AI precision",
    icon: "🌐",
    category: "translator",
    creditsPerUse: 1,
    status: "beta",
  },
  {
    id: "script-writer",
    name: "Script Writer",
    description: "Write engaging video scripts with AI",
    icon: "📝",
    category: "text",
    creditsPerUse: 5,
    status: "active",
  },
];

/** GET /credits/transactions */
export const DASHBOARD_TRANSACTIONS = [
  {
    id: "t1",
    amount: -5,
    type: "USAGE",
    description: "Thumbnail generation",
    toolName: "Thumbnail Generator",
    toolIcon: "🎨",
    createdAt: hoursAgo(3),
  },
  {
    id: "t2",
    amount: 500,
    type: "PURCHASE",
    description: "Credit pack — 500 credits",
    toolName: null,
    toolIcon: null,
    referenceId: "mp-123",
    createdAt: hoursAgo(26),
  },
  {
    id: "t3",
    amount: 100,
    type: "BONUS",
    description: "Signup bonus",
    toolName: null,
    toolIcon: null,
    createdAt: hoursAgo(72),
  },
];

export const DEFAULT_LAYOUT: DashboardWidgetState[] =
  DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w }));

/** Every widget shown, credits near the top. */
export const CUSTOM_LAYOUT: DashboardWidgetState[] = [
  { id: "quick-prompt", visible: true },
  { id: "credits", visible: true },
  { id: "activity", visible: true },
  { id: "favorites", visible: true },
  { id: "recommendations", visible: true },
  { id: "tips", visible: false },
];

/** Today at a local time (stories always show "today"). */
const todayAt = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/** GET /tools/content-planner/events — today's sessions (Plans for today). */
export const TODAY_EVENTS = [
  {
    id: "ev1",
    projectId: "p1",
    title: "Write the unboxing script",
    type: "SCRIPTING",
    status: "DONE",
    startAt: todayAt(8, 30),
    endAt: todayAt(9, 30),
    notes: "Hook in the first 5 s, three key features, call to action.",
    project: {
      id: "p1",
      title: "Unboxing: new camera",
      platform: "youtube-long",
    },
  },
  {
    id: "ev2",
    projectId: "p1",
    title: "Record the unboxing",
    type: "RECORDING",
    status: "PLANNED",
    startAt: todayAt(11),
    endAt: todayAt(13),
    notes: "Two cameras, natural light by the window. Charge the batteries.",
    project: {
      id: "p1",
      title: "Unboxing: new camera",
      platform: "youtube-long",
    },
  },
  {
    id: "ev3",
    projectId: "p2",
    title: "Thumbnail",
    type: "THUMBNAIL",
    status: "PLANNED",
    startAt: todayAt(16),
    endAt: todayAt(16, 45),
    notes: null,
    project: { id: "p2", title: "Weekly vlog #12", platform: "youtube-long" },
  },
  {
    id: "ev4",
    projectId: null,
    title: "Community Q&A",
    type: "LIVESTREAM",
    status: "PLANNED",
    startAt: todayAt(20),
    endAt: todayAt(21, 30),
    notes: "Answer the top questions from the last video's comments.",
    project: null,
  },
];

/** A 16:9 still drawn inline (no network): a gradient and a label. */
const still = (from: string, to: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><text x="16" y="160" font-family="sans-serif" font-size="22" font-weight="700" fill="white">${label}</text></svg>`,
  )}`;

/** GET /user/assets/engagement — likes & views of the user's assets. */
export const ASSET_ENGAGEMENT = {
  totals: { likes: 1280, views: 45210, assets: 14, publicAssets: 5 },
  top: [
    {
      id: "img1",
      type: "IMAGE",
      title: "Neon gaming thumbnail with a surprised face",
      previewUrl: still("#a21caf", "#0ea5e9", "GG!"),
      likeCount: 1200,
      viewCount: 38000,
      isPublic: true,
      createdAt: "2026-11-10T12:00:00.000Z",
    },
    {
      id: "vid1",
      type: "VIDEO",
      title: "Product launch teaser",
      previewUrl: still("#0f172a", "#f59e0b", "LAUNCH"),
      likeCount: 64,
      viewCount: 6900,
      isPublic: true,
      createdAt: "2026-11-09T12:00:00.000Z",
    },
    {
      id: "img2",
      type: "IMAGE",
      title: "Cooking vlog cover",
      previewUrl: still("#16a34a", "#facc15", "RECIPE"),
      likeCount: 15,
      viewCount: 310,
      isPublic: true,
      createdAt: "2026-11-05T12:00:00.000Z",
    },
    {
      id: "vid2",
      type: "VIDEO",
      title: "Behind the scenes",
      previewUrl: null,
      likeCount: 1,
      viewCount: 0,
      isPublic: false,
      createdAt: "2026-11-01T12:00:00.000Z",
    },
  ],
};

/** API answers the dashboard widgets need (merge into `parameters.api`). */
export function dashboardApi(widgets: DashboardWidgetState[] = DEFAULT_LAYOUT) {
  return {
    "/tools/content-planner/events": { data: TODAY_EVENTS },
    "/user/assets/engagement": ASSET_ENGAGEMENT,
    "/tools": DASHBOARD_TOOLS,
    "/user/favorites": ["thumbnail-generator", "script-writer"],
    "/credits/transactions": DASHBOARD_TRANSACTIONS,
    "/user/dashboard-layout": { widgets, updatedAt: null },
  };
}

/** Seeds the layout store as if the user's layout had loaded. */
export function seedDashboardLayout(
  widgets: DashboardWidgetState[] = DEFAULT_LAYOUT,
  isHydrated = true,
): void {
  useDashboardLayoutStore.setState({
    widgets,
    saved: widgets,
    isHydrated,
    ownerId: STORY_USER.id,
  });
}
