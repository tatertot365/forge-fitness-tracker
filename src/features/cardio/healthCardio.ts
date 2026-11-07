import {
  addCardioSession,
  getCardioHealthUuids,
  getCardioSession,
  getHealthReadWorkoutsEnabled,
  getHealthWriteEnabled,
  updateCardioSession,
} from "../../db/queries";
import {
  deleteCardioWorkoutFromHealth,
  otherWorkoutsSince,
  writeCardioWorkoutToHealth,
  type HealthCardioWorkout,
} from "../../health";
import { type CardioSession } from "../../types";
import { fromISO, toISO, todayISO, weekDates } from "../../utils/date";
import { activityForHkType, cardioActivity } from "./activities";

// ─── Apple Health mirror for cardio ────────────────────────────────────
//
// Cardio rides on the "Save workouts" switch: each Forge log becomes a Health
// workout of the matching type. Logs added *from* Health (source 'health')
// are never written back -- that workout is already there.

// created_at rather than the row id, which "Erase all data" recycles.
function cardioSyncId(c: CardioSession): string {
  return `forge.cardio.${c.created_at}`;
}

/**
 * When the session happened. Live-timed sessions know their start; a manual
 * log for today is assumed to have just ended; an earlier day's log is placed
 * at noon, since only its date is known.
 */
function windowFor(c: CardioSession): { start: Date; end: Date } | null {
  if (!c.duration_seconds || c.duration_seconds <= 0) return null;
  const ms = c.duration_seconds * 1000;
  if (c.started_at) {
    const start = new Date(c.started_at);
    return { start, end: new Date(start.getTime() + ms) };
  }
  if (c.date === todayISO()) {
    const end = new Date(c.created_at);
    return { start: new Date(end.getTime() - ms), end };
  }
  const start = fromISO(c.date);
  start.setHours(12);
  return { start, end: new Date(start.getTime() + ms) };
}

/** Writes (or rewrites, after an edit) one Forge cardio log. Never throws. */
export async function syncCardioToHealth(id: number): Promise<void> {
  try {
    if (!(await getHealthWriteEnabled("workouts"))) return;
    const c = await getCardioSession(id);
    if (!c || c.source !== "forge") return;
    const window = windowFor(c);
    if (!window) return;
    const activity = cardioActivity(c.activity);
    const { uuid } = await writeCardioWorkoutToHealth({
      syncId: cardioSyncId(c),
      cardioId: c.id,
      hkType: activity.hkType,
      indoor: activity.indoor,
      start: window.start,
      end: window.end,
      distanceMi: c.distance_mi,
    });
    // A rewrite replaces the old workout, which gets a new uuid.
    if (uuid && uuid !== c.health_uuid) {
      await updateCardioSession(c.id, { health_uuid: uuid });
    }
  } catch {
    /* never block a log on Health */
  }
}

/** Call before deleting a log: removes the workout Forge saved for it. */
export async function removeCardioFromHealth(c: CardioSession): Promise<void> {
  if (c.source === "forge") {
    await deleteCardioWorkoutFromHealth(cardioSyncId(c));
  }
}

export type CardioSuggestion = HealthCardioWorkout & { activity: string };

/**
 * Cardio other apps (normally the Apple Watch) recorded this week that isn't
 * in Forge yet. Empty when "Read workouts" is off.
 */
export async function getHealthCardioSuggestions(): Promise<CardioSuggestion[]> {
  try {
    if (!(await getHealthReadWorkoutsEnabled())) return [];
    const since = fromISO(weekDates().monday);
    const [workouts, known] = await Promise.all([
      otherWorkoutsSince(since),
      getCardioHealthUuids(),
    ]);
    const out: CardioSuggestion[] = [];
    for (const w of workouts) {
      const activity = activityForHkType(w.hkType);
      if (activity && !known.has(w.uuid)) out.push({ ...w, activity });
    }
    return out;
  } catch {
    return [];
  }
}

export async function addCardioFromHealth(w: CardioSuggestion): Promise<void> {
  await addCardioSession({
    date: toISO(w.start),
    activity: w.activity,
    duration_seconds: Math.round((w.end.getTime() - w.start.getTime()) / 1000),
    distance_mi: w.distanceMi,
    started_at: w.start.toISOString(),
    source: "health",
    health_uuid: w.uuid,
  });
}
