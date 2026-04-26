import { getDb } from './client';
import type {
  CatchupItem,
  DailyNutritionTotal,
  Day,
  DayPlan,
  Exercise,
  ExerciseType,
  FoodEntry,
  FoodRecent,
  Measurement,
  MuscleGroup,
  NutritionGoal,
  Phase,
  Session,
  SetLog,
} from '../types';
import { DAYS, DAY_LABEL } from '../types';
import { daysBetween, toISO, todayISO, weekDates } from '../utils/date';

// ─── Phase ────────────────────────────────────────────────────────────

export async function getPhase(): Promise<Phase> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['phase'],
  );
  return (row?.value as Phase) ?? 'maintain';
}

export async function setPhase(phase: Phase): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('phase', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [phase],
  );
}

export async function isHealthKitAsked(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['healthkit_asked'],
  );
  return row?.value === '1';
}

export async function markHealthKitAsked(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('healthkit_asked', '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

// ─── Exercises ────────────────────────────────────────────────────────

export async function getExercisesByDay(day: Day): Promise<Exercise[]> {
  const db = await getDb();
  return db.getAllAsync<Exercise>(
    'SELECT * FROM exercises WHERE day = ? ORDER BY sort_order ASC',
    [day],
  );
}

export async function getExercise(id: number): Promise<Exercise | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Exercise>(
    'SELECT * FROM exercises WHERE id = ?',
    [id],
  );
  return row ?? null;
}

export async function updateExercise(
  id: number,
  patch: {
    name?: string;
    sets?: number;
    warmup_sets?: number;
    rep_range?: string;
    notes?: string | null;
    type?: ExerciseType;
  },
): Promise<void> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return;
  await db.runAsync(
    `UPDATE exercises
     SET name = ?, sets = ?, warmup_sets = ?, rep_range = ?, notes = ?, type = ?
     WHERE id = ?`,
    [
      patch.name ?? ex.name,
      patch.sets ?? ex.sets,
      patch.warmup_sets !== undefined ? patch.warmup_sets : ex.warmup_sets,
      patch.rep_range ?? ex.rep_range,
      patch.notes !== undefined ? patch.notes : ex.notes,
      patch.type ?? ex.type,
      id,
    ],
  );
}

export async function linkSuperset(aId: number, bId: number): Promise<void> {
  if (aId === bId) return;
  const db = await getDb();
  const a = await getExercise(aId);
  const b = await getExercise(bId);
  if (!a || !b) return;

  // Clear any old partners either side may have had.
  if (a.superset_partner_id && a.superset_partner_id !== bId) {
    await db.runAsync(
      `UPDATE exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [a.superset_partner_id],
    );
  }
  if (b.superset_partner_id && b.superset_partner_id !== aId) {
    await db.runAsync(
      `UPDATE exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [b.superset_partner_id],
    );
  }

  await db.runAsync(
    `UPDATE exercises SET type = 'superset', superset_partner_id = ? WHERE id = ?`,
    [bId, aId],
  );
  await db.runAsync(
    `UPDATE exercises SET type = 'superset', superset_partner_id = ? WHERE id = ?`,
    [aId, bId],
  );

  // Put B immediately after A so they render adjacent.
  const target = a.sort_order + 1;
  if (b.sort_order !== target) {
    await db.runAsync(
      `UPDATE exercises SET sort_order = sort_order + 1
       WHERE day = ? AND id != ? AND sort_order >= ? AND sort_order < ?`,
      [a.day, bId, target, b.sort_order],
    );
    await db.runAsync(`UPDATE exercises SET sort_order = ? WHERE id = ?`, [target, bId]);
  }
}

export async function unlinkSuperset(id: number): Promise<void> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return;
  if (ex.superset_partner_id) {
    await db.runAsync(
      `UPDATE exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [ex.superset_partner_id],
    );
  }
  await db.runAsync(
    `UPDATE exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
    [id],
  );
}

