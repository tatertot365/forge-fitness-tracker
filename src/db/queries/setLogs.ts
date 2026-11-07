import { getDb } from '../client';
import type {
  ExerciseType,
  MuscleGroup,
  SetLog,
} from '../../types';
import { weekDates } from '../../utils/date';
import { formatDuration } from '../../utils/duration';

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
    duration_seconds?: number | null;
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
       SET weight_lb = ?, reps = ?, completed = ?, drop_weight_lb = ?, drop_reps = ?,
           duration_seconds = ?
       WHERE id = ?`,
      [
        patch.weight_lb !== undefined ? patch.weight_lb : existing.weight_lb,
        patch.reps !== undefined ? patch.reps : existing.reps,
        patch.completed !== undefined ? patch.completed : existing.completed,
        patch.drop_weight_lb !== undefined ? patch.drop_weight_lb : existing.drop_weight_lb,
        patch.drop_reps !== undefined ? patch.drop_reps : existing.drop_reps,
        patch.duration_seconds !== undefined ? patch.duration_seconds : existing.duration_seconds,
        existing.id,
      ],
    );
  } else {
    await db.runAsync(
      `INSERT INTO set_logs (session_id, exercise_id, set_number, weight_lb, reps, completed, drop_weight_lb, drop_reps, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        libId,
        setNumber,
        patch.weight_lb ?? null,
        patch.reps ?? null,
        patch.completed ?? 0,
        patch.drop_weight_lb ?? null,
        patch.drop_reps ?? null,
        patch.duration_seconds ?? null,
      ],
    );
  }

  // Start the session clock on the first *completed* set. Typing a weight into
  // a row is not the same as having done the work -- the value is often
  // pre-filled from last session -- so only the check-off counts. No-ops once
  // started_at is set.
  if (patch.completed === 1) {
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE sessions SET started_at = ? WHERE id = ? AND started_at IS NULL',
      [now, sessionId],
    );
    // Only on the actual check-off. The exercise screen re-sends completed: 1
    // with every weight/rep edit to a done set, and a correction made hours
    // later must not stretch the session's end time to the edit.
    if (existing?.completed !== 1) {
      await db.runAsync('UPDATE sessions SET last_set_at = ? WHERE id = ?', [
        now,
        sessionId,
      ]);
    }
  }
}

/**
 * How a set is scored when picking the best one: weight × reps, reps alone
 * for bodyweight, or time held for timed exercises.
 */
export type SetScoring = 'weighted' | 'bodyweight' | 'timed';

export function scoringFor(type: ExerciseType): SetScoring {
  if (type === 'bodyweight') return 'bodyweight';
  if (type === 'timed') return 'timed';
  return 'weighted';
}

async function getLibraryIdForDayExercise(
  db: Awaited<ReturnType<typeof getDb>>,
  exerciseId: number,
): Promise<{ libId: number; isBodyweight: boolean; scoring: SetScoring }> {
  // Try resolving as day_exercises.id first
  const de = await db.getFirstAsync<{ exercise_id: number; type: ExerciseType }>(
    'SELECT exercise_id, type FROM day_exercises WHERE id = ?',
    [exerciseId],
  );
  if (de) {
    return {
      libId: de.exercise_id,
      isBodyweight: de.type === 'bodyweight',
      scoring: scoringFor(de.type),
    };
  }
  // Fall back: treat as direct library id (for history queries from old set_logs)
  const lib = await db.getFirstAsync<{ type: string }>(
    'SELECT \'normal\' as type FROM exercises WHERE id = ?',
    [exerciseId],
  );
  return { libId: exerciseId, isBodyweight: false, scoring: 'weighted' };
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

/**
 * Comparable score for one set, or null if the set can't be scored. Timed sets
 * rank by time, with weight breaking ties (a 60s plank at 25 lb beats one
 * without); the tiebreak is scaled small enough never to outweigh a second.
 */
function setScore(s: SetLog, scoring: SetScoring): number | null {
  if (scoring === 'timed') {
    if (s.duration_seconds == null) return null;
    return s.duration_seconds + (s.weight_lb ?? 0) / 10_000;
  }
  if (s.reps == null) return null;
  if (scoring === 'bodyweight') return s.reps;
  if (s.weight_lb == null) return null;
  return s.weight_lb * s.reps;
}

export function bestSet(sets: SetLog[], scoring: SetScoring = 'weighted'): SetLog | null {
  let best: SetLog | null = null;
  let bestScore = -Infinity;
  for (const s of sets) {
    const score = setScore(s, scoring);
    if (score != null && score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The "Last: …" / "Beat this" label for an exercise's best previous set, e.g.
 * "240 lb × 6", "12 reps", "1:15" or "45s @ 25 lb". Null when nothing usable
 * was logged.
 */
export function bestSetLabel(sets: SetLog[], type: ExerciseType): string | null {
  const scoring = scoringFor(type);
  const b = bestSet(sets, scoring);
  if (!b) return null;
  if (scoring === 'timed') {
    const time = formatDuration(b.duration_seconds ?? 0);
    return b.weight_lb ? `${time} @ ${b.weight_lb} lb` : time;
  }
  if (scoring === 'bodyweight') return `${b.reps} reps`;
  return `${b.weight_lb} lb × ${b.reps}`;
}

export type ExerciseSessionHistory = {
  session_id: number;
  date: string;
  best_weight_lb: number | null;
  best_reps: number;
  /** Timed exercises: the longest set that session, in seconds. */
  best_seconds: number | null;
  /** lb moved; total reps for bodyweight; total seconds for timed. */
  volume: number;
  sets_count: number;
};

export async function getExerciseSessionHistory(
  exerciseId: number,
  limit: number = 10,
): Promise<ExerciseSessionHistory[]> {
  const db = await getDb();
  const { libId, scoring } = await getLibraryIdForDayExercise(db, exerciseId);

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
  const setRows = await db.getAllAsync<SetLog>(
    `SELECT * FROM set_logs
     WHERE exercise_id = ? AND session_id IN (${sessPh}) AND completed = 1`,
    [libId, ...sessionIds],
  );

  const dateById = new Map(sessionRows.map((r) => [r.session_id, r.date]));
  const bySession = new Map<number, ExerciseSessionHistory>();
  const bestScore = new Map<number, number>();
  for (const r of setRows) {
    const score = setScore(r, scoring);
    if (score == null) continue;
    const amount =
      scoring === 'timed'
        ? r.duration_seconds ?? 0
        : scoring === 'bodyweight'
          ? r.reps ?? 0
          : (r.weight_lb ?? 0) * (r.reps ?? 0);
    let h = bySession.get(r.session_id);
    if (!h) {
      h = {
        session_id: r.session_id,
        date: dateById.get(r.session_id)!,
        best_weight_lb: null,
        best_reps: 0,
        best_seconds: null,
        volume: 0,
        sets_count: 0,
      };
      bySession.set(r.session_id, h);
    }
    h.volume += amount;
    h.sets_count += 1;
    if (score > (bestScore.get(r.session_id) ?? -Infinity)) {
      bestScore.set(r.session_id, score);
      h.best_weight_lb = r.weight_lb;
      h.best_reps = r.reps ?? 0;
      h.best_seconds = r.duration_seconds;
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
