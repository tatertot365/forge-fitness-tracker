import { getDb } from './client';
import type {
  CatchupItem,
  DailyNutritionTotal,
  Day,
  DayExercise,
  DayPlan,
  FoodEntry,
  FoodRecent,
  LibraryExercise,
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

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getGoalsMode(): Promise<'calculated' | 'manual'> {
  const v = await getSetting('goals_mode');
  return v === 'calculated' ? 'calculated' : 'manual';
}

export async function setGoalsMode(mode: 'calculated' | 'manual'): Promise<void> {
  await setSetting('goals_mode', mode);
}

export async function getActivityLevel(): Promise<import('../utils/tdee').ActivityLevel | null> {
  const v = await getSetting('activity_level');
  return (v as import('../utils/tdee').ActivityLevel) ?? null;
}

export async function setActivityLevel(level: import('../utils/tdee').ActivityLevel): Promise<void> {
  await setSetting('activity_level', level);
}

export async function getUserProfile(): Promise<import('../utils/tdee').UserProfile> {
  const [h, d, s] = await Promise.all([
    getSetting('profile_height_in'),
    getSetting('profile_dob'),
    getSetting('profile_sex'),
  ]);
  return {
    height_in: h ? Number(h) : null,
    dob: d ?? null,
    sex: (s as import('../utils/tdee').Sex) ?? null,
  };
}

export async function setUserProfile(profile: Partial<import('../utils/tdee').UserProfile>): Promise<void> {
  if (profile.height_in != null) await setSetting('profile_height_in', String(profile.height_in));
  if (profile.dob != null) await setSetting('profile_dob', profile.dob);
  if (profile.sex != null) await setSetting('profile_sex', profile.sex);
}

export type BodyGoals = { goal_weight_lb: number | null; goal_body_fat_pct: number | null };

export async function getBodyGoals(): Promise<BodyGoals> {
  const [w, b] = await Promise.all([
    getSetting('goal_weight_lb'),
    getSetting('goal_body_fat_pct'),
  ]);
  return {
    goal_weight_lb: w ? Number(w) : null,
    goal_body_fat_pct: b ? Number(b) : null,
  };
}

export async function setBodyGoals(goals: Partial<BodyGoals>): Promise<void> {
  if (goals.goal_weight_lb != null) await setSetting('goal_weight_lb', String(goals.goal_weight_lb));
  if (goals.goal_body_fat_pct != null) await setSetting('goal_body_fat_pct', String(goals.goal_body_fat_pct));
}

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

// ─── Exercise library ─────────────────────────────────────────────────

export async function getLibraryExercises(): Promise<LibraryExercise[]> {
  const db = await getDb();
  return db.getAllAsync<LibraryExercise>(
    'SELECT * FROM exercises ORDER BY name ASC',
  );
}

export async function getLibraryExercisesByMuscle(muscle_group: MuscleGroup): Promise<LibraryExercise[]> {
  const db = await getDb();
  return db.getAllAsync<LibraryExercise>(
    'SELECT * FROM exercises WHERE muscle_group = ? ORDER BY name ASC',
    [muscle_group],
  );
}

export async function findLibraryExercisesByName(name: string): Promise<LibraryExercise[]> {
  const db = await getDb();
  return db.getAllAsync<LibraryExercise>(
    'SELECT * FROM exercises WHERE LOWER(name) = LOWER(?)',
    [name.trim()],
  );
}

export async function createLibraryExercise(input: {
  name: string;
  muscle_group: MuscleGroup;
  notes?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO exercises (name, muscle_group, notes) VALUES (?, ?, ?)`,
    [input.name.trim(), input.muscle_group, input.notes ?? null],
  );
  if (result.changes === 0) {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM exercises WHERE LOWER(name) = LOWER(?)',
      [input.name.trim()],
    );
    return existing!.id;
  }
  return result.lastInsertRowId as number;
}

// ─── Day exercises (plan assignments) ────────────────────────────────

const DAY_EXERCISE_JOIN = `
  SELECT
    de.id,
    de.day,
    de.exercise_id,
    e.name,
    e.muscle_group,
    e.notes,
    de.sets,
    de.warmup_sets,
    de.rep_range,
    de.sort_order,
    de.type,
    de.superset_partner_id
  FROM day_exercises de
  JOIN exercises e ON e.id = de.exercise_id
`;

export async function getExercisesByDay(day: Day): Promise<DayExercise[]> {
  const db = await getDb();
  return db.getAllAsync<DayExercise>(
    `${DAY_EXERCISE_JOIN} WHERE de.day = ? ORDER BY de.sort_order ASC`,
    [day],
  );
}

export async function getExercise(id: number): Promise<DayExercise | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DayExercise>(
    `${DAY_EXERCISE_JOIN} WHERE de.id = ?`,
    [id],
  );
  return row ?? null;
}

export async function createExercise(input: {
  day: Day;
  muscle_group: MuscleGroup;
  name: string;
  sets: number;
  warmup_sets?: number;
  rep_range: string;
  notes?: string | null;
  type?: string;
}): Promise<number> {
  const db = await getDb();

  // Ensure day_plans row exists and is enabled
  await db.runAsync(
    `INSERT INTO day_plans (day, name, enabled) VALUES (?, '', 1)
     ON CONFLICT(day) DO UPDATE SET enabled = 1`,
    [input.day],
  );

  // Upsert into library
  const libId = await createLibraryExercise({
    name: input.name,
    muscle_group: input.muscle_group,
    notes: input.notes,
  });

  // Get next sort_order for this day
  const tail = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) as max_order FROM day_exercises WHERE day = ?',
    [input.day],
  );
  const sortOrder = (tail?.max_order ?? -1) + 1;

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO day_exercises (day, exercise_id, sets, warmup_sets, rep_range, sort_order, type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.day,
      libId,
      input.sets,
      input.warmup_sets ?? 0,
      input.rep_range,
      sortOrder,
      input.type ?? 'normal',
    ],
  );

  if (result.changes === 0) {
    // Already on this day — return existing day_exercise id
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM day_exercises WHERE day = ? AND exercise_id = ?',
      [input.day, libId],
    );
    return existing!.id;
  }
  return result.lastInsertRowId as number;
}

export async function copyDayExercises(fromDay: Day, toDay: Day): Promise<void> {
  const exercises = await getExercisesByDay(fromDay);
  for (const ex of exercises) {
    await createExercise({
      day: toDay,
      muscle_group: ex.muscle_group,
      name: ex.name,
      sets: ex.sets,
      warmup_sets: ex.warmup_sets,
      rep_range: ex.rep_range,
      notes: ex.notes,
      type: ex.type,
    });
  }
}

export async function updateExercise(
  id: number,
  patch: {
    name?: string;
    sets?: number;
    warmup_sets?: number;
    rep_range?: string;
    notes?: string | null;
    type?: string;
  },
): Promise<void> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return;

  // Update library fields (name, notes) on the exercises table
  if (patch.name !== undefined || patch.notes !== undefined) {
    await db.runAsync(
      'UPDATE exercises SET name = ?, notes = ? WHERE id = ?',
      [
        patch.name !== undefined ? patch.name.trim() : ex.name,
        patch.notes !== undefined ? patch.notes : ex.notes,
        ex.exercise_id,
      ],
    );
  }

  // Update day-specific fields on day_exercises
  await db.runAsync(
    `UPDATE day_exercises
     SET sets = ?, warmup_sets = ?, rep_range = ?, type = ?
     WHERE id = ?`,
    [
      patch.sets !== undefined ? patch.sets : ex.sets,
      patch.warmup_sets !== undefined ? patch.warmup_sets : ex.warmup_sets,
      patch.rep_range !== undefined ? patch.rep_range.trim() : ex.rep_range,
      patch.type !== undefined ? patch.type : ex.type,
      id,
    ],
  );
}

export async function reorderExercisesInGroup(
  updates: { id: number; sort_order: number }[],
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const { id, sort_order } of updates) {
      await db.runAsync('UPDATE day_exercises SET sort_order = ? WHERE id = ?', [sort_order, id]);
    }
  });
}

export const reorderGroupsInDay = reorderExercisesInGroup;

export async function linkSuperset(aId: number, bId: number): Promise<void> {
  if (aId === bId) return;
  const db = await getDb();
  const a = await getExercise(aId);
  const b = await getExercise(bId);
  if (!a || !b) return;

  // Clear any old partners
  if (a.superset_partner_id && a.superset_partner_id !== bId) {
    await db.runAsync(
      `UPDATE day_exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [a.superset_partner_id],
    );
  }
  if (b.superset_partner_id && b.superset_partner_id !== aId) {
    await db.runAsync(
      `UPDATE day_exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [b.superset_partner_id],
    );
  }

  await db.runAsync(
    `UPDATE day_exercises SET type = 'superset', superset_partner_id = ? WHERE id = ?`,
    [bId, aId],
  );
  await db.runAsync(
    `UPDATE day_exercises SET type = 'superset', superset_partner_id = ? WHERE id = ?`,
    [aId, bId],
  );

  // Put B immediately after A
  const target = a.sort_order + 1;
  if (b.sort_order !== target) {
    await db.runAsync(
      `UPDATE day_exercises SET sort_order = sort_order + 1
       WHERE day = ? AND id != ? AND sort_order >= ? AND sort_order < ?`,
      [a.day, bId, target, b.sort_order],
    );
    await db.runAsync(`UPDATE day_exercises SET sort_order = ? WHERE id = ?`, [target, bId]);
  }
}

export async function unlinkSuperset(id: number): Promise<void> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return;
  if (ex.superset_partner_id) {
    await db.runAsync(
      `UPDATE day_exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [ex.superset_partner_id],
    );
  }
  await db.runAsync(
    `UPDATE day_exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
    [id],
  );
}

export async function deleteExercise(id: number): Promise<void> {
  const db = await getDb();
  const de = await db.getFirstAsync<{ exercise_id: number; day: string }>(
    'SELECT exercise_id, day FROM day_exercises WHERE id = ?',
    [id],
  );
  if (!de) return;

  // Unlink superset partner if any
  const ex = await getExercise(id);
  if (ex?.superset_partner_id) {
    await db.runAsync(
      `UPDATE day_exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
      [ex.superset_partner_id],
    );
  }

  // Delete set_logs for this exercise within sessions on the same day
  await db.runAsync(
    `DELETE FROM set_logs WHERE exercise_id = ? AND session_id IN (
       SELECT id FROM sessions WHERE day = ?
     )`,
    [de.exercise_id, de.day],
  );

  await db.runAsync('DELETE FROM day_exercises WHERE id = ?', [id]);
}

