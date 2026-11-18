import { expect, type BrowserContext, type Page } from "@playwright/test";

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

export const WEB_USER = {
  id: "u1",
  email: "ana@example.com",
  role: "USER",
  name: "Ana",
  emailVerified: new Date().toISOString(),
};

/** API responses needed by the signed-in web app (dashboard, settings, credits). */
export const webApiRoutes: Record<string, unknown> = {
  "/credits/balance": {
    balance: 1500,
    currentCredits: 500,
    purchasedCredits: 1000,
    plan: "STARTER",
  },
  "/tools": [
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
      id: "video-clipper",
      name: "AI Video Analyzer & Smart Clipper",
      description:
        "Find highlights, hooks and titles with AI and export short clips from your browser",
      icon: "🎬",
      category: "video",
      creditsPerUse: 0,
      status: "active",
    },
    {
      id: "voice-assistant",
      name: "Robotina — AI Voice Assistant",
      description:
        "Talk with Robotina about any topic with fluid, real-time voice: she answers out loud in your language",
      icon: "🤖",
      category: "assistant",
      creditsPerUse: 1,
      status: "active",
    },
  ],
  "/user/favorites": [],
  "/credits/transactions": [
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
      amount: 100,
      type: "BONUS",
      description: "Signup bonus",
      createdAt: hoursAgo(72),
    },
  ],
  "/notifications": { notifications: [], total: 0, unreadCount: 0 },
  "/notifications/unread-count": { count: 0 },
  "/social/accounts": { data: [] },
  "/chat/sessions": [],
  "/chat/settings": {
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    temperature: 0.7,
    maxTokens: 1000,
    reasoning: 0.5,
  },
  "/chat/tools": [],
  "/ai/models": [],
  "/credits/plans": [
    {
      id: "plan_payg",
      slug: "PAY_AS_YOU_GO",
      name: "Pay as you go",
      description: "Buy credits anytime, no commitment",
      usdAmount: 10,
      creditsGiven: 1000,
    },
    {
      id: "plan_starter",
      slug: "STARTER",
      name: "Starter",
      description: "Best value for getting started",
      usdAmount: 25,
      creditsGiven: 2700,
    },
    {
      id: "plan_pro",
      slug: "PRO",
      name: "Pro",
      description: "Maximum credits for power users",
      usdAmount: 50,
      creditsGiven: 6000,
    },
  ],
  "PATCH /auth/preferences": ({ body }: { body: unknown }) => body,
};

/** Starts the context already signed in (token cookie + stored user), cookie banner dismissed. */
export async function signInWeb(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "ch_access_token", value: "e2e-access-token", url: baseURL },
  ]);
  await context.addInitScript((user) => {
    sessionStorage.setItem("ch_user", JSON.stringify(user));
    localStorage.setItem("creator_hub_cookie_consent", "granted");
  }, WEB_USER);
}

/** Hides the cookie banner (for screens that are not about it). */
export async function dismissCookieBanner(context: BrowserContext) {
  await context.addInitScript(() =>
    localStorage.setItem("creator_hub_cookie_consent", "granted"),
  );
}

/**
 * Opens the assistant from its floating launcher. The launcher tucks into an
 * edge tab after 5 s idle or on scroll; a touch on the tab first expands it
 * (a second tap opens the chat), a mouse click opens it directly.
 */
export async function openChat(page: Page, input: "tap" | "click" = "click") {
  const launcher = page.getByRole("button", { name: "Open chat" });
  const dialog = page.getByRole("dialog", { name: "Chat" });
  await expect(async () => {
    if (await dialog.isVisible()) return;
    await launcher[input]({ timeout: 2_000 });
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
