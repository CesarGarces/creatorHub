import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type { Result } from "axe-core";
import { describeViolations, isBlocking } from "../fixtures/a11y";

/**
 * Smoke test of the static Storybook build (apps/storybook/storybook-static):
 * every story renders and its `play` interactions pass, has no blocking
 * accessibility violation (axe via the a11y addon: contrast, missing
 * names/labels, critical — the gate of fixtures/a11y.ts), every docs page
 * renders, props are documented, and the toolbar's viewport, theme and
 * language globals work.
 */

interface IndexEntry {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
}

const STATIC_DIR = path.join(__dirname, "../../storybook/storybook-static");
const entries: IndexEntry[] = Object.values(
  (
    JSON.parse(
      fs.readFileSync(path.join(STATIC_DIR, "index.json"), "utf8"),
    ) as { entries: Record<string, IndexEntry> }
  ).entries,
);

const titles = [...new Set(entries.map((e) => e.title))].sort();

const FAILURE_EVENTS = [
  "storyThrewException",
  "playFunctionThrewException",
  "storyErrored",
  "storyMissing",
  "unhandledErrorsWhilePlaying",
];
const DONE_EVENTS = ["storyFinished", "docsRendered", ...FAILURE_EVENTS];

interface SbEvent {
  event: string;
  payload: unknown;
}

/** Records Storybook's channel events (render finished, errors…). */
async function recordStorybookEvents(page: Page): Promise<void> {
  await page.addInitScript((events: string[]) => {
    const w = window as unknown as {
      __sbEvents: SbEvent[];
      __STORYBOOK_ADDONS_CHANNEL__?: unknown;
    };
    w.__sbEvents = [];
    let channel: unknown;
    Object.defineProperty(w, "__STORYBOOK_ADDONS_CHANNEL__", {
      configurable: true,
      get: () => channel,
      set: (value: { on: (e: string, cb: (p: unknown) => void) => void }) => {
        channel = value;
        for (const event of events) {
          value.on(event, (payload) => {
            let safe: unknown = null;
            try {
              safe = JSON.parse(JSON.stringify(payload ?? null));
            } catch {
              safe = String(payload);
            }
            w.__sbEvents.push({ event, payload: safe });
          });
        }
      },
    });
  }, DONE_EVENTS);
}

/**
 * Waits until the entry is done. For a story, that is its own story-mode
 * `storyFinished` — the one carrying the a11y addon's report — or an error.
 * (A docs page shown just before renders the same story ids inline, without
 * a11y, and can still be reporting them.)
 */
function isStoryModeFinish(e: SbEvent, id: string): boolean {
  const payload = e.payload as {
    storyId?: string;
    reporters?: { type: string }[];
  } | null;
  return (
    e.event === "storyFinished" &&
    payload?.storyId === id &&
    !!payload.reporters?.some((r) => r.type === "a11y")
  );
}

async function waitForStorybook(
  page: Page,
  storyId?: string,
): Promise<SbEvent[]> {
  await page.waitForFunction(
    ({ done, id }: { done: string[]; id?: string }) =>
      (window as unknown as { __sbEvents: SbEvent[] }).__sbEvents.some(
        (e) =>
          done.includes(e.event) &&
          (e.event !== "storyFinished" ||
            !id ||
            // Same test as isStoryModeFinish (this runs in the page).
            ((e.payload as { storyId?: string } | null)?.storyId === id &&
              !!(
                e.payload as { reporters?: { type: string }[] } | null
              )?.reporters?.some((r) => r.type === "a11y"))),
      ),
    { done: DONE_EVENTS, id: storyId },
    { timeout: 20_000 },
  );
  // Let late errors (effects, portals) surface.
  await page.waitForTimeout(150);
  return page.evaluate(
    () => (window as unknown as { __sbEvents: SbEvent[] }).__sbEvents,
  );
}