export async function createExercise(input: {
  day: Day;
  muscle_group: MuscleGroup;
  name: string;
  sets: number;
  warmup_sets?: number;
  rep_range: string;
  notes?: string | null;
  accent_color: string;
  type?: ExerciseType;
}): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ max_order: number | null }>(
    `SELECT MAX(sort_order) as max_order
     FROM exercises
     WHERE day = ? AND muscle_group = ?`,
    [input.day, input.muscle_group],
  );
  let insertAt: number;
  if (row?.max_order != null) {
    insertAt = row.max_order + 1;
    await db.runAsync(
      'UPDATE exercises SET sort_order = sort_order + 1 WHERE day = ? AND sort_order >= ?',
      [input.day, insertAt],
    );
  } else {
    const tail = await db.getFirstAsync<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM exercises WHERE day = ?',
      [input.day],
    );
    insertAt = (tail?.max_order ?? -1) + 1;
  }
  const result = await db.runAsync(
    `INSERT INTO exercises (day, muscle_group, name, sets, warmup_sets, rep_range, notes, sort_order, accent_color, type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.day,
      input.muscle_group,
      input.name,
      input.sets,
      input.warmup_sets ?? 0,
      input.rep_range,
      input.notes ?? null,
      insertAt,
      input.accent_color,
      input.type ?? 'normal',
    ],
  );
  return result.lastInsertRowId as number;
}

export async function deleteExercisesByGroup(day: Day, muscleGroup: MuscleGroup): Promise<void> {
  const db = await getDb();
  const exercises = await db.getAllAsync<{ id: number; superset_partner_id: number | null }>(
    'SELECT id, superset_partner_id FROM exercises WHERE day = ? AND muscle_group = ?',
    [day, muscleGroup],
  );
  for (const ex of exercises) {
    if (ex.superset_partner_id) {
      await db.runAsync(
        `UPDATE exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
        [ex.superset_partner_id],
      );
    }
  }
  if (exercises.length === 0) return;
  const ids = exercises.map((e) => e.id);
  const ph = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM set_logs WHERE exercise_id IN (${ph})`, ids);
  await db.runAsync(
    'DELETE FROM exercises WHERE day = ? AND muscle_group = ?',
    [day, muscleGroup],
  );
}

export async function deleteExercise(id: number): Promise<void> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return;
  if (ex.superset_partner_id) {
    await db.runAsync(
      `UPDATE exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [ex.superset_partner_id],
    );
  }
  await db.runAsync('DELETE FROM set_logs WHERE exercise_id = ?', [id]);
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
}

export async function duplicateExercise(id: number): Promise<number | null> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return null;
  await db.runAsync(
    'UPDATE exercises SET sort_order = sort_order + 1 WHERE day = ? AND sort_order > ?',
    [ex.day, ex.sort_order],
  );
  const result = await db.runAsync(
    `INSERT INTO exercises (day, muscle_group, name, sets, rep_range, notes, sort_order, accent_color, type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ex.day,
      ex.muscle_group,
      ex.name,
      ex.sets,
      ex.rep_range,
      ex.notes,
      ex.sort_order + 1,
      ex.accent_color,
      ex.type ?? 'normal',
    ],
  );
  return result.lastInsertRowId as number;
}

// TODO (Option B — per-session exercise overrides):
// Let the user swap an exercise or change its set count for a single session
// without modifying the plan. Add a `session_exercise_overrides` table keyed
// by (session_id, exercise_id) with override_exercise_id / override_sets, and
// resolve in getExercisesByDay when a specific session is in view.

// ─── Day plans ────────────────────────────────────────────────────────

export async function getDayPlans(): Promise<Record<Day, DayPlan>> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayPlan>('SELECT * FROM day_plans');
  const out = {} as Record<Day, DayPlan>;
  for (const d of DAYS) {
    const row = rows.find((r) => r.day === d);
    out[d] = row ?? { day: d, enabled: 1, focus: '' };
  }
  return out;
}

export async function updateDayPlan(
  day: Day,
  patch: { enabled?: 0 | 1; focus?: string },
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<DayPlan>(
    'SELECT * FROM day_plans WHERE day = ?',
    [day],
  );
  if (existing) {
    await db.runAsync(
      'UPDATE day_plans SET enabled = ?, focus = ? WHERE day = ?',
      [
        patch.enabled !== undefined ? patch.enabled : existing.enabled,
        patch.focus !== undefined ? patch.focus : existing.focus,
        day,
      ],
    );
  } else {
    await db.runAsync(
      'INSERT INTO day_plans (day, enabled, focus) VALUES (?, ?, ?)',
      [day, patch.enabled ?? 1, patch.focus ?? ''],
    );
  }
}

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
     LEFT JOIN set_logs sl ON sl.session_id = s.id
     WHERE s.date IN (${dates.map(() => '?').join(',')})
     GROUP BY s.day`,
    dates,
  );
  const out = {} as Record<Day, number>;
  for (const d of DAYS) out[d] = 0;
  for (const r of rows) out[r.day] = r.log_count;
  return out;
}

