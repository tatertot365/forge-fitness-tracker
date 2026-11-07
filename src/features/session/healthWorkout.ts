import {
  getFinishedSessionsForHealth,
  getHealthWriteEnabled,
  getSessionForHealth,
  isHealthBackfillOffered,
  markHealthBackfillOffered,
  type SessionForHealth,
} from "../../db/queries";
import { writeStrengthWorkoutToHealth } from "../../health";
import { confirm } from "../../utils/confirm";
import { hapticSuccess } from "../../utils/haptics";

// ─── Apple Health mirror for strength sessions ─────────────────────────
//
// A finished session becomes one strength-training workout. Forge's database
// stays the source of truth; every function here checks the user's switch and
// swallows failures, so callers can fire and forget.

/**
 * The span of work actually done: first completed set to last. Falls back to
 * the Finish tap for sessions from before last_set_at existed, or when every
 * set was checked off at the same instant. Never runs past the Finish tap --
 * a set checked off after finishing doesn't extend the workout. Null if no set
 * was ever done.
 */
function workoutWindow(s: SessionForHealth): { start: Date; end: Date } | null {
  if (!s.started_at || s.sets_completed === 0) return null;
  const start = new Date(s.started_at);
  const ends = [s.last_set_at, s.completed_at]
    .filter((v): v is string => v != null)
    .map((v) => new Date(v).getTime())
    .filter((t) => t > start.getTime());
  if (ends.length === 0) return null;
  return { start, end: new Date(Math.min(...ends)) };
}

async function writeSession(s: SessionForHealth): Promise<void> {
  const window = workoutWindow(s);
  if (!window) return;
  await writeStrengthWorkoutToHealth({
    // Keyed by day + date (unique per session) rather than the row id, which
    // "Erase all data" would recycle onto unrelated sessions.
    syncId: `forge.session.${s.date}.${s.day}`,
    sessionId: s.id,
    name: s.name,
    start: window.start,
    end: window.end,
    setsCompleted: s.sets_completed,
    volumeLb: s.volume_lb,
  });
}

/** Mirrors one just-finished session to Health. */
export async function syncSessionToHealth(sessionId: number): Promise<void> {
  try {
    if (!(await getHealthWriteEnabled("workouts"))) return;
    const s = await getSessionForHealth(sessionId);
    if (s) await writeSession(s);
  } catch {
    /* never block finishing a session on Health */
  }
}

async function writeSessions(sessions: SessionForHealth[]): Promise<void> {
  for (const s of sessions) await writeSession(s);
}

/**
 * Sends sessions finished while saving was switched off. Called on re-enable
 * with the time it was switched off; quiet, because the user already chose to
 * sync when they first turned saving on.
 */
export async function catchUpWorkoutsToHealth(offSince: string): Promise<void> {
  try {
    const since = new Date(offSince).getTime();
    const sessions = (await getFinishedSessionsForHealth()).filter(
      (s) => s.completed_at != null && new Date(s.completed_at).getTime() >= since,
    );
    await writeSessions(sessions);
  } catch {
    /* finishing a session again re-syncs it */
  }
}

/**
 * Asks once, ever, whether to send past sessions. Resolves after the user
 * answers, so it can be chained with the measurements offer without two
 * alerts colliding.
 */
export async function offerWorkoutBackfill(): Promise<void> {
  if (await isHealthBackfillOffered("workouts")) return;
  await markHealthBackfillOffered("workouts");
  const sessions = await getFinishedSessionsForHealth();
  if (sessions.length === 0) return;
  const send = await confirm(
    "Send past workouts?",
    sessions.length === 1
      ? "You have 1 finished session in Forge. Send it to Apple Health too? It's skipped if it overlaps a workout your Apple Watch already recorded."
      : `You have ${sessions.length} finished sessions in Forge. Send them to Apple Health too? Any that overlap a workout your Apple Watch already recorded are skipped.`,
    "Only new ones",
    "Send history",
  );
  if (!send) return;
  try {
    await writeSessions(sessions);
    hapticSuccess();
  } catch {
    /* partial is fine; finishing a session again re-syncs it */
  }
}
