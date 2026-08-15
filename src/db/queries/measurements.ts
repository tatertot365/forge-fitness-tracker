import { getDb } from '../client';
import type {
  Measurement,
} from '../../types';
import { toISO } from '../../utils/date';

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

export async function startingMeasurement(): Promise<{
  weight_lb: number | null;
  body_fat_pct: number | null;
}> {
  const db = await getDb();
  const w = await db.getFirstAsync<{ weight_lb: number | null }>(
    'SELECT weight_lb FROM measurements WHERE weight_lb IS NOT NULL ORDER BY date ASC LIMIT 1',
  );
  const b = await db.getFirstAsync<{ body_fat_pct: number | null }>(
    'SELECT body_fat_pct FROM measurements WHERE body_fat_pct IS NOT NULL ORDER BY date ASC LIMIT 1',
  );
  return {
    weight_lb: w?.weight_lb ?? null,
    body_fat_pct: b?.body_fat_pct ?? null,
  };
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