export async function deleteExercisesByGroup(day: Day, muscleGroup: MuscleGroup): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; superset_partner_id: number | null }>(
    `SELECT de.id, de.superset_partner_id
     FROM day_exercises de
     JOIN exercises e ON e.id = de.exercise_id
     WHERE de.day = ? AND e.muscle_group = ?`,
    [day, muscleGroup],
  );
  for (const de of rows) {
    if (de.superset_partner_id) {
      await db.runAsync(
        `UPDATE day_exercises SET type = 'normal', superset_partner_id = NULL WHERE id = ?`,
        [de.superset_partner_id],
      );
    }
  }
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM day_exercises WHERE id IN (${ph})`, ids);
}

export async function deleteExercisesByName(name: string): Promise<void> {
  // Removes the library entry entirely — cascades to all day_exercises via FK
  const db = await getDb();
  await db.runAsync('DELETE FROM exercises WHERE LOWER(name) = LOWER(?)', [name.trim()]);
}

export async function duplicateExercise(id: number): Promise<number | null> {
  const db = await getDb();
  const ex = await getExercise(id);
  if (!ex) return null;
  await db.runAsync(
    'UPDATE day_exercises SET sort_order = sort_order + 1 WHERE day = ? AND sort_order > ?',
    [ex.day, ex.sort_order],
  );
  const result = await db.runAsync(
    `INSERT INTO day_exercises (day, exercise_id, sets, warmup_sets, rep_range, sort_order, type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      ex.day,
      ex.exercise_id,
      ex.sets,
      ex.warmup_sets,
      ex.rep_range,
      ex.sort_order + 1,
      ex.type ?? 'normal',
    ],
  );
  return result.lastInsertRowId as number;
}


