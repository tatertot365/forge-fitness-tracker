import { getDb } from '../client';
import type {
  DailyNutritionTotal,
  FoodEntry,
  FoodLibraryItem,
  FoodRecent,
  NutritionGoal,
} from '../../types';
import { toISO } from '../../utils/date';

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

// ─── Food library ─────────────────────────────────────────────────────
//
// Every distinct food ever logged, newest use first, with its most recent
// macros. The recents strip shows only the first handful; this backs the
// searchable list where the rest is actually reachable.

export async function searchFoodHistory(
  query: string = '',
  limit: number = 200,
): Promise<FoodLibraryItem[]> {
  const db = await getDb();
  const q = query.trim();
  // Match anywhere in the name, not just the prefix: people search "chicken"
  // to find "Grilled chicken breast".
  const like = `%${q.replace(/[%_]/g, (c) => '\\' + c)}%`;
  const rows = await db.getAllAsync<FoodLibraryItem>(
    `SELECT fe.name,
            fe.calories,
            fe.protein_g,
            fe.fat_g,
            fe.carbs_g,
            fe.created_at AS last_used_at,
            (SELECT COUNT(*) FROM food_entries c
              WHERE LOWER(c.name) = LOWER(fe.name)) AS use_count,
            (ff.name_key IS NOT NULL) AS is_favorite
       FROM food_entries fe
       LEFT JOIN food_favorites ff ON ff.name_key = LOWER(fe.name)
      WHERE fe.id = (
        SELECT id FROM food_entries
         WHERE LOWER(name) = LOWER(fe.name)
         ORDER BY created_at DESC, id DESC
         LIMIT 1
      )
        ${q === '' ? '' : "AND fe.name LIKE ? ESCAPE '\\'"}
      ORDER BY is_favorite DESC, last_used_at DESC
      LIMIT ?`,
    q === '' ? [limit] : [like, limit],
  );
  // SQLite returns 0/1 for the boolean expressions above.
  return rows.map((r) => ({ ...r, is_favorite: !!r.is_favorite }));
}

export async function toggleFoodFavorite(name: string): Promise<boolean> {
  const db = await getDb();
  const key = name.trim().toLowerCase();
  const existing = await db.getFirstAsync<{ name_key: string }>(
    'SELECT name_key FROM food_favorites WHERE name_key = ?',
    [key],
  );
  if (existing) {
    await db.runAsync('DELETE FROM food_favorites WHERE name_key = ?', [key]);
    return false;
  }
  await db.runAsync(
    `INSERT INTO food_favorites (name_key, display_name, created_at) VALUES (?, ?, ?)`,
    [key, name.trim(), new Date().toISOString()],
  );
  return true;
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

export async function hasNutritionGoal(date: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM nutrition_goals WHERE date <= ?',
    [date],
  );
  return (row?.c ?? 0) > 0;
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
       WHERE date >= ? AND date <= ?
       GROUP BY date`,
      [earliest, latest],
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
