import type { BrowserContext, Request } from "@playwright/test";

/**
 * Mocks the Creator Hub API for a browser context.
 *
 * The apps call the API on another origin (NEXT_PUBLIC_API_URL, default
 * http://localhost:3001/api/v1). Every `/api/v1/*` request to a different
 * origin than the app is answered here; WebSocket polling is aborted.
 * Handlers receive the path without the `/api/v1` prefix.
 */
export type MockHandler = (req: {
  path: string;
  method: string;
  body: unknown;
  search: URLSearchParams;
}) => unknown;

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

export interface ApiMock {
  requests: RecordedRequest[];
  /** Requests matching method + path. */
  calls: (method: string, path: string) => RecordedRequest[];
}

function parseBody(request: Request): unknown {
  const raw = request.postData();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function mockApi(
  context: BrowserContext,
  routes: Record<string, MockHandler | unknown>,
  appOrigin: string,
): Promise<ApiMock> {
  const requests: RecordedRequest[] = [];
  const appHost = new URL(appOrigin).host;

  await context.route(
    (url) => url.host !== appHost && url.pathname.startsWith("/socket.io"),
    (route) => route.abort(),
  );

  // The apps open a Socket.IO connection to the real API. If a developer has
  // it running locally it would reject the fake token (`auth_error`), clear
  // the session cookies and redirect to the login page mid-test. Mock the
  // Socket.IO handshake so the session stays intact.
  await context.routeWebSocket(
    (url) => url.host !== appHost && url.pathname.startsWith("/socket.io"),
    (ws) => {
      ws.send(
        '0{"sid":"mock","upgrades":[],"pingInterval":25000,"pingTimeout":20000}',
      );
      ws.onMessage((message) => {
        const packet = message.toString();
        if (packet.startsWith("40")) ws.send('40{"sid":"mock"}');
        else if (packet === "2") ws.send("3");
      });
    },
  );

  await context.route(
    (url) => url.host !== appHost && url.pathname.startsWith("/api/v1/"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "access-control-allow-origin": appOrigin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      };
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }

      const path = url.pathname.replace(/^\/api\/v1/, "");
      const body = parseBody(request);
      requests.push({ method: request.method(), path, body });

      const handler =
        routes[`${request.method()} ${path}`] ?? routes[path] ?? {};
      const result =
        typeof handler === "function"
          ? (handler as MockHandler)({
              path,
              method: request.method(),
              body,
              search: url.searchParams,
            })
          : handler;

      await route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify(result ?? {}),
      });
    },
  );

  return {
    requests,
    calls: (method, path) =>
      requests.filter((r) => r.method === method && r.path === path),
  };
}

/** A JWT-shaped token the admin panel can decode (signature not checked client-side). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
}
