import fs from "node:fs";
import { createRequire } from "node:module";
import { expect, type Page, type TestInfo } from "@playwright/test";
import type { AxeResults, ImpactValue, Result, RunOptions } from "axe-core";

/**
 * Accessibility audits with axe-core, run inside the page under test.
 *
 * Gate (fails the test):
 * - any colour-contrast violation (WCAG 2 AA, 4.5:1 text / 3:1 large text),
 * - any missing accessible name or label (form fields, buttons, links,
 *   images, dialogs, ARIA widgets, the document title…),
 * - any other violation axe rates `critical`.
 *
 * Everything else axe finds (serious/moderate/minor best practices) is
 * attached to the report as `a11y-findings` for follow-up.
 */

const localRequire = createRequire(__filename);
const AXE_SOURCE = fs.readFileSync(
  localRequire.resolve("axe-core/axe.min.js"),
  "utf8",
);

/** Contrast rules (WCAG 1.4.3, plus links only told apart by colour). */
export const CONTRAST_RULES = ["color-contrast", "link-in-text-block"];

/** Accessible name / label rules (WCAG 1.1.1, 2.4.2, 4.1.2, 3.3.2). */
export const NAME_RULES = [
  "area-alt",
  "aria-command-name",
  "aria-dialog-name",
  "aria-input-field-name",
  "aria-meter-name",
  "aria-progressbar-name",
  "aria-toggle-field-name",
  "aria-tooltip-name",
  "aria-treeitem-name",
  "button-name",
  "document-title",
  "frame-title",
  "image-alt",
  "input-button-name",
  "input-image-alt",
  "label",
  "link-name",
  "object-alt",
  "role-img-alt",
  "select-name",
  "summary-name",
  "svg-img-alt",
];

const GATED = new Set([...CONTRAST_RULES, ...NAME_RULES]);

/** What axe runs: WCAG 2.0–2.2 A/AA plus best practices (as Storybook). */
export const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

/** A violation that fails the gate: contrast, missing name, or critical. */
export const isBlocking = (r: Pick<Result, "id" | "impact">): boolean =>
  GATED.has(r.id) || r.impact === ("critical" satisfies ImpactValue);

export interface AuditOptions {
  /** CSS selectors left out of the audit (third-party widgets…). */
  exclude?: string[];
}

export interface Audit {
  /** Violations that fail the gate. */
  blocking: Result[];
  /** Everything else axe reported, for the report. */
  other: Result[];
  /** Contrast checks axe could not decide (text over images, gradients). */
  incompleteContrast: number;
}

/** Runs axe (WCAG 2.0–2.2 A/AA + best practices) on the current page. */
export async function audit(
  page: Page,
  options: AuditOptions = {},
): Promise<Audit> {
  // Let entrance animations finish: mid-fade text has a lower contrast.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  await page.waitForTimeout(100);

  const hasAxe = await page.evaluate(() => "axe" in window);
  if (!hasAxe) await page.evaluate(AXE_SOURCE);

  const runOptions: RunOptions = {
    runOnly: { type: "tag", values: AXE_TAGS },
    resultTypes: ["violations", "incomplete"],
  };
  const results = await page.evaluate(
    ([exclude, opts]) => {
      const w = window as unknown as {
        axe: { run: (ctx: unknown, o: unknown) => Promise<AxeResults> };
      };
      const context = exclude.length
        ? { include: [["html"]], exclude: exclude.map((s) => [s]) }
        : document;
      return w.axe.run(context, opts);
    },
    [options.exclude ?? [], runOptions] as const,
  );

  return {
    blocking: results.violations.filter(isBlocking),
    other: results.violations.filter((r) => !isBlocking(r)),
    incompleteContrast:
      results.incomplete.find((r) => r.id === "color-contrast")?.nodes.length ??
      0,
  };
}

/** One line per failing element, readable in the test output. */
export function describeViolations(violations: Result[]): string {
  return violations
    .flatMap((v) =>
      v.nodes.map((n) => {
        const detail = n.any[0]?.message ?? n.failureSummary ?? "";
        const html = n.html.replace(/\s+/g, " ").slice(0, 160);
        return `[${v.impact}] ${v.id}: ${n.target.join(" ")} — ${detail}\n    ${html}`;
      }),
    )
    .join("\n");
}

/**
 * Audits the page and fails on contrast / missing-label / critical
 * violations. `label` names the screen in the report.
 */
export async function expectAccessible(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options?: AuditOptions,
): Promise<void> {
  const result = await audit(page, options);
  const findings = {
    screen: label,
    url: page.url(),
    blocking: result.blocking.map(summary),
    other: result.other.map(summary),
    incompleteContrast: result.incompleteContrast,
  };
  await testInfo.attach(`a11y · ${label}`, {
    body: JSON.stringify(findings, null, 2),
    contentType: "application/json",
  });
  expect(
    result.blocking,
    `${label}: accessibility violations\n${describeViolations(result.blocking)}`,
  ).toEqual([]);
}

const summary = (v: Result) => ({
  id: v.id,
  impact: v.impact,
  help: v.help,
  targets: v.nodes.map((n) => n.target.join(" ")),
});
