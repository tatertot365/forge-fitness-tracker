// Date and number helpers shared by the food feature's charts and sheets.

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/** "Mon, Jan 5" — used as a sheet header for a specific day. */
export function formatHeaderDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "1/5" — compact form for chart axis labels. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

/**
 * Parse a required numeric field. Returns null when the field is blank or not
 * a number, so callers can reject it.
 *
 * `Number("")` is 0, which is finite and >= 0 -- so a bare `Number(input)`
 * plus a `>= 0` check silently accepts an empty calorie field and logs a
 * 0-calorie entry. Blank and zero have to stay distinguishable here.
 */
export function parseRequired(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse an optional numeric field, where blank legitimately means zero. */
export function parseOptional(v: string): number | null {
  if (v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Render a portion multiplier for an entry name: "1.5x", not "1.5000000002x".
 * Whole numbers lose the decimal so a doubled item reads "Bagel (2x)".
 */
export function formatMultiplier(m: number): string {
  const rounded = Math.round(m * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
}
