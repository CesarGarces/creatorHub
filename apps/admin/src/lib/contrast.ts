/**
 * WCAG contrast helpers for colours chosen at runtime (e.g. a mode's
 * colour picked in the admin panel), so text on or in them stays readable.
 */

type Rgb = [number, number, number];

const DARK_INK = "#0b0f19";
const LIGHT_INK = "#ffffff";
/** Card surface the colours usually sit on (--color-surface). */
const SURFACE = "#121826";

function parseHex(hex: string): Rgb | null {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h =
    m[1]!.length === 3
      ? m[1]!
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const toHex = (rgb: Rgb) =>
  "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2 contrast ratio of two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 1;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Dark or white text, whichever reads better on `background`. */
export function readableInk(background: string): string {
  return contrastRatio(DARK_INK, background) >=
    contrastRatio(LIGHT_INK, background)
    ? DARK_INK
    : LIGHT_INK;
}

/**
 * `color` as a text colour on the dark `surface`: lightened just enough
 * (mixed with white) to reach `min` (4.5:1, WCAG AA).
 */
export function readableOnDark(
  color: string,
  surface: string = SURFACE,
  min = 4.5,
): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  for (let t = 0; t <= 1; t += 0.05) {
    const mixed = rgb.map((c) => c + (255 - c) * t) as Rgb;
    const hex = toHex(mixed);
    if (contrastRatio(hex, surface) >= min) return hex;
  }
  return LIGHT_INK;
}