// ─── Set logs ─────────────────────────────────────────────────────────

export async function getCompletedSetCountForSession(sessionId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM set_logs WHERE session_id = ? AND completed = 1',
    [sessionId],
  );
  return row?.c ?? 0;
}

export async function getMuscleGroupSetsThisWeek(
  reference?: Date,
): Promise<Partial<Record<MuscleGroup, number>>> {
  const db = await getDb();
  const week = weekDates(reference);
  const dates = Object.values(week) as string[];
  const rows = await db.getAllAsync<{ muscle_group: MuscleGroup; sets_done: number }>(
    `SELECT e.muscle_group, COUNT(*) as sets_done
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     JOIN exercises e ON e.id = sl.exercise_id
     WHERE s.date IN (${dates.map(() => '?').join(',')})
       AND sl.completed = 1
     GROUP BY e.muscle_group
     ORDER BY sets_done DESC`,
    dates,
  );
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const r of rows) out[r.muscle_group] = r.sets_done;
  return out;
}

export async function getSetLogsForSession(sessionId: number): Promise<SetLog[]> {
  const db = await getDb();
  return db.getAllAsync<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? ORDER BY exercise_id, set_number',
    [sessionId],
  );
}

export async function getSetLogsForSessionExercise(
  sessionId: number,
  exerciseId: number,
): Promise<SetLog[]> {
  const db = await getDb();
  return db.getAllAsync<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? AND exercise_id = ? ORDER BY set_number',
    [sessionId, exerciseId],
  );
}

export async function upsertSetLog(
  sessionId: number,
  exerciseId: number,
  setNumber: number,
  patch: {
    weight_lb?: number | null;
    reps?: number | null;
    completed?: 0 | 1;
    drop_weight_lb?: number | null;
    drop_reps?: number | null;
  },
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
    [sessionId, exerciseId, setNumber],
  );
  if (existing) {
    await db.runAsync(
      `UPDATE set_logs
       SET weight_lb = ?, reps = ?, completed = ?, drop_weight_lb = ?, drop_reps = ?
       WHERE id = ?`,
      [
        patch.weight_lb !== undefined ? patch.weight_lb : existing.weight_lb,
        patch.reps !== undefined ? patch.reps : existing.reps,
        patch.completed !== undefined ? patch.completed : existing.completed,
        patch.drop_weight_lb !== undefined ? patch.drop_weight_lb : existing.drop_weight_lb,
        patch.drop_reps !== undefined ? patch.drop_reps : existing.drop_reps,
        existing.id,
      ],
    );
  } else {
    await db.runAsync(
      `INSERT INTO set_logs (session_id, exercise_id, set_number, weight_lb, reps, completed, drop_weight_lb, drop_reps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        exerciseId,
        setNumber,
        patch.weight_lb ?? null,
        patch.reps ?? null,
        patch.completed ?? 0,
        patch.drop_weight_lb ?? null,
        patch.drop_reps ?? null,
      ],
    );
  }
}

async function getSiblingInfo(
  db: Awaited<ReturnType<typeof getDb>>,
  exerciseId: number,
): Promise<{ ids: number[]; isBodyweight: boolean }> {
  const nameRow = await db.getFirstAsync<{ name: string; type: string }>(
    'SELECT name, type FROM exercises WHERE id = ?',
    [exerciseId],
  );
  if (!nameRow) return { ids: [exerciseId], isBodyweight: false };
  const rows = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM exercises WHERE LOWER(name) = LOWER(?)',
    [nameRow.name],
  );
  return {
    ids: rows.map((r) => r.id),
    isBodyweight: nameRow.type === 'bodyweight',
  };
}

export async function getAllUniqueExercises(): Promise<Exercise[]> {
  const db = await getDb();
  // One representative row per unique name (lowest id), sorted alphabetically
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises
     WHERE id IN (SELECT MIN(id) FROM exercises GROUP BY LOWER(name))
     ORDER BY name ASC`,
  );
}