// Keep old names as aliases for components that haven't been updated yet
export async function getAllUniqueExercises(): Promise<LibraryExercise[]> {
  return getLibraryExercises();
}

export async function getAllExercises(): Promise<LibraryExercise[]> {
  return getLibraryExercises();
}

export async function findExercisesByName(name: string): Promise<LibraryExercise[]> {
  return findLibraryExercisesByName(name);
}

// ─── Day plans ────────────────────────────────────────────────────────

export async function getDayPlans(): Promise<Record<Day, DayPlan>> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayPlan>('SELECT * FROM day_plans');
  const out = {} as Record<Day, DayPlan>;
  for (const d of DAYS) {
    const row = rows.find((r) => r.day === d);
    out[d] = row ?? { day: d, name: '', enabled: 0 };
  }
  return out;
}

export async function updateDayPlan(
  day: Day,
  patch: { enabled?: 0 | 1; name?: string },
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<DayPlan>(
    'SELECT * FROM day_plans WHERE day = ?',
    [day],
  );
  if (existing) {
    await db.runAsync(
      'UPDATE day_plans SET enabled = ?, name = ? WHERE day = ?',
      [
        patch.enabled !== undefined ? patch.enabled : existing.enabled,
        patch.name !== undefined ? patch.name : existing.name,
        day,
      ],
    );
  } else {
    await db.runAsync(
      'INSERT INTO day_plans (day, enabled, name) VALUES (?, ?, ?)',
      [day, patch.enabled ?? 0, patch.name ?? ''],
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
  // exerciseId here is a day_exercises.id — resolve to library exercise_id for set_logs
  const de = await db.getFirstAsync<{ exercise_id: number }>(
    'SELECT exercise_id FROM day_exercises WHERE id = ?',
    [exerciseId],
  );
  const libId = de?.exercise_id ?? exerciseId;
  return db.getAllAsync<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? AND exercise_id = ? ORDER BY set_number',
    [sessionId, libId],
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
  // exerciseId may be day_exercises.id — resolve to library exercise_id
  const de = await db.getFirstAsync<{ exercise_id: number }>(
    'SELECT exercise_id FROM day_exercises WHERE id = ?',
    [exerciseId],
  );
  const libId = de?.exercise_id ?? exerciseId;

  const existing = await db.getFirstAsync<SetLog>(
    'SELECT * FROM set_logs WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
    [sessionId, libId, setNumber],
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
        libId,
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

async function getLibraryIdForDayExercise(
  db: Awaited<ReturnType<typeof getDb>>,
  exerciseId: number,
): Promise<{ libId: number; isBodyweight: boolean }> {
  // Try resolving as day_exercises.id first
  const de = await db.getFirstAsync<{ exercise_id: number; type: string }>(
    'SELECT exercise_id, type FROM day_exercises WHERE id = ?',
    [exerciseId],
  );
  if (de) {
    return { libId: de.exercise_id, isBodyweight: de.type === 'bodyweight' };
  }
  // Fall back: treat as direct library id (for history queries from old set_logs)
  const lib = await db.getFirstAsync<{ type: string }>(
    'SELECT \'normal\' as type FROM exercises WHERE id = ?',
    [exerciseId],
  );
  return { libId: exerciseId, isBodyweight: false };
}

export async function getLastCompletedSetsForExercise(
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SetLog[]> {
  const db = await getDb();
  const { libId, isBodyweight } = await getLibraryIdForDayExercise(db, exerciseId);

  const row = await db.getFirstAsync<{ session_id: number; exercise_id: number }>(
    `SELECT sl.session_id, sl.exercise_id FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.exercise_id = ?
       AND sl.completed = 1
       ${excludeSessionId ? 'AND sl.session_id != ?' : ''}
     ORDER BY s.date DESC, s.id DESC
     LIMIT 1`,
    excludeSessionId ? [libId, excludeSessionId] : [libId],
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
  const { libId, isBodyweight } = await getLibraryIdForDayExercise(db, exerciseId);

  const sessionRows = await db.getAllAsync<{ session_id: number; date: string }>(
    `SELECT DISTINCT sl.session_id, s.date
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.exercise_id = ? AND sl.completed = 1
     ORDER BY s.date DESC, s.id DESC
     LIMIT ?`,
    [libId, limit],
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
     WHERE exercise_id = ? AND session_id IN (${sessPh})
       AND completed = 1 ${weightFilter}`,
    [libId, ...sessionIds],
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
  const { libId, isBodyweight } = await getLibraryIdForDayExercise(db, exerciseId);
  const scoreExpr = isBodyweight ? 'MAX(sl.reps)' : 'MAX(sl.weight_lb * sl.reps)';
  const whereFilter = isBodyweight
    ? 'AND sl.reps IS NOT NULL'
    : 'AND sl.weight_lb IS NOT NULL AND sl.reps IS NOT NULL';
  const rows = await db.getAllAsync<{ date: string; score: number }>(
    `SELECT s.date as date, ${scoreExpr} as score
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.exercise_id = ?
       AND sl.completed = 1
       ${whereFilter}
     GROUP BY s.id
     ORDER BY s.date DESC, s.id DESC
     LIMIT ?`,
    [libId, limit],
  );
  return rows.reverse();
}

export async function deleteSetLog(
  sessionId: number,
  exerciseId: number,
  setNumber: number,
): Promise<void> {
  const db = await getDb();
  const de = await db.getFirstAsync<{ exercise_id: number }>(
    'SELECT exercise_id FROM day_exercises WHERE id = ?',
    [exerciseId],
  );
  const libId = de?.exercise_id ?? exerciseId;
  await db.runAsync(
    'DELETE FROM set_logs WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
    [sessionId, libId, setNumber],
  );
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

// ─── CSV export ───────────────────────────────────────────────────────

function escapeCSV(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(row.map(escapeCSV).join(','));
  return lines.join('\n');
}

export async function exportMeasurementsCSV(): Promise<string> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    date: string;
    weight_lb: number | null;
    body_fat_pct: number | null;
    shoulders_in: number | null;
    waist_in: number | null;
    arms_flexed_in: number | null;
    chest_in: number | null;
    quads_in: number | null;
  }>('SELECT * FROM measurements ORDER BY date ASC');

  return toCSV(
    ['date', 'weight_lb', 'body_fat_pct', 'lean_mass_lb', 'shoulders_in', 'waist_in', 'arms_flexed_in', 'chest_in', 'quads_in'],
    rows.map((r) => {
      const lean =
        r.weight_lb != null && r.body_fat_pct != null
          ? +(r.weight_lb * (1 - r.body_fat_pct / 100)).toFixed(2)
          : null;
      return [r.date, r.weight_lb, r.body_fat_pct, lean, r.shoulders_in, r.waist_in, r.arms_flexed_in, r.chest_in, r.quads_in];
    }),
  );
}

export async function exportFoodLogCSV(): Promise<string> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    date: string;
    name: string;
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  }>('SELECT date, name, calories, protein_g, fat_g, carbs_g FROM food_entries ORDER BY date ASC, created_at ASC');

  return toCSV(
    ['date', 'name', 'calories', 'protein_g', 'fat_g', 'carbs_g'],
    rows.map((r) => [r.date, r.name, r.calories, r.protein_g, r.fat_g, r.carbs_g]),
  );
}

export async function exportSessionsCSV(): Promise<string> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    date: string;
    day: string;
    exercise_name: string;
    muscle_group: string;
    set_number: number;
    weight_lb: number | null;
    reps: number | null;
    completed: number;
  }>(`
    SELECT
      s.date,
      s.day,
      e.name AS exercise_name,
      e.muscle_group,
      sl.set_number,
      sl.weight_lb,
      sl.reps,
      sl.completed
    FROM set_logs sl
    JOIN sessions s ON s.id = sl.session_id
    JOIN exercises e ON e.id = sl.exercise_id
    ORDER BY s.date ASC, s.day ASC, e.name ASC, sl.set_number ASC
  `);

  return toCSV(
    ['date', 'day', 'exercise', 'muscle_group', 'set_number', 'weight_lb', 'reps', 'completed'],
    rows.map((r) => [r.date, r.day, r.exercise_name, r.muscle_group, r.set_number, r.weight_lb, r.reps, r.completed]),
  );
}

// ─── Utility re-exports ───────────────────────────────────────────────

export { DAY_LABEL };
