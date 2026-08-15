import { getDb } from '../client';
import type {
  MuscleGroup,
  Stretch,
} from '../../types';
import { weekDates } from '../../utils/date';

// ─── Stretches & cooldown ─────────────────────────────────────────────

export async function getStretchesByMuscleGroups(
  groups: MuscleGroup[],
): Promise<Stretch[]> {
  if (groups.length === 0) return [];
  const db = await getDb();
  const placeholders = groups.map(() => '?').join(',');
  return await db.getAllAsync<Stretch>(
    `SELECT id, name, muscle_group, hold_seconds, per_side, notes, builtin
     FROM stretches
     WHERE muscle_group IN (${placeholders})
     ORDER BY muscle_group, name`,
    groups,
  );
}

export async function getAllStretches(): Promise<Stretch[]> {
  const db = await getDb();
  return await db.getAllAsync<Stretch>(
    `SELECT id, name, muscle_group, hold_seconds, per_side, notes, builtin
     FROM stretches
     ORDER BY muscle_group, name`,
  );
}

export async function getMuscleGroupsTrainedInSession(
  sessionId: number,
): Promise<MuscleGroup[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ muscle_group: MuscleGroup }>(
    `SELECT DISTINCT e.muscle_group
     FROM set_logs sl
     JOIN exercises e ON e.id = sl.exercise_id
     WHERE sl.session_id = ? AND sl.completed = 1`,
    [sessionId],
  );
  return rows.map((r) => r.muscle_group);
}

export async function logCooldownStretch(
  sessionId: number,
  stretchId: number,
  durationSeconds: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO cooldown_logs (session_id, stretch_id, duration_seconds, completed_at)
     VALUES (?, ?, ?, ?)`,
    [sessionId, stretchId, durationSeconds, new Date().toISOString()],
  );
}

export async function getMobilityMinutesThisWeek(): Promise<number> {
  const db = await getDb();
  const week = weekDates();
  const dates = Object.values(week) as string[];
  const placeholders = dates.map(() => '?').join(',');
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(cl.duration_seconds) as total
     FROM cooldown_logs cl
     JOIN sessions s ON s.id = cl.session_id
     WHERE s.date IN (${placeholders})`,
    dates,
  );
  const seconds = row?.total ?? 0;
  return Math.round(seconds / 60);
}
