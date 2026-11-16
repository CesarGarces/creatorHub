import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Viewport profiles for the responsive specs. Chromium only (the project's
 * browser), emulating touch devices: `isMobile` enables the meta viewport
 * and touch events, `hasTouch` makes `tap()` available.
 */
export const VIEWPORTS = {
  /** Small Android phone (Galaxy S8/S9 class). */
  phoneSmall: {
    label: "small phone 360×740",
    use: {
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    },
  },
  /** iPhone 12–15 class. */
  phone: {
    label: "phone 390×844",
    use: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
  },
  /** iPad mini, portrait. Below `lg`, so it uses the drawer navigation. */
  tablet: {
    label: "tablet 768×1024",
    use: {
      viewport: { width: 768, height: 1024 },
      isMobile: true,
      hasTouch: true,
    },
  },
  /** iPad, landscape. From `lg` the sidebar is docked again. */
  tabletLandscape: {
    label: "tablet landscape 1024×768",
    use: {
      viewport: { width: 1024, height: 768 },
      isMobile: true,
      hasTouch: true,
    },
  },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/** Architecture §2b: interactive items are at least 44px. */
export const MIN_TOUCH_TARGET = 44;

/**
 * Nothing on the page scrolls sideways: neither the document nor any
 * element that scrolls vertically (the app shell scrolls inside `<main>`).
 * Opt-in horizontal scrollers (e.g. the week grid, wide tables) are marked
 * with `data-scroll-x` and skipped.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  // Let fonts, images and entrance animations settle first.
  await page.waitForTimeout(250);
  const offenders = await page.evaluate(() => {
    const tolerance = 1;
    const found: string[] = [];
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const testId = el.getAttribute("data-testid");
      const cls =
        typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${id}${testId ? `[data-testid=${testId}]` : ""}${cls}`;
    };
    const root = document.scrollingElement ?? document.documentElement;
    if (root.scrollWidth > root.clientWidth + tolerance) {
      found.push(`document (${root.scrollWidth} > ${root.clientWidth})`);
    }
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (el.closest("[data-scroll-x]")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const scrollsX =
        style.overflowX === "auto" || style.overflowX === "scroll";
      if (!scrollsX) continue;
      // Chip rows and carousels scroll sideways on purpose.
      if (style.overflowY === "hidden" || style.overflowY === "visible")
        continue;
      if (el.scrollWidth > el.clientWidth + tolerance) {
        found.push(`${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    return found;
  });
  expect(offenders, "elements that scroll horizontally").toEqual([]);
}

/**
 * Geometry checks retry until they hold (≤5s), so entrance animations —
 * drawers sliding in, dialogs scaling up — settle before they are judged.
 */
const SETTLE = { timeout: 5_000 };

/** The element is fully inside the viewport horizontally (not clipped). */
export async function expectInsideViewportX(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const width = locator.page().viewportSize()!.width;
  await expect(async () => {
    const box = await locator.boundingBox();
    expect(box, "element has a box").not.toBeNull();
    expect(box!.x, "left edge inside the viewport").toBeGreaterThanOrEqual(-1);
    expect(
      box!.x + box!.width,
      "right edge inside the viewport",
    ).toBeLessThanOrEqual(width + 1);
  }).toPass(SETTLE);
}

/** The element is fully inside the visible viewport (both axes). */
export async function expectInsideViewport(locator: Locator): Promise<void> {
  await expectInsideViewportX(locator);
  const height = locator.page().viewportSize()!.height;
  await expect(async () => {
    const box = (await locator.boundingBox())!;
    expect(box.y, "top edge inside the viewport").toBeGreaterThanOrEqual(-1);
    expect(
      box.y + box.height,
      "bottom edge inside the viewport",
    ).toBeLessThanOrEqual(height + 1);
  }).toPass(SETTLE);
}

/** Big enough to tap comfortably. */
export async function expectTouchTarget(
  locator: Locator,
  min = MIN_TOUCH_TARGET,
): Promise<void> {
  await expect(locator).toBeVisible();
  await expect(async () => {
    const box = (await locator.boundingBox())!;
    expect(Math.round(box.width), "touch target width").toBeGreaterThanOrEqual(
      min,
    );
    expect(
      Math.round(box.height),
      "touch target height",
    ).toBeGreaterThanOrEqual(min);
  }).toPass(SETTLE);
}

/**
 * The on-screen keyboard: Chromium on Android (and every browser honouring
 * `interactive-widget=resizes-content`) shrinks the viewport when it opens.
 * Emulated by resizing the page; returns a function that closes it again.
 */
export async function openVirtualKeyboard(
  page: Page,
  keyboardHeight = 320,
): Promise<() => Promise<void>> {
  const original = page.viewportSize()!;
  await page.setViewportSize({
    width: original.width,
    height: original.height - keyboardHeight,
  });
  return async () => {
    await page.setViewportSize(original);
  };
}

/** The element's computed `font-size` in px (iOS zooms inputs under 16px). */
export async function fontSizeOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

/**
 * Screenshot of the current screen, attached to the HTML report and saved as
 * artifacts/responsive/<project>/<name>.png for visual review.
 */
export async function snap(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  // Let entrance animations (drawer, dialogs, toasts) settle.
  await page.waitForTimeout(350);
  const shot = await page.screenshot();
  await testInfo.attach(name, { body: shot, contentType: "image/png" });
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dir = path.join(
    __dirname,
    "..",
    "artifacts",
    "responsive",
    testInfo.project.name,
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.png`), shot);
}

/** Two boxes overlap (e.g. a floating button covering a control). */
export async function overlaps(a: Locator, b: Locator): Promise<boolean> {
  const [ba, bb] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!ba || !bb) return false;
  return !(
    ba.x + ba.width <= bb.x ||
    bb.x + bb.width <= ba.x ||
    ba.y + ba.height <= bb.y ||
    bb.y + bb.height <= ba.y
  );
}
