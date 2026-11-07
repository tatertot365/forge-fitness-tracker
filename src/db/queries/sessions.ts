import { getDb } from '../client';
import type {
  Day,
  Session,
} from '../../types';
import { DAYS } from '../../types';
import { weekDates } from '../../utils/date';

// ─── Sessions ─────────────────────────────────────────────────────────

export async function getOrCreateSession(day: Day, date: string): Promise<number> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM sessions WHERE day = ? AND date = ?',
    [day, date],
  );
  if (existing) return existing.id;
  const result = await db.runAsync(
    'INSERT INTO sessions (day, date) VALUES (?, ?)',
    [day, date],
  );
  return result.lastInsertRowId as number;
}

/** What Apple Health needs to know about one finished session. */
export type SessionForHealth = {
  id: number;
  day: Day;
  date: string;
  /** The day plan's name, e.g. "Pull — heavy". Empty when unnamed. */
  name: string;
  started_at: string | null;
  last_set_at: string | null;
  completed_at: string | null;
  sets_completed: number;
  /** Same rule as the summary screen: completed sets with weight and reps. */
  volume_lb: number;
};

const SESSION_FOR_HEALTH_SQL = `
  SELECT s.id, s.day, s.date, COALESCE(dp.name, '') AS name,
         s.started_at, s.last_set_at, s.completed_at,
         COALESCE(SUM(sl.completed), 0) AS sets_completed,
         COALESCE(SUM(CASE WHEN sl.completed = 1 AND sl.weight_lb > 0 AND sl.reps > 0
                           THEN sl.weight_lb * sl.reps ELSE 0 END), 0) AS volume_lb
    FROM sessions s
    LEFT JOIN day_plans dp ON dp.day = s.day
    LEFT JOIN set_logs sl ON sl.session_id = s.id`;

export async function getSessionForHealth(id: number): Promise<SessionForHealth | null> {
  const db = await getDb();
  return (await db.getFirstAsync<SessionForHealth>(
    `${SESSION_FOR_HEALTH_SQL} WHERE s.id = ? GROUP BY s.id`,
    [id],
  )) ?? null;
}

/** Every finished session in which at least one set was actually done. */
export async function getFinishedSessionsForHealth(): Promise<SessionForHealth[]> {
  const db = await getDb();
  return db.getAllAsync<SessionForHealth>(
    `${SESSION_FOR_HEALTH_SQL}
     WHERE s.completed_at IS NOT NULL AND s.started_at IS NOT NULL
     GROUP BY s.id
     HAVING sets_completed > 0
     ORDER BY s.date ASC`,
  );
}

/**
 * When the session's first set was completed, or null if it has not started.
 * Separate from getOrCreateSession so that merely opening the Workout tab
 * never implies the workout has begun.
 */
export async function getSessionStartedAt(
  sessionId: number,
): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ started_at: string | null }>(
    'SELECT started_at FROM sessions WHERE id = ?',
    [sessionId],
  );
  return row?.started_at ?? null;
}

export async function getSession(id: number): Promise<Session | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Session>(
    'SELECT * FROM sessions WHERE id = ?',
    [id],
  )) ?? null;
}

/**
 * Marks the session finished. `hk` null means Health wasn't read ("Read
 * workouts" is off), so any stats stored by an earlier finish are kept rather
 * than blanked.
 */
export async function finalizeSession(
  sessionId: number,
  hk: { durationMinutes: number | null; avgHr: number | null; calories: number | null } | null,
): Promise<void> {
  const db = await getDb();
  if (!hk) {
    await db.runAsync('UPDATE sessions SET completed_at = ? WHERE id = ?', [
      new Date().toISOString(),
      sessionId,
    ]);
    return;
  }
  await db.runAsync(
    `UPDATE sessions
     SET completed_at = ?, hk_duration_minutes = ?, hk_avg_hr = ?, hk_calories = ?
     WHERE id = ?`,
    [new Date().toISOString(), hk.durationMinutes, hk.avgHr, hk.calories, sessionId],
  );
}

export async function getSessionsForWeek(reference?: Date): Promise<Record<Day, Session | null>> {
  const db = await getDb();
  const week = weekDates(reference);
  const dates = DAYS.map((d) => week[d]);
  const rows = await db.getAllAsync<Session>(
    `SELECT * FROM sessions WHERE date IN (${dates.map(() => '?').join(',')})`,
    dates,
  );
  const out = {} as Record<Day, Session | null>;
  for (const d of DAYS) {
    out[d] = rows.find((r) => r.day === d && r.date === week[d]) ?? null;
  }
  return out;
}

export async function getWeekSetLogCounts(reference?: Date): Promise<Record<Day, number>> {
  const db = await getDb();
  const week = weekDates(reference);
  const dates = DAYS.map((d) => week[d]);
  const rows = await db.getAllAsync<{ day: Day; log_count: number }>(
    `SELECT s.day, COUNT(sl.id) AS log_count
     FROM sessions s
     LEFT JOIN set_logs sl ON sl.session_id = s.id AND sl.completed = 1
     WHERE s.date IN (${dates.map(() => '?').join(',')})
     GROUP BY s.day`,
    dates,
  );
  const out = {} as Record<Day, number>;
  for (const d of DAYS) out[d] = 0;
  for (const r of rows) out[r.day] = r.log_count;
  return out;
}

export async function getWeekTotalSetCounts(reference?: Date): Promise<Record<Day, number>> {
  const db = await getDb();
  const week = weekDates(reference);
  const dates = Object.values(week) as string[];

  const planRows = await db.getAllAsync<{ day: Day; total: number }>(
    `SELECT day, SUM(sets) AS total FROM day_exercises GROUP BY day`,
  );
  // Sets for exercises that were skipped during this week. We attribute the
  // skip to the exercise's plan day via day_exercises.day so the subtraction
  // lands on the same day-of-week the home dot represents.
  //
  // catchup_skips.exercise_id holds a *day_exercises.id* (see skipCatchupItem,
  // which is called with `ex.id`), so it joins to de.id -- NOT de.exercise_id,
  // which is the library exercises.id. Matching the wrong column silently
  // subtracted another exercise's sets from the wrong day: a skip of
  // day_exercises 9101 matched the unrelated row whose exercise_id happened to
  // be 9101, deflating that day's denominator.
  const skipRows = await db.getAllAsync<{ day: Day; total: number }>(
    `SELECT de.day, SUM(de.sets) AS total
     FROM catchup_skips cs
     JOIN day_exercises de ON de.id = cs.exercise_id
     WHERE cs.date_missed IN (${dates.map(() => '?').join(',')})
     GROUP BY de.day`,
    dates,
  );

  const out = {} as Record<Day, number>;
  for (const d of DAYS) out[d] = 0;
  for (const r of planRows) out[r.day] = r.total;
  for (const r of skipRows) out[r.day] = Math.max(0, (out[r.day] ?? 0) - r.total);
  return out;
}