test.describe("storybook · every story renders", () => {
  for (const title of titles) {
    test(title, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await recordStorybookEvents(page);

      const group = entries.filter((e) => e.title === title);
      for (const [index, entry] of group.entries()) {
        await test.step(`${entry.type}: ${entry.name}`, async () => {
          const viewMode = entry.type === "docs" ? "docs" : "story";
          if (index === 0) {
            await page.goto(`/iframe.html?id=${entry.id}&viewMode=${viewMode}`);
          } else {
            // Like the Storybook UI: switch stories over the channel instead
            // of reloading the whole preview.
            await page.evaluate(
              ({ storyId, mode }) => {
                const w = window as unknown as {
                  __sbEvents: SbEvent[];
                  __STORYBOOK_ADDONS_CHANNEL__: {
                    emit: (event: string, payload: unknown) => void;
                  };
                };
                w.__sbEvents = [];
                w.__STORYBOOK_ADDONS_CHANNEL__.emit("setCurrentStory", {
                  storyId,
                  viewMode: mode,
                });
              },
              { storyId: entry.id, mode: viewMode },
            );
          }
          const events = await waitForStorybook(
            page,
            entry.type === "story" ? entry.id : undefined,
          );
          const failures = events.filter((e) =>
            FAILURE_EVENTS.includes(e.event),
          );
          expect(failures, `${entry.id} failed`).toEqual([]);
          if (entry.type === "story") {
            const finished = events.find((e) => isStoryModeFinish(e, entry.id));
            const payload = finished?.payload as {
              status?: string;
              reporters?: {
                type: string;
                result?: { violations?: Result[]; error?: unknown };
              }[];
            } | null;
            expect(
              payload?.status,
              `${entry.id} (render + play function)`,
            ).toBe("success");
            // The a11y addon's axe run for this story.
            const a11y = payload?.reporters?.find((r) => r.type === "a11y");
            expect(a11y, `${entry.id}: accessibility report`).toBeTruthy();
            expect(a11y!.result?.error, `${entry.id}: axe error`).toBeFalsy();
            const blocking = (a11y!.result?.violations ?? []).filter(
              isBlocking,
            );
            expect(
              blocking,
              `${entry.id}: accessibility violations\n${describeViolations(blocking)}`,
            ).toEqual([]);
            await expect(page.locator("body")).not.toHaveClass(
              /sb-show-errordisplay/,
            );
          } else {
            await expect(page.locator(".sbdocs-content").first()).toBeVisible();
          }
        });
      }
      expect(pageErrors, "uncaught errors in the preview").toEqual([]);
    });
  }
});

test.describe("storybook · documentation", () => {
  test("props are documented with descriptions and controls", async ({
    page,
  }) => {
    await page.goto("/iframe.html?id=ui-actions-button--docs&viewMode=docs");
    const table = page.locator(".docblock-argstable").first();
    await expect(table).toBeVisible();
    for (const text of [
      "variant",
      "Visual style.",
      "size",
      "isLoading",
      "Shows a spinner and disables the button while an action runs.",
    ]) {
      await expect(table).toContainText(text);
    }
    // Interactive controls for the Playground story.
    await expect(
      table.locator("select, input, textarea").first(),
    ).toBeVisible();
  });

  test("guides are published (introduction, tokens, responsive)", async ({
    page,
  }) => {
    for (const [id, heading] of [
      ["introduction--docs", "Creator Hub · UI"],
      ["foundations-design-tokens--docs", "Design tokens"],
      ["foundations-responsive--docs", "Responsive & touch (mobile-first)"],
    ]) {
      await page.goto(`/iframe.html?id=${id}&viewMode=docs`);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    }
  });
});

test.describe("storybook · toolbar globals", () => {
  test.use({ viewport: { width: 1600, height: 1100 } });

  for (const [preset, width, height] of [
    ["mobileSmall", 360, 740],
    ["mobile", 390, 844],
    ["tablet", 768, 1024],
    ["tabletLandscape", 1024, 768],
    ["desktop", 1280, 800],
  ] as const) {
    test(`viewport preset "${preset}" renders the preview at ${width}×${height}`, async ({
      page,
    }) => {
      await page.goto(
        `/?path=/story/ui-actions-button--playground&globals=viewport:${preset}`,
      );
      const preview = page.locator("#storybook-preview-iframe");
      await expect(preview).toBeVisible();
      // The toolbar shows the preset and its exact size…
      await expect(
        page.getByRole("button", { name: new RegExp(`${width}×${height}`) }),
      ).toBeVisible();
      // …and the story's window is that wide (what layouts respond to).
      await expect
        .poll(async () => Math.round((await preview.boundingBox())?.width ?? 0))
        .toBe(width);
      await expect
        .poll(async () =>
          page
            .frames()
            .find((f) => f.url().includes("iframe.html"))
            ?.evaluate(() => window.innerWidth),
        )
        .toBe(width);
    });
  }

  test("stories render in the dark theme by default", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=ui-actions-button--variants&viewMode=story",
    );
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe("rgb(11, 15, 25)");
  });

  test("the language global translates app components", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=web-navigation-sidebar--docked&viewMode=story&globals=locale:es",
    );
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Planificador" })).toBeVisible();
  });

  test("app components show the mobile layout at the mobile viewport", async ({
    page,
  }) => {
    await page.goto(
      "/?path=/story/web-navigation-dashboardlayout-app-shell--mobile&globals=viewport:mobile",
    );
    const frame = page.frameLocator("#storybook-preview-iframe");
    // The drawer opened by the story's play function; the docked sidebar
    // layout is not used at 390px.
    await expect(
      frame.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(
      frame.getByRole("button", { name: "Close menu" }),
    ).toBeVisible();
  });
});
