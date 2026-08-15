import { getDb } from '../client';
import { todayISO, weekDates } from '../../utils/date';

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
