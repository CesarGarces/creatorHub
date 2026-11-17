import fs from "node:fs";
import path from "node:path";
import {
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

/**
 * Lab performance telemetry, collected in the page with the browser's own
 * PerformanceObserver APIs (the same entries the `web-vitals` library and
 * Chrome UX Report use) against the production builds.
 *
 * - CLS: largest session window of layout shifts without recent input
 *   (gap < 1 s, window < 5 s), as defined by web.dev/cls.
 * - FCP / LCP: paint and largest-contentful-paint entries.
 * - Blocking: long tasks (> 50 ms) on the main thread; TBT = Σ(duration − 50)
 *   after FCP, as Lighthouse defines it.
 */

/** Budgets: Core Web Vitals "good" thresholds. */
export const BUDGETS = {
  cls: 0.1,
  /** First Contentful Paint, ms. */
  fcp: 1800,
  /** Largest Contentful Paint, ms (gated on desktop, reported on phones). */
  lcp: 2500,
  /** Total Blocking Time, ms (reported: noisy on a shared CI machine). */
  tbt: 200,
  /** Interaction to Next Paint, ms ("good"). */
  inp: 200,
  /** INP "poor" threshold: the hard limit on the 4×-throttled phone. */
  inpPoor: 500,
} as const;

export interface Vitals {
  cls: number;
  /** Every layout shift counted in CLS, with the elements that moved. */
  shifts: { value: number; time: number; sources: string[] }[];
  fcp: number | null;
  lcp: number | null;
  /** Long tasks (ms) after FCP. */
  longTasks: number[];
  tbt: number;
  /** Time until the page's main content was visible (ms since navigation). */
  contentVisible: number | null;
  /**
   * What the apps' own field reporter (WebVitalsReporter → `web-vitals`)
   * reported for this page view, by metric name.
   */
  field: Record<string, number>;
}

declare global {
  interface Window {
    __fieldVitals?: Record<string, number>;
    __events?: { name: string; duration: number; interactionId: number }[];
    __vitals?: {
      shifts: { value: number; time: number; sources: string[] }[];
      fcp: number | null;
      lcp: number | null;
      longTasks: { start: number; duration: number }[];
    };
  }
}

/** Installs the observers before any page script runs. */
export async function observeVitals(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const store: NonNullable<Window["__vitals"]> = {
      shifts: [],
      fcp: null,
      lcp: null,
      longTasks: [],
    };
    window.__vitals = store;
    // The production reporter's events (apps' WebVitalsReporter).
    window.__fieldVitals = {};
    window.addEventListener("creatorhub:web-vital", (e) => {
      const { name, value } = (
        e as CustomEvent<{ name: string; value: number }>
      ).detail;
      window.__fieldVitals![name] = value;
    });
    const one = (el: Element): string => {
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    // The element plus its nearest ancestor with an id/class, for context.
    const describe = (node: Node | null | undefined): string => {
      if (!node || !(node instanceof Element)) return "#text";
      let label = one(node);
      let parent = node.parentElement;
      while (parent && !parent.id && !parent.className) {
        parent = parent.parentElement;
      }
      if (label === node.tagName.toLowerCase() && parent) {
        label = `${one(parent)} > … > ${label}`;
      }
      return label;
    };
    const observe = (type: string, cb: (e: PerformanceEntry) => void) => {
      try {
        new PerformanceObserver((list) =>
          list.getEntries().forEach(cb),
        ).observe({ type, buffered: true });
      } catch {
        /* entry type not supported */
      }
    };
    observe("layout-shift", (e) => {
      const shift = e as PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node }[];
      };
      if (shift.hadRecentInput) return;
      store.shifts.push({
        value: shift.value,
        time: shift.startTime,
        sources: (shift.sources ?? []).map((s) => describe(s.node)),
      });
    });
    observe("paint", (e) => {
      if (e.name === "first-contentful-paint") store.fcp = e.startTime;
    });
    observe("largest-contentful-paint", (e) => {
      store.lcp = e.startTime;
    });
    observe("longtask", (e) => {
      store.longTasks.push({ start: e.startTime, duration: e.duration });
    });
    // Event timing (INP): input → next paint of every interaction.
    window.__events = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & {
          interactionId?: number;
        })[]) {
          if (e.interactionId) {
            window.__events!.push({
              name: e.name,
              duration: e.duration,
              interactionId: e.interactionId,
            });
          }
        }
      }).observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    } catch {
      /* event timing not supported */
    }
  });
}

/** Largest session window (web.dev/cls). */
function sessionCls(shifts: { value: number; time: number }[]): number {
  let max = 0;
  let current = 0;
  let first = 0;
  let last = 0;
  for (const s of [...shifts].sort((a, b) => a.time - b.time)) {
    if (current && s.time - last < 1000 && s.time - first < 5000) {
      current += s.value;
    } else {
      current = s.value;
      first = s.time;
    }
    last = s.time;
    max = Math.max(max, current);
  }
  return max;
}