export async function findExercisesByName(name: string): Promise<Exercise[]> {
  const db = await getDb();
  return db.getAllAsync<Exercise>(
    'SELECT * FROM exercises WHERE LOWER(name) = LOWER(?)',
    [name.trim()],
  );
}

export async function deleteSetLog(
  sessionId: number,
  exerciseId: number,
  setNumber: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM set_logs WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
    [sessionId, exerciseId, setNumber],
  );
}

export async function getLastCompletedSetsForExercise(
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SetLog[]> {
  const db = await getDb();
  const { ids } = await getSiblingInfo(db, exerciseId);
  const ph = ids.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ session_id: number; exercise_id: number }>(
    `SELECT sl.session_id, sl.exercise_id FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.exercise_id IN (${ph})
       AND sl.completed = 1
       ${excludeSessionId ? 'AND sl.session_id != ?' : ''}
     ORDER BY s.date DESC, s.id DESC
     LIMIT 1`,
    excludeSessionId ? [...ids, excludeSessionId] : ids,
  );
  if (!row) return [];
  return db.getAllAsync<SetLog>(
    `SELECT * FROM set_logs
     WHERE session_id = ? AND exercise_id = ? AND completed = 1
     ORDER BY set_number`,
    [row.session_id, row.exercise_id],
  );
}

export function bestSet(sets: SetLog[], isBodyweight = false): SetLog | null {
  let best: SetLog | null = null;
  for (const s of sets) {
    if (s.reps == null) continue;
    if (!isBodyweight && s.weight_lb == null) continue;
    const score = isBodyweight ? s.reps : (s.weight_lb ?? 0) * s.reps;
    const bestScore = best == null
      ? -Infinity
      : isBodyweight ? (best.reps ?? 0) : (best.weight_lb ?? 0) * (best.reps ?? 0);
    if (score > bestScore) best = s;
  }
  return best;
}

export type ExerciseSessionHistory = {
  session_id: number;
  date: string;
  best_weight_lb: number | null;
  best_reps: number;
  volume: number;
  sets_count: number;
};

