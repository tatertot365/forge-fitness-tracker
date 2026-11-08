import { getDb } from '../client';
import type { CardioSession } from '../../types';
import { weekDates } from '../../utils/date';

// ─── Cardio plan ──────────────────────────────────────────────────────

/** The cardio the user means to do: what the card shows and Log/Start use. */
export type CardioPlan = {
  /** CardioActivity key, e.g. 'incline_walk'. */
  activity: string;
  /** Target length; pre-fills Log. Null when not set. */
  minutes: number | null;
  /** Free text for machine settings, e.g. "12° / 3 mph". */
  details: string;
};

/**
 * The stored plan as-is. Plans saved before the plan was structured have only
 * the free-text `name`/`details` and no activity; the cardio feature converts
 * those once (see getCardioPlan there).
 */
export async function getCardioPlanRaw(): Promise<{
  activity: string | null;
  minutes: number | null;
  details: string | null;
  legacyName: string | null;
}> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings
     WHERE key IN ('cardio_activity', 'cardio_minutes', 'cardio_desc', 'cardio_name')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const minutes = Number(map['cardio_minutes']);
  return {
    activity: map['cardio_activity'] || null,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    details: map['cardio_desc'] ?? null,
    legacyName: map['cardio_name'] ?? null,
  };
}

export async function setCardioPlan(plan: CardioPlan): Promise<void> {
  const db = await getDb();
  const set = (key: string, value: string) =>
    db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  await set('cardio_activity', plan.activity);
  await set('cardio_minutes', plan.minutes ? String(plan.minutes) : '');
  await set('cardio_desc', plan.details);
  // The free-text name is folded into activity/details on conversion.
  await db.runAsync(`DELETE FROM settings WHERE key = 'cardio_name'`);
}

// ─── Cardio ───────────────────────────────────────────────────────────

export type CardioInput = {
  date: string;
  activity: string;
  duration_seconds: number | null;
  distance_mi: number | null;
  started_at?: string | null;
  source?: 'forge' | 'health';
  health_uuid?: string | null;
};

export async function addCardioSession(input: CardioInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO cardio_sessions
       (date, created_at, activity, duration_seconds, distance_mi, started_at, source, health_uuid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.date,
      new Date().toISOString(),
      input.activity,
      input.duration_seconds,
      input.distance_mi,
      input.started_at ?? null,
      input.source ?? 'forge',
      input.health_uuid ?? null,
    ],
  );
  return result.lastInsertRowId as number;
}

export async function updateCardioSession(
  id: number,
  patch: Partial<Pick<CardioSession, 'date' | 'activity' | 'duration_seconds' | 'distance_mi' | 'health_uuid'>>,
): Promise<void> {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const db = await getDb();
  // Keys come from the Pick above, never from input, so interpolating is safe.
  await db.runAsync(
    `UPDATE cardio_sessions SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
    [...fields.map((f) => patch[f] ?? null), id],
  );
}

export async function deleteCardioSession(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cardio_sessions WHERE id = ?', [id]);
}

export async function getCardioSession(id: number): Promise<CardioSession | null> {
  const db = await getDb();
  return (await db.getFirstAsync<CardioSession>(
    'SELECT * FROM cardio_sessions WHERE id = ?',
    [id],
  )) ?? null;
}

/** Newest first. */
export async function getCardioSessions(limit = 50): Promise<CardioSession[]> {
  const db = await getDb();
  return db.getAllAsync<CardioSession>(
    'SELECT * FROM cardio_sessions ORDER BY date DESC, created_at DESC LIMIT ?',
    [limit],
  );
}

/** Health workout uuids already in Forge, so they aren't offered again. */
export async function getCardioHealthUuids(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ health_uuid: string }>(
    'SELECT health_uuid FROM cardio_sessions WHERE health_uuid IS NOT NULL',
  );
  return new Set(rows.map((r) => r.health_uuid));
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

/** Total logged minutes this week; sessions without a duration add nothing. */
export async function getCardioMinutesThisWeek(reference: Date = new Date()): Promise<number> {
  const db = await getDb();
  const week = weekDates(reference);
  const row = await db.getFirstAsync<{ s: number | null }>(
    'SELECT SUM(duration_seconds) as s FROM cardio_sessions WHERE date BETWEEN ? AND ?',
    [week.monday, week.sunday],
  );
  return Math.round((row?.s ?? 0) / 60);
}

// ─── Live session ─────────────────────────────────────────────────────
//
// Kept in settings, not component state, so a session timed in Forge keeps
// running if the app is closed or killed mid-walk.

export type RunningCardio = { activity: string; since: string };

export async function getRunningCardio(): Promise<RunningCardio | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'cardio_running'`,
  );
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as RunningCardio;
  } catch {
    return null;
  }
}

export async function startRunningCardio(activity: string): Promise<RunningCardio> {
  const running = { activity, since: new Date().toISOString() };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('cardio_running', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(running)],
  );
  return running;
}

export async function clearRunningCardio(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM settings WHERE key = 'cardio_running'`);
}