/**
 * Reads the metrics. Call after the page's content is visible; `settleMs`
 * keeps observing so late shifts (data, fonts, images) are counted.
 */
export async function readVitals(
  page: Page,
  contentVisible: number | null,
  settleMs = 1500,
): Promise<Vitals> {
  await page.waitForTimeout(settleMs);
  // LCP is final once the user interacts or the page is hidden; reading it
  // after the settle time is what lab tools do. Hiding the page also makes
  // the field reporter flush CLS and LCP, as when a real user leaves.
  const raw = await page.evaluate(() => window.__vitals!);
  const field = await page.evaluate(async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 50));
    delete (document as unknown as { visibilityState?: unknown })
      .visibilityState;
    return window.__fieldVitals ?? {};
  });
  const fcp = raw.fcp;
  const longTasks = raw.longTasks
    .filter((t) => fcp === null || t.start + t.duration > fcp)
    .map((t) => Math.round(t.duration));
  return {
    cls: Number(sessionCls(raw.shifts).toFixed(4)),
    shifts: raw.shifts,
    fcp: fcp === null ? null : Math.round(fcp),
    lcp: raw.lcp === null ? null : Math.round(raw.lcp),
    longTasks,
    tbt: longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
    contentVisible,
    field,
  };
}

/** Milliseconds since navigation start, in the page. */
export const pageNow = (page: Page) =>
  page.evaluate(() => Math.round(performance.now()));

/**
 * Mid-range phone conditions (Lighthouse's mobile profile): 4× slower CPU
 * and a fast 4G network.
 */
