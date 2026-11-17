/** "83.4" → "01:23", "3725" → "1:02:05". */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Clip and keyframe times, to the tenth when it matters:
 * 12 → "00:12", 12.46 → "00:12.5", 3725.2 → "1:02:05.2".
 */
export function formatClipTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return fraction
    ? `${formatTimestamp(whole)}.${fraction}`
    : formatTimestamp(whole);
}

/** "12.25" → "12.3" (clip lengths and trims are edited in 0.1 s steps). */
export function formatSeconds(seconds: number): string {
  return (Math.round(seconds * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

/** Bytes → "245 MB" / "1.2 GB" (binary units, like file managers). */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