export async function getExerciseSessionHistory(
  exerciseId: number,
  limit: number = 10,
): Promise<ExerciseSessionHistory[]> {
  const db = await getDb();
  const { ids, isBodyweight } = await getSiblingInfo(db, exerciseId);
  const idPh = ids.map(() => '?').join(',');

  const sessionRows = await db.getAllAsync<{ session_id: number; date: string }>(
    `SELECT DISTINCT sl.session_id, s.date
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.exercise_id IN (${idPh}) AND sl.completed = 1
     ORDER BY s.date DESC, s.id DESC
     LIMIT ?`,
    [...ids, limit],
  );
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((r) => r.session_id);
  const sessPh = sessionIds.map(() => '?').join(',');
  const weightFilter = isBodyweight
    ? 'AND reps IS NOT NULL'
    : 'AND weight_lb IS NOT NULL AND reps IS NOT NULL';
  const setRows = await db.getAllAsync<{ session_id: number; weight_lb: number | null; reps: number }>(
    `SELECT session_id, weight_lb, reps
     FROM set_logs
     WHERE exercise_id IN (${idPh}) AND session_id IN (${sessPh})
       AND completed = 1 ${weightFilter}`,
    [...ids, ...sessionIds],
  );

  const dateById = new Map(sessionRows.map((r) => [r.session_id, r.date]));
  const bySession = new Map<number, ExerciseSessionHistory>();
  for (const r of setRows) {
    const score = isBodyweight ? r.reps : (r.weight_lb ?? 0) * r.reps;
    const existing = bySession.get(r.session_id);
    if (!existing) {
      bySession.set(r.session_id, {
        session_id: r.session_id,
        date: dateById.get(r.session_id)!,
        best_weight_lb: r.weight_lb,
        best_reps: r.reps,
        volume: score,
        sets_count: 1,
      });
    } else {
      existing.volume += score;
      existing.sets_count += 1;
      const existingScore = isBodyweight
        ? existing.best_reps
        : (existing.best_weight_lb ?? 0) * existing.best_reps;
      if (score > existingScore) {
        existing.best_weight_lb = r.weight_lb;
        existing.best_reps = r.reps;
      }
    }
  }
  return sessionIds.map((id) => bySession.get(id)).filter((r): r is ExerciseSessionHistory => !!r);
}

export async function getBestSetHistoryForExercise(
  exerciseId: number,
  limit: number = 8,
): Promise<{ date: string; score: number }[]> {
  const db = await getDb();
  const { ids, isBodyweight } = await getSiblingInfo(db, exerciseId);
  const ph = ids.map(() => '?').join(',');
  const scoreExpr = isBodyweight ? 'MAX(sl.reps)' : 'MAX(sl.weight_lb * sl.reps)';
  const whereFilter = isBodyweight
    ? 'AND sl.reps IS NOT NULL'
    : 'AND sl.weight_lb IS NOT NULL AND sl.reps IS NOT NULL';
  const rows = await db.getAllAsync<{ date: string; score: number }>(
    `SELECT s.date as date, ${scoreExpr} as score
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.exercise_id IN (${ph})
       AND sl.completed = 1
       ${whereFilter}
     GROUP BY s.id
     ORDER BY s.date DESC, s.id DESC
     LIMIT ?`,
    [...ids, limit],
  );
  return rows.reverse();
}

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
    if (date >= today) continue; // only past days this week
    if (daySkipSet.has(`${day}|${date}`)) continue;

    const exercises = await db.getAllAsync<{
      id: number;
      name: string;
      muscle_group: CatchupItem['muscle_group'];
      sets: number;
    }>(
      'SELECT id, name, muscle_group, sets FROM exercises WHERE day = ? ORDER BY sort_order',
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
          [session.id, ex.id],
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

// ─── Food log ─────────────────────────────────────────────────────────

const DEFAULT_CALORIE_GOAL = 2500;
const DEFAULT_PROTEIN_GOAL = 180;
const DEFAULT_FAT_GOAL = 80;
const DEFAULT_CARBS_GOAL = 250;

export async function addFoodEntry(input: {
  date: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO food_entries (date, name, calories, protein_g, fat_g, carbs_g, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.date, input.name.trim(), input.calories, input.protein_g, input.fat_g, input.carbs_g, new Date().toISOString()],
  );
  return result.lastInsertRowId as number;
}

export async function updateFoodEntry(
  id: number,
  patch: { name?: string; calories?: number; protein_g?: number; fat_g?: number; carbs_g?: number },
): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<FoodEntry>(
    'SELECT * FROM food_entries WHERE id = ?',
    [id],
  );
  if (!row) return;
  await db.runAsync(
    `UPDATE food_entries SET name = ?, calories = ?, protein_g = ?, fat_g = ?, carbs_g = ? WHERE id = ?`,
    [
      patch.name !== undefined ? patch.name.trim() : row.name,
      patch.calories !== undefined ? patch.calories : row.calories,
      patch.protein_g !== undefined ? patch.protein_g : row.protein_g,
      patch.fat_g !== undefined ? patch.fat_g : row.fat_g,
      patch.carbs_g !== undefined ? patch.carbs_g : row.carbs_g,
      id,
    ],
  );
}

