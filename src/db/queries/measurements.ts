import { getDb } from '../client';
import type {
  Measurement,
} from '../../types';

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
  // COALESCE, not a bare overwrite: a null here means "not supplied on this
  // save", never "clear it". The entry sheet seeds from the *latest* row, so
  // logging only a weight on a day that already has a row would otherwise wipe
  // that day's circumferences. Clearing a value is a deliberate act and goes
  // through clearMeasurementField().
  await db.runAsync(
    `INSERT INTO measurements (date, weight_lb, body_fat_pct, shoulders_in, waist_in, arms_flexed_in, chest_in, quads_in)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       weight_lb = COALESCE(excluded.weight_lb, measurements.weight_lb),
       body_fat_pct = COALESCE(excluded.body_fat_pct, measurements.body_fat_pct),
       shoulders_in = COALESCE(excluded.shoulders_in, measurements.shoulders_in),
       waist_in = COALESCE(excluded.waist_in, measurements.waist_in),
       arms_flexed_in = COALESCE(excluded.arms_flexed_in, measurements.arms_flexed_in),
       chest_in = COALESCE(excluded.chest_in, measurements.chest_in),
       quads_in = COALESCE(excluded.quads_in, measurements.quads_in)`,
    [date, m.weight_lb, m.body_fat_pct, m.shoulders_in, m.waist_in, m.arms_flexed_in, m.chest_in, m.quads_in],
  );
}

// Explicit erase for a single field on a single date. upsertMeasurement()
// treats null as "unchanged", so this is the only way to blank a value once
// it has been recorded.
export async function clearMeasurementField(
  date: string,
  field: keyof Omit<Measurement, 'id' | 'date'>,
): Promise<void> {
  const db = await getDb();
  // Whitelisted against the column list -- `field` is interpolated, not bound,
  // because SQLite cannot parameterise an identifier.
  const allowed: (keyof Omit<Measurement, 'id' | 'date'>)[] = [
    'weight_lb',
    'body_fat_pct',
    'shoulders_in',
    'waist_in',
    'arms_flexed_in',
    'chest_in',
    'quads_in',
  ];
  if (!allowed.includes(field)) throw new Error(`Unknown measurement field: ${field}`);
  await db.runAsync(`UPDATE measurements SET ${field} = NULL WHERE date = ?`, [date]);
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

// The row deltas are measured against. Picks the most recent check-in strictly
// older than the latest one, so it is always a genuine comparison rather than a
// row against itself -- the old `date <= today-7` had no lower bound and, with
// a single stored check-in, matched that same row and reported every change as
// zero. Callers use `date` to say how far back the comparison actually reaches.
export async function comparisonMeasurement(): Promise<Measurement | null> {
  const db = await getDb();
  const latest = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM measurements ORDER BY date DESC LIMIT 1',
  );
  if (!latest) return null;
  return (await db.getFirstAsync<Measurement>(
    'SELECT * FROM measurements WHERE date < ? ORDER BY date DESC LIMIT 1',
    [latest.date],
  )) ?? null;
}
