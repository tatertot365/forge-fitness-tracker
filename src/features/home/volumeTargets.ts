import { type MuscleGroup } from "../../types";

/**
 * Weekly working-set targets per muscle group.
 *
 * The commonly cited hypertrophy range is ~10-20 working sets per muscle per
 * week. That figure describes major muscles trained directly; applying it flat
 * across all 13 groups here would be wrong in both directions -- it would call
 * 12 sets of grip work "on target" and treat 8 sets of calves as a shortfall.
 *
 * So the ranges below are scaled by how much direct work a group actually
 * needs. Arms, calves and traps get lower floors because they also accumulate
 * indirect volume from pressing and pulling. Back is split into two entries in
 * this app, so each carries roughly half of what a combined "back" target
 * would.
 *
 * These are orientation, not prescription -- the card shows where you are
 * relative to a reasonable band, not a rule you are failing.
 */
export type VolumeTarget = { min: number; max: number };

const TARGETS: Record<MuscleGroup, VolumeTarget> = {
  chest: { min: 10, max: 20 },
  shoulders: { min: 10, max: 20 },
  quads: { min: 10, max: 20 },
  hamstrings: { min: 8, max: 16 },
  glutes: { min: 8, max: 16 },
  "back-width": { min: 8, max: 16 },
  "back-thickness": { min: 8, max: 16 },
  biceps: { min: 6, max: 14 },
  triceps: { min: 6, max: 14 },
  calves: { min: 6, max: 14 },
  core: { min: 6, max: 14 },
  traps: { min: 4, max: 12 },
  grip: { min: 2, max: 8 },
};

export function volumeTarget(group: MuscleGroup): VolumeTarget {
  return TARGETS[group] ?? { min: 8, max: 16 };
}

export type VolumeStatus = "under" | "in-range" | "over";

export function volumeStatus(
  sets: number,
  target: VolumeTarget,
): VolumeStatus {
  if (sets < target.min) return "under";
  if (sets > target.max) return "over";
  return "in-range";
}
