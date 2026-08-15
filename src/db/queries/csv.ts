import { getDb } from '../client';

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
