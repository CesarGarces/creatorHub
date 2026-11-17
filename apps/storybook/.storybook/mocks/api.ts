/**
 * Stories never talk to a backend. App components that load data on mount
 * (notifications, chat sessions, credits…) get answers from this table;
 * a story can add or override routes with `parameters.api`:
 *
 *   parameters: { api: { "GET /notifications": { notifications: [...] } } }
 *
 * Keys are "METHOD /path" or "/path" (any method), relative to /api/v1.
 */
export type ApiRoutes = Record<string, unknown>;

export const API_ORIGIN = "http://localhost:3001";

export const DEFAULT_API_ROUTES: ApiRoutes = {
  "/credits/balance": {
    balance: 1500,
    currentCredits: 500,
    purchasedCredits: 1000,
    plan: "STARTER",
  },
  "/notifications": { notifications: [], total: 0, unreadCount: 0 },
  "/notifications/unread-count": { count: 0 },
  "/chat/sessions": [],
  "/chat/settings": {
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    temperature: 0.7,
    maxTokens: 1000,
    reasoning: 0.5,
  },
  "/chat/tools": [],
  "/ai/models": [],
  "/tools": [],
  "/user/favorites": [],
  "/credits/transactions": [],
  "/credits/plans": [],
};

let activeRoutes: ApiRoutes = DEFAULT_API_ROUTES;

/** Routes used by the next requests (set per story by the decorator). */
export function setApiRoutes(routes: ApiRoutes | undefined): void {
  activeRoutes = { ...DEFAULT_API_ROUTES, ...(routes ?? {}) };
}

let installed = false;

/** Wraps `window.fetch` once; other origins are left untouched. */
export function installApiMock(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
      window.location.href,
    );
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/api/v1/")) {
      return realFetch(input, init);
    }
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const body = activeRoutes[`${method} ${path}`] ?? activeRoutes[path] ?? {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
