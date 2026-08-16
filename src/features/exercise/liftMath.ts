// Barbell loading, warmup ramps, and one-rep-max estimation.
//
// Pure functions with no DB or React dependency so they can be exercised
// directly in tests.

/** Standard lb plate pairs, heaviest first. */
export const PLATE_SIZES_LB = [45, 35, 25, 10, 5, 2.5] as const;

export const DEFAULT_BAR_LB = 45;

export type PlateSolution = {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** Weight that could not be made from available plates (0 when exact). */
  remainderLb: number;
};

/**
 * Plates to load on each side to reach `targetLb` with a `barLb` bar.
 *
 * Uses exact fewest-plate search rather than greedy. Greedy is wrong for this
 * plate set: the 35 is not a multiple of the 25 below it, so at 165 lb greedy
 * takes 45+10+5 (three plates) when 35+25 (two) reaches the same weight. Ten
 * targets between 45 and 600 lb are affected. Fewer plates is materially better
 * when you are loading a bar, so the extra work is worth it.
 *
 * Everything is computed in units of 2.5 lb (the smallest plate) so the search
 * runs over integers and cannot accumulate binary-float drift.
 *
 * Returns null when the target cannot hold a bar at all -- the caller shows
 * nothing rather than a misleading empty load.
 */
export function solvePlates(
  targetLb: number,
  barLb: number = DEFAULT_BAR_LB,
): PlateSolution | null {
  if (!Number.isFinite(targetLb) || !Number.isFinite(barLb)) return null;
  if (targetLb < barLb) return null;

  // Per-side load, in whole 2.5 lb units. Anything finer than 2.5 is
  // unloadable and falls straight through to the remainder.
  const UNIT = 2.5;
  const perSideLb = (targetLb - barLb) / 2;
  const units = Math.floor(perSideLb / UNIT + 1e-9);
  const subUnitRemainder = perSideLb - units * UNIT;

  const plateUnits = PLATE_SIZES_LB.map((p) => p / UNIT);

  // best[n] = fewest plates summing to exactly n units, or null if impossible.
  const best: (number[] | null)[] = new Array(units + 1).fill(null);
  best[0] = [];
  for (let n = 1; n <= units; n++) {
    let chosen: number[] | null = null;
    for (let i = 0; i < plateUnits.length; i++) {
      const pu = plateUnits[i];
      if (pu > n) continue;
      const prev = best[n - pu];
      if (prev === null) continue;
      if (chosen === null || prev.length + 1 < chosen.length) {
        chosen = [...prev, PLATE_SIZES_LB[i]];
      }
    }
    best[n] = chosen;
  }

  // Walk down to the heaviest reachable load if the exact target is not
  // loadable (e.g. a 1.25 lb gap with no such plate).
  let reached = units;
  while (reached > 0 && best[reached] === null) reached--;
  const perSide = (best[reached] ?? []).slice().sort((a, b) => b - a);

  const leftoverPerSide = (units - reached) * UNIT + subUnitRemainder;
  const remainderLb = Math.round(leftoverPerSide * 2 * 100) / 100;
  return { perSide, remainderLb: Math.max(0, remainderLb) };
}

/** [{ plate: 45, count: 2 }, ...] for compact display. */
export function groupPlates(perSide: number[]): { plate: number; count: number }[] {
  const out: { plate: number; count: number }[] = [];
  for (const p of perSide) {
    const last = out[out.length - 1];
    if (last && last.plate === p) last.count += 1;
    else out.push({ plate: p, count: 1 });
  }
  return out;
}

/** "45" for whole numbers, "2.5" otherwise -- avoids "45.0". */
export function formatPlate(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// ─── One-rep max ──────────────────────────────────────────────────────

/**
 * Estimated 1RM via Epley: w * (1 + reps/30).
 *
 * Epley is the common choice in lifting apps and is well behaved in the 1-12
 * rep range people actually train in. Accuracy degrades as reps climb, so the
 * estimate is capped at 12 reps rather than extrapolating a number that would
 * read as authoritative while being nonsense.
 */
export function estimateOneRepMax(weightLb: number, reps: number): number | null {
  if (!Number.isFinite(weightLb) || !Number.isFinite(reps)) return null;
  if (weightLb <= 0 || reps <= 0) return null;
  if (reps > 12) return null;
  if (reps === 1) return Math.round(weightLb);
  return Math.round(weightLb * (1 + reps / 30));
}

// ─── Warmup ramp ──────────────────────────────────────────────────────

/**
 * Warmup weights ramping toward `workingWeightLb`.
 *
 * Percentages follow the usual barbell progression (empty-ish bar, then
 * ~55/70/85%). Each is rounded to the nearest 5 lb because that is the
 * smallest increment loadable with a standard plate set on both sides, and a
 * warmup calling for 93.75 lb is not actionable.
 *
 * Results are clamped to at least the bar and never exceed the working weight;
 * duplicates are dropped, so a light working set yields fewer warmup rows
 * rather than three identical ones.
 */
export function warmupRamp(
  workingWeightLb: number,
  count: number,
  barLb: number = DEFAULT_BAR_LB,
): number[] {
  if (!Number.isFinite(workingWeightLb) || workingWeightLb <= 0) return [];
  if (count <= 0) return [];

  const pctByCount: Record<number, number[]> = {
    1: [0.6],
    2: [0.5, 0.75],
    3: [0.4, 0.6, 0.8],
    4: [0.35, 0.55, 0.7, 0.85],
    5: [0.3, 0.45, 0.6, 0.75, 0.875],
  };
  const pcts =
    pctByCount[count] ??
    Array.from({ length: count }, (_, i) => 0.3 + (0.575 * (i + 1)) / count);

  const out: number[] = [];
  for (const pct of pcts) {
    const raw = workingWeightLb * pct;
    let w = Math.round(raw / 5) * 5;
    if (w < barLb) w = barLb;
    if (w > workingWeightLb) w = workingWeightLb;
    // A ramp that repeats a weight adds no information.
    if (out.length > 0 && w === out[out.length - 1]) continue;
    out.push(w);
  }
  return out;
}
