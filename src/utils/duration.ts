// Set durations for timed exercises (planks, hangs, carries). Stored as whole
// seconds; shown as "45s" under a minute and "1:15" from a minute up, which is
// how people say hold times out loud.

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Reads what a user types into a time field: "75", "75s", "1:15" or "1m15s".
 * Null for blank or unreadable input, so a half-typed value never saves as 0.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const colon = t.match(/^(\d+):([0-5]?\d)$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const ms = t.match(/^(?:(\d+)m)?\s*(?:(\d+)s?)?$/);
  if (ms && (ms[1] || ms[2])) return Number(ms[1] ?? 0) * 60 + Number(ms[2] ?? 0);
  return null;
}
