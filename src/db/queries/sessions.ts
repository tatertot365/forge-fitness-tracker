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

export async function finalizeSession(
  sessionId: number,
  hk: { durationMinutes: number | null; avgHr: number | null; calories: number | null },
): Promise<void> {
  const db = await getDb();
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
