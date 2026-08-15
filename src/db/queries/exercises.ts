import { getDb } from '../client';
import type {
  Day,
  DayExercise,
  LibraryExercise,
  MuscleGroup,
} from '../../types';
import { createLibraryExercise, findLibraryExercisesByName, getLibraryExercises } from './library';

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
    de.superset_partner_id,
    de.hold_seconds
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
  hold_seconds?: number | null;
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
    `INSERT OR IGNORE INTO day_exercises (day, exercise_id, sets, warmup_sets, rep_range, sort_order, type, hold_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.day,
      libId,
      input.sets,
      input.warmup_sets ?? 0,
      input.rep_range,
      sortOrder,
      input.type ?? 'normal',
      input.hold_seconds ?? null,
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
      hold_seconds: ex.hold_seconds,
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
    hold_seconds?: number | null;
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
     SET sets = ?, warmup_sets = ?, rep_range = ?, type = ?, hold_seconds = ?
     WHERE id = ?`,
    [
      patch.sets !== undefined ? patch.sets : ex.sets,
      patch.warmup_sets !== undefined ? patch.warmup_sets : ex.warmup_sets,
      patch.rep_range !== undefined ? patch.rep_range.trim() : ex.rep_range,
      patch.type !== undefined ? patch.type : ex.type,
      patch.hold_seconds !== undefined ? patch.hold_seconds : ex.hold_seconds,
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
