/**
 * Origins allowed to call the API and open its WebSocket.
 *
 * `FRONTEND_URL` and `ADMIN_URL` are the configured apps; the production web
 * origin is always allowed so a missing/typoed env var can't take login down.
 * Extra previews or custom domains go in `ALLOWED_ORIGINS` (comma-separated).
 */
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://localhost:3003",
  "http://127.0.0.1:3003",
];

function normalize(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

export const CORS_ALLOWED_ORIGINS: readonly string[] = [
  ...new Set([
    "https://app.creatorhubplatform.com",
    normalize(process.env.FRONTEND_URL) || "http://localhost:3000",
    normalize(process.env.ADMIN_URL) || "http://localhost:3003",
    ...(process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(normalize)
      .filter(Boolean),
    ...DEV_ORIGINS,
  ]),
];

/** A missing Origin is not a browser cross-origin request. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || CORS_ALLOWED_ORIGINS.includes(origin);
}