export async function throttleLikeAPhone(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

/** Appends one row to the telemetry report (artifacts/perf/<project>.json). */
export function recordVitals(
  testInfo: TestInfo,
  row: { screen: string; path: string } & Vitals,
): void {
  const dir = path.join(__dirname, "..", "artifacts", "perf");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${testInfo.project.name}-web-vitals.jsonl`);
  const { shifts, ...summary } = row;
  fs.appendFileSync(
    file,
    JSON.stringify({
      ...summary,
      shiftCount: shifts.length,
      at: new Date().toISOString(),
    }) + "\n",
  );
}

/**
 * Fails when a page misses a gated budget (CLS, FCP, desktop LCP); the
 * message says why. TBT — and LCP on the throttled phone — are recorded and
 * flagged in the report as warnings (annotations), not gated.
 */
export function expectWithinBudgets(
  vitals: Vitals,
  label: string,
  testInfo: TestInfo,
  { gateLcp }: { gateLcp: boolean },
): void {
  expect(
    vitals.cls,
    `${label}: CLS; shifts:\n${JSON.stringify(vitals.shifts, null, 1)}`,
  ).toBeLessThan(BUDGETS.cls);
  expect(vitals.fcp, `${label}: first contentful paint`).not.toBeNull();
  expect(vitals.fcp!, `${label}: FCP (ms)`).toBeLessThan(BUDGETS.fcp);
  const lcp = vitals.lcp ?? vitals.fcp!;
  if (gateLcp) {
    expect(lcp, `${label}: LCP (ms)`).toBeLessThan(BUDGETS.lcp);
  } else if (lcp >= BUDGETS.lcp) {
    testInfo.annotations.push({
      type: "warning",
      description: `${label}: LCP ${lcp} ms (budget ${BUDGETS.lcp} ms)`,
    });
  }
  if (vitals.tbt >= BUDGETS.tbt) {
    testInfo.annotations.push({
      type: "warning",
      description: `${label}: TBT ${vitals.tbt} ms — long tasks ${vitals.longTasks.join(", ")} ms`,
    });
  }
  // The apps' own field reporter agrees (what production would log).
  expect(vitals.field.CLS, `${label}: field CLS reported`).toBeDefined();
  expect(vitals.field.CLS!, `${label}: field CLS`).toBeLessThan(BUDGETS.cls);
  expect(vitals.field.FCP, `${label}: field FCP reported`).toBeDefined();
}

/** Records, attaches and checks one page view. */
export async function reportAndCheck(
  testInfo: TestInfo,
  screen: string,
  path: string,
  vitals: Vitals,
  options: { gateLcp: boolean },
): Promise<void> {
  recordVitals(testInfo, { screen, path, ...vitals });
  await testInfo.attach(`web vitals · ${screen} ${path}`, {
    body: JSON.stringify(vitals, null, 2),
    contentType: "application/json",
  });
  expectWithinBudgets(vitals, `${screen} ${path}`, testInfo, options);
}

/**
 * Interaction to Next Paint of the interactions run so far: the slowest
 * interaction (input delay + handlers + rendering until the next frame),
 * as INP reports it for pages with few interactions.
 */
export async function readInp(page: Page): Promise<{
  inp: number;
  interactions: { name: string; duration: number }[];
}> {
  // Event timing entries are delivered after the next paint.
  await page.waitForTimeout(300);
  const events = await page.evaluate(() => window.__events ?? []);
  const byInteraction = new Map<number, { name: string; duration: number }>();
  for (const e of events) {
    const prev = byInteraction.get(e.interactionId);
    if (!prev || e.duration > prev.duration) {
      byInteraction.set(e.interactionId, {
        name: e.name,
        duration: Math.round(e.duration),
      });
    }
  }
  const interactions = [...byInteraction.values()];
  return {
    inp: Math.max(0, ...interactions.map((i) => i.duration)),
    interactions,
  };
}

/**
 * Regenerates artifacts/perf/<project>-web-vitals.md from the JSONL history
 * (which keeps every run): the latest measurement of each page and of each
 * interaction test, budgets and warnings marked.
 */
export function writeVitalsReport(project: string): void {
  const dir = path.join(__dirname, "..", "artifacts", "perf");
  const read = <T>(name: string): T[] => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  };
  const latest = <T>(rows: T[], key: (r: T) => string): T[] => [
    ...new Map(rows.map((r) => [key(r), r])).values(),
  ];

  type Row = Omit<Vitals, "shifts"> & { screen: string; path: string };
  type InpRow = { test: string; throttled: boolean; inp: number };
  const rows = latest(
    read<Row>(`${project}-web-vitals.jsonl`),
    (r) => `${r.screen} ${r.path}`,
  );
  const inp = latest(read<InpRow>(`${project}-inp.jsonl`), (r) => r.test);
  if (rows.length === 0) return;

  const mark = (ok: boolean) => (ok ? "✅" : "⚠️");
  const lines = [
    `# ${project} · Web Vitals (lab, production build)`,
    "",
    `Budgets: CLS < ${BUDGETS.cls} · FCP < ${BUDGETS.fcp} ms · LCP < ${BUDGETS.lcp} ms · TBT < ${BUDGETS.tbt} ms · INP < ${BUDGETS.inp} ms.`,
    "Phone = 390×844, 4× slower CPU, 4G (150 ms RTT, 1.6 Mbps); desktop = 1280×800, no throttling.",
    "Gated: CLS and FCP everywhere, LCP and INP on desktop, INP < 500 ms on the phone. ⚠️ = reported only.",
    "",
    "| Screen | Page | CLS | FCP (ms) | LCP (ms) | TBT (ms) | Field CLS | Field LCP |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => {
      const lcp = r.lcp ?? r.fcp ?? 0;
      return `| ${r.screen} | \`${r.path}\` | ${mark(r.cls < BUDGETS.cls)} ${r.cls} | ${mark((r.fcp ?? 9e9) < BUDGETS.fcp)} ${r.fcp} | ${mark(lcp < BUDGETS.lcp)} ${lcp} | ${mark(r.tbt < BUDGETS.tbt)} ${r.tbt} | ${r.field.CLS?.toFixed(4) ?? "—"} | ${r.field.LCP !== undefined ? Math.round(r.field.LCP) : "—"} |`;
    }),
    "",
    "## Interaction to Next Paint",
    "",
    "| Interactions | Profile | INP (ms) |",
    "| --- | --- | --- |",
    ...inp.map(
      (r) =>
        `| ${r.test} | ${r.throttled ? "phone (4× CPU)" : "desktop"} | ${mark(r.inp < BUDGETS.inp)} ${r.inp} |`,
    ),
    "",
  ];
  fs.writeFileSync(
    path.join(dir, `${project}-web-vitals.md`),
    lines.join("\n"),
  );
}

/**
 * Checks the INP of the interactions run so far: under 200 ms ("good") on
 * an unthrottled CPU; on the 4×-throttled phone never "poor" (500 ms), and
 * flagged as a warning above 200 ms.
 */
export async function expectResponsive(
  page: Page,
  testInfo: TestInfo,
  { throttled }: { throttled: boolean },
): Promise<void> {
  const { inp, interactions } = await readInp(page);
  await testInfo.attach("interactions", {
    body: JSON.stringify({ inp, interactions }, null, 2),
    contentType: "application/json",
  });
  const dir = path.join(__dirname, "..", "artifacts", "perf");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(
    path.join(dir, `${testInfo.project.name}-inp.jsonl`),
    JSON.stringify({
      test: testInfo.title,
      throttled,
      inp,
      interactions: interactions.length,
      at: new Date().toISOString(),
    }) + "\n",
  );
  expect(interactions.length, "interactions measured").toBeGreaterThan(3);
  const detail = `INP (slowest interaction); all: ${JSON.stringify(interactions)}`;
  if (throttled) {
    expect(inp, detail).toBeLessThan(BUDGETS.inpPoor);
    if (inp >= BUDGETS.inp) {
      testInfo.annotations.push({
        type: "warning",
        description: `INP ${inp} ms on the 4×-throttled phone (good < ${BUDGETS.inp} ms)`,
      });
    }
  } else {
    expect(inp, detail).toBeLessThan(BUDGETS.inp);
  }
}
