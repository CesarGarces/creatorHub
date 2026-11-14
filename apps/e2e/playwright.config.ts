import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the three Next.js apps, run against their
 * production builds (`pnpm build` first — `pnpm e2e` from the repo root does
 * it through Turbo). The backend is mocked per test (see fixtures/), so no
 * API, database or Redis is needed.
 *
 * Browser: Playwright's bundled Chromium (`pnpm --filter @creator-hub/e2e
 * exec playwright install chromium`). Set E2E_CHROMIUM_PATH to use another
 * Chromium binary instead (e.g. offline/air-gapped machines).
 */
export const PORTS = {
  web: Number(process.env.E2E_WEB_PORT ?? 3100),
  landing: Number(process.env.E2E_LANDING_PORT ?? 3102),
  admin: Number(process.env.E2E_ADMIN_PORT ?? 3103),
} as const;

export const URLS = {
  web: `http://localhost:${PORTS.web}`,
  landing: `http://localhost:${PORTS.landing}`,
  admin: `http://localhost:${PORTS.admin}`,
} as const;

const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

const server = (app: keyof typeof PORTS) => ({
  command: `npx next start -p ${PORTS[app]}`,
  cwd: `../${app}`,
  url: URLS[app],
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: { NEXT_TELEMETRY_DISABLED: "1" },
});

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    // A neutral English browser unless a test says otherwise.
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath
      ? {
          executablePath,
          args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        }
      : {},
  },
  projects: [
    {
      name: "web",
      testMatch: /web\..*\.spec\.ts/,
      use: { baseURL: URLS.web },
    },
    {
      name: "landing",
      testMatch: /landing\..*\.spec\.ts/,
      use: { baseURL: URLS.landing },
    },
    {
      name: "admin",
      testMatch: /admin\..*\.spec\.ts/,
      use: { baseURL: URLS.admin },
    },
    {
      // Needs the landing page and the web app at the same time.
      name: "cross-app",
      testMatch: /cross-app\..*\.spec\.ts/,
    },
  ],
  webServer: [server("web"), server("landing"), server("admin")],
});