export async function deleteFoodEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM food_entries WHERE id = ?', [id]);
}

export async function getFoodEntriesForDate(date: string): Promise<FoodEntry[]> {
  const db = await getDb();
  return db.getAllAsync<FoodEntry>(
    'SELECT * FROM food_entries WHERE date = ? ORDER BY created_at ASC, id ASC',
    [date],
  );
}

export async function getFoodRecents(limit: number = 8): Promise<FoodRecent[]> {
  const db = await getDb();
  return db.getAllAsync<FoodRecent>(
    `SELECT name,
            calories,
            protein_g,
            fat_g,
            carbs_g,
            created_at AS last_used_at
     FROM food_entries fe
     WHERE fe.id = (
       SELECT id FROM food_entries
       WHERE LOWER(name) = LOWER(fe.name)
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     )
     ORDER BY last_used_at DESC
     LIMIT ?`,
    [limit],
  );
}

export async function getNutritionGoalForDate(date: string): Promise<NutritionGoal> {
  const db = await getDb();
  const row = await db.getFirstAsync<NutritionGoal>(
    'SELECT * FROM nutrition_goals WHERE date <= ? ORDER BY date DESC LIMIT 1',
    [date],
  );
  if (row) return row;
  return { date, calorie_goal: DEFAULT_CALORIE_GOAL, protein_goal: DEFAULT_PROTEIN_GOAL, fat_goal: DEFAULT_FAT_GOAL, carbs_goal: DEFAULT_CARBS_GOAL };
}

export async function setNutritionGoal(
  date: string,
  patch: { calorie_goal?: number; protein_goal?: number; fat_goal?: number; carbs_goal?: number },
): Promise<void> {
  const current = await getNutritionGoalForDate(date);
  const next = {
    calorie_goal: patch.calorie_goal ?? current.calorie_goal,
    protein_goal: patch.protein_goal ?? current.protein_goal,
    fat_goal: patch.fat_goal ?? current.fat_goal,
    carbs_goal: patch.carbs_goal ?? current.carbs_goal,
  };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO nutrition_goals (date, calorie_goal, protein_goal, fat_goal, carbs_goal) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       calorie_goal = excluded.calorie_goal,
       protein_goal = excluded.protein_goal,
       fat_goal = excluded.fat_goal,
       carbs_goal = excluded.carbs_goal`,
    [date, next.calorie_goal, next.protein_goal, next.fat_goal, next.carbs_goal],
  );
}

export async function getDailyNutritionTotals(
  daysBack: number = 14,
  reference: Date = new Date(),
): Promise<DailyNutritionTotal[]> {
  const db = await getDb();
  const dates: string[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(reference);
    d.setDate(d.getDate() - i);
    dates.push(toISO(d));
  }
  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  const [rows, allGoals] = await Promise.all([
    db.getAllAsync<{ date: string; calories: number; protein_g: number; fat_g: number; carbs_g: number }>(
      `SELECT date,
              COALESCE(SUM(calories), 0) AS calories,
              COALESCE(SUM(protein_g), 0) AS protein_g,
              COALESCE(SUM(fat_g), 0) AS fat_g,
              COALESCE(SUM(carbs_g), 0) AS carbs_g
       FROM food_entries
       WHERE date >= ?
       GROUP BY date`,
      [earliest],
    ),
    // Fetch all goals up to end of range; sorted DESC so find() gives the
    // most-recent goal on or before any given date (carry-forward semantics).
    db.getAllAsync<NutritionGoal>(
      'SELECT * FROM nutrition_goals WHERE date <= ? ORDER BY date DESC',
      [latest],
    ),
  ]);

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: DailyNutritionTotal[] = [];
  for (const d of dates) {
    const goal = allGoals.find((g) => g.date <= d) ?? {
      date: d,
      calorie_goal: DEFAULT_CALORIE_GOAL,
      protein_goal: DEFAULT_PROTEIN_GOAL,
      fat_goal: DEFAULT_FAT_GOAL,
      carbs_goal: DEFAULT_CARBS_GOAL,
    };
    const agg = byDate.get(d);
    out.push({
      date: d,
      calories: agg?.calories ?? 0,
      protein_g: agg?.protein_g ?? 0,
      fat_g: agg?.fat_g ?? 0,
      carbs_g: agg?.carbs_g ?? 0,
      calorie_goal: goal.calorie_goal,
      protein_goal: goal.protein_goal,
      fat_goal: goal.fat_goal ?? DEFAULT_FAT_GOAL,
      carbs_goal: goal.carbs_goal ?? DEFAULT_CARBS_GOAL,
    });
  }
  return out;
}

// ─── Measurements ─────────────────────────────────────────────────────

export async function upsertMeasurement(
  date: string,
  m: {
    weight_lb: number | null;
    body_fat_pct: number | null;
    shoulders_in: number | null;
    waist_in: number | null;
    arms_flexed_in: number | null;
    chest_in: number | null;
    quads_in: number | null;
  },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO measurements (date, weight_lb, body_fat_pct, shoulders_in, waist_in, arms_flexed_in, chest_in, quads_in)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       weight_lb = excluded.weight_lb,
       body_fat_pct = excluded.body_fat_pct,
       shoulders_in = excluded.shoulders_in,
       waist_in = excluded.waist_in,
       arms_flexed_in = excluded.arms_flexed_in,
       chest_in = excluded.chest_in,
       quads_in = excluded.quads_in`,
    [date, m.weight_lb, m.body_fat_pct, m.shoulders_in, m.waist_in, m.arms_flexed_in, m.chest_in, m.quads_in],
  );
}

