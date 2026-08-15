import { getDb } from '../client';
import type {
  CatchupItem,
  Day,
  MuscleGroup,
} from '../../types';
import { DAYS } from '../../types';
import { daysBetween, todayISO, weekDates } from '../../utils/date';

// ─── Day skips ────────────────────────────────────────────────────────

export async function skipDay(day: Day, date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO day_skips (day, date) VALUES (?, ?)',
    [day, date],
  );
}

export async function getSkippedDaysThisWeek(): Promise<Partial<Record<Day, true>>> {
  const db = await getDb();
  const week = weekDates();
  const dates = Object.values(week) as string[];
  const placeholders = dates.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT day FROM day_skips WHERE date IN (${placeholders})`,
    dates,
  );
  const out: Partial<Record<Day, true>> = {};
  for (const r of rows) out[r.day as Day] = true;
  return out;
}

// ─── Catch-up ─────────────────────────────────────────────────────────

export async function skipCatchupItem(exerciseId: number, dateMissed: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO catchup_skips (exercise_id, date_missed) VALUES (?, ?)',
    [exerciseId, dateMissed],
  );
}

export async function getSkippedExerciseIds(date: string): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise_id: number }>(
    'SELECT exercise_id FROM catchup_skips WHERE date_missed = ?',
    [date],
  );
  return new Set(rows.map((r) => r.exercise_id));
}

export async function getCatchupItems(reference: Date = new Date()): Promise<CatchupItem[]> {
  const db = await getDb();
  const week = weekDates(reference);
  const today = todayISO();
  const items: CatchupItem[] = [];

  const skips = await db.getAllAsync<{ exercise_id: number; date_missed: string }>(
    'SELECT exercise_id, date_missed FROM catchup_skips',
  );
  const skipSet = new Set(skips.map((s) => `${s.exercise_id}|${s.date_missed}`));

  const daySkipRows = await db.getAllAsync<{ day: string; date: string }>(
    'SELECT day, date FROM day_skips',
  );
  const daySkipSet = new Set(daySkipRows.map((r) => `${r.day}|${r.date}`));

  for (const day of DAYS) {
    const date = week[day];
    if (date >= today) continue;
    if (daySkipSet.has(`${day}|${date}`)) continue;

    const exercises = await db.getAllAsync<{
      id: number;
      exercise_id: number;
      name: string;
      muscle_group: MuscleGroup;
      sets: number;
    }>(
      `SELECT de.id, de.exercise_id, e.name, e.muscle_group, de.sets
       FROM day_exercises de
       JOIN exercises e ON e.id = de.exercise_id
       WHERE de.day = ?
       ORDER BY de.sort_order`,
      [day],
    );
    if (exercises.length === 0) continue;

    const session = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM sessions WHERE day = ? AND date = ?',
      [day, date],
    );

    for (const ex of exercises) {
      if (skipSet.has(`${ex.id}|${date}`)) continue;

      let completed = 0;
      if (session) {
        const row = await db.getFirstAsync<{ c: number }>(
          'SELECT COUNT(*) as c FROM set_logs WHERE session_id = ? AND exercise_id = ? AND completed = 1',
          [session.id, ex.exercise_id],
        );
        completed = row?.c ?? 0;
      }
      const missed = ex.sets - completed;
      if (missed > 0) {
        items.push({
          exercise_id: ex.id,
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          day,
          date_missed: date,
          sets_missed: missed,
          days_ago: daysBetween(date, today),
        });
      }
    }
  }

  items.sort((a, b) => b.days_ago - a.days_ago);
  return items;
}
