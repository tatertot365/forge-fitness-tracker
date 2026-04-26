import type { SQLiteDatabase } from 'expo-sqlite';
import { toISO } from '../utils/date';

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      name TEXT NOT NULL,
      sets INTEGER NOT NULL,
      rep_range TEXT NOT NULL,
      notes TEXT,
      sort_order INTEGER NOT NULL,
      accent_color TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'normal',
      superset_partner_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      date TEXT NOT NULL,
      completed_at TEXT,
      hk_duration_minutes INTEGER,
      hk_avg_hr INTEGER,
      hk_calories INTEGER,
      UNIQUE(day, date)
    );

    CREATE TABLE IF NOT EXISTS set_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_lb REAL,
      reps INTEGER,
      completed INTEGER NOT NULL DEFAULT 0,
      drop_weight_lb REAL,
      drop_reps INTEGER,
      UNIQUE(session_id, exercise_id, set_number)
    );

    CREATE INDEX IF NOT EXISTS idx_exercises_day ON exercises(day);
    CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

    CREATE TABLE IF NOT EXISTS food_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      fat_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_food_entries_date ON food_entries(date);
    CREATE INDEX IF NOT EXISTS idx_food_entries_name ON food_entries(name);

    CREATE TABLE IF NOT EXISTS nutrition_goals (
      date TEXT PRIMARY KEY,
      calorie_goal REAL NOT NULL,
      protein_goal REAL NOT NULL,
      fat_goal REAL NOT NULL DEFAULT 80,
      carbs_goal REAL NOT NULL DEFAULT 250
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight_lb REAL,
      body_fat_pct REAL,
      shoulders_in REAL,
      waist_in REAL,
      arms_flexed_in REAL,
      chest_in REAL,
      quads_in REAL
    );

    CREATE TABLE IF NOT EXISTS cardio_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cardio_date ON cardio_sessions(date);

    CREATE TABLE IF NOT EXISTS catchup_skips (
      exercise_id INTEGER NOT NULL,
      date_missed TEXT NOT NULL,
      PRIMARY KEY (exercise_id, date_missed)
    );

    CREATE TABLE IF NOT EXISTS day_skips (
      day TEXT NOT NULL,
      date TEXT NOT NULL,
      PRIMARY KEY (day, date)
    );

    CREATE TABLE IF NOT EXISTS day_plans (
      day TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      focus TEXT NOT NULL
    );
  `);

  const defaults: Array<[string, number, string]> = [
    ['monday', 1, 'Push day'],
    ['tuesday', 1, 'Pull day — width'],
    ['wednesday', 1, 'Leg day — quads'],
    ['thursday', 1, 'Push day'],
    ['friday', 1, 'Pull day — thickness'],
    ['saturday', 1, 'Leg day — hamstrings'],
    ['sunday', 0, 'Rest day'],
  ];
  for (const [day, enabled, focus] of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO day_plans (day, enabled, focus) VALUES (?, ?, ?)`,
      [day, enabled, focus],
    );
  }

  // Migrations for columns added after initial release
  await addColumnIfMissing(db, 'exercises', 'type', "TEXT NOT NULL DEFAULT 'normal'");
  await addColumnIfMissing(db, 'exercises', 'superset_partner_id', 'INTEGER');
  await addColumnIfMissing(db, 'set_logs', 'drop_weight_lb', 'REAL');
  await addColumnIfMissing(db, 'set_logs', 'drop_reps', 'INTEGER');
  await addColumnIfMissing(db, 'measurements', 'weight_lb', 'REAL');
  await addColumnIfMissing(db, 'measurements', 'body_fat_pct', 'REAL');
  await addColumnIfMissing(db, 'food_entries', 'fat_g', 'REAL NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'food_entries', 'carbs_g', 'REAL NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'nutrition_goals', 'fat_goal', 'REAL NOT NULL DEFAULT 80');
  await addColumnIfMissing(db, 'nutrition_goals', 'carbs_goal', 'REAL NOT NULL DEFAULT 250');

  // Prune skip records older than one week — they only apply to the current week
  const pruneDate = toISO(new Date(Date.now() - 7 * 86_400_000));
  await db.runAsync('DELETE FROM catchup_skips WHERE date_missed < ?', [pruneDate]);
  await db.runAsync('DELETE FROM day_skips WHERE date < ?', [pruneDate]);
}

async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  column: string,
  spec: string,
): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  if (rows.some((r) => r.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${spec};`);
}
