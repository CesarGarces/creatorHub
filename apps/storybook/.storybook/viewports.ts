/**
 * Viewport presets for the toolbar (Storybook's built-in viewport addon).
 * They mirror the e2e viewport profiles (apps/e2e/fixtures/responsive.ts)
 * and sit on both sides of the Tailwind breakpoints the apps use:
 * `sm` 640px · `md` 768px · `lg` 1024px (sidebar docked) · `xl` 1280px.
 */
export const VIEWPORTS = {
  mobileSmall: {
    name: "Mobile S · 360×740",
    styles: { width: "360px", height: "740px" },
    type: "mobile",
  },
  mobile: {
    name: "Mobile · 390×844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
  tablet: {
    name: "Tablet · 768×1024",
    styles: { width: "768px", height: "1024px" },
    type: "tablet",
  },
  tabletLandscape: {
    name: "Tablet landscape · 1024×768",
    styles: { width: "1024px", height: "768px" },
    type: "tablet",
  },
  desktop: {
    name: "Desktop · 1280×800",
    styles: { width: "1280px", height: "800px" },
    type: "desktop",
  },
  desktopWide: {
    name: "Desktop wide · 1440×900",
    styles: { width: "1440px", height: "900px" },
    type: "desktop",
  },
} as const;

export type ViewportKey = keyof typeof VIEWPORTS;

/**
 * Story-level helper: open a story at a given viewport,
 * e.g. `globals: viewport("mobile")`.
 */
export function viewport(value: ViewportKey) {
  return { viewport: { value, isRotated: false } };
}