export async function getMeasurementHistory(limit = 16): Promise<Measurement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Measurement>(
    'SELECT * FROM measurements ORDER BY date DESC LIMIT ?',
    [limit],
  );
  return rows.reverse();
}

export async function latestMeasurement(): Promise<Measurement | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Measurement>(
    'SELECT * FROM measurements ORDER BY date DESC LIMIT 1',
  )) ?? null;
}

export async function measurementOneWeekAgo(): Promise<Measurement | null> {
  const db = await getDb();
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const iso = toISO(d);
  return (await db.getFirstAsync<Measurement>(
    'SELECT * FROM measurements WHERE date <= ? ORDER BY date DESC LIMIT 1',
    [iso],
  )) ?? null;
}

// ─── Cardio settings ──────────────────────────────────────────────────

export type CardioInfo = { name: string; description: string };

const CARDIO_DEFAULTS: CardioInfo = {
  name: 'Incline treadmill walk',
  description: '12° / 3 mph / 20–30 min',
};

export async function getCardioInfo(): Promise<CardioInfo> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('cardio_name', 'cardio_desc')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    name: map['cardio_name'] ?? CARDIO_DEFAULTS.name,
    description: map['cardio_desc'] ?? CARDIO_DEFAULTS.description,
  };
}

export async function setCardioInfo(info: CardioInfo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('cardio_name', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [info.name],
  );
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('cardio_desc', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [info.description],
  );
}

// ─── Cardio ───────────────────────────────────────────────────────────

export async function addCardioToday(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO cardio_sessions (date, created_at) VALUES (?, ?)',
    [todayISO(), new Date().toISOString()],
  );
}

export async function getCardioCountThisWeek(reference: Date = new Date()): Promise<number> {
  const db = await getDb();
  const week = weekDates(reference);
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM cardio_sessions WHERE date BETWEEN ? AND ?',
    [week.monday, week.sunday],
  );
  return row?.c ?? 0;
}

// ─── Utility re-exports ───────────────────────────────────────────────

export { DAY_LABEL };
