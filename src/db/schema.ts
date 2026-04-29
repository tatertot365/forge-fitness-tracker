import type { SQLiteDatabase } from 'expo-sqlite';
import { toISO } from '../utils/date';

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Exercise library: one row per unique exercise, no day/sets/reps
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      notes TEXT
    );

    -- One row per day that has a workout assigned
    CREATE TABLE IF NOT EXISTS day_plans (
      day TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- Exercises assigned to a day with user-configured sets/reps/order
    CREATE TABLE IF NOT EXISTS day_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL REFERENCES day_plans(day) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      sets INTEGER NOT NULL DEFAULT 3,
      warmup_sets INTEGER NOT NULL DEFAULT 0,
      rep_range TEXT NOT NULL DEFAULT '8-12',
      sort_order INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'normal',
      superset_partner_id INTEGER,
      UNIQUE(day, exercise_id)
    );

    CREATE INDEX IF NOT EXISTS idx_day_exercises_day ON day_exercises(day);
    CREATE INDEX IF NOT EXISTS idx_day_exercises_exercise ON day_exercises(exercise_id);

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
  `);

  // Run migration: drop old exercises schema and replace with new library schema
  await migrateToLibrarySchema(db);

  // Insert default day_plan rows for all 7 days if not present
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    await db.runAsync(
      `INSERT OR IGNORE INTO day_plans (day, name, enabled) VALUES (?, '', 0)`,
      [day],
    );
  }

  // Prune skip records older than one week
  const pruneDate = toISO(new Date(Date.now() - 7 * 86_400_000));
  await db.runAsync('DELETE FROM catchup_skips WHERE date_missed < ?', [pruneDate]);
  await db.runAsync('DELETE FROM day_skips WHERE date < ?', [pruneDate]);
}

async function migrateToLibrarySchema(db: SQLiteDatabase): Promise<void> {
  const alreadyMigrated = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'schema_v2'`,
  );
  if (alreadyMigrated?.value === '2') return;

  // Drop old exercises table (had day/sets/rep_range baked in) and all dependent data
  await db.execAsync(`
    DROP TABLE IF EXISTS catchup_skips;
    DROP TABLE IF EXISTS day_skips;
    DROP TABLE IF EXISTS set_logs;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS day_exercises;
    DROP TABLE IF EXISTS day_plans;
    DROP TABLE IF EXISTS exercises;
  `);

  // Recreate clean versions of all dropped tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS day_plans (
      day TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS day_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL REFERENCES day_plans(day) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      sets INTEGER NOT NULL DEFAULT 3,
      warmup_sets INTEGER NOT NULL DEFAULT 0,
      rep_range TEXT NOT NULL DEFAULT '8-12',
      sort_order INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'normal',
      superset_partner_id INTEGER,
      UNIQUE(day, exercise_id)
    );

    CREATE INDEX IF NOT EXISTS idx_day_exercises_day ON day_exercises(day);
    CREATE INDEX IF NOT EXISTS idx_day_exercises_exercise ON day_exercises(exercise_id);

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

    CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

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
  `);

  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('schema_v2', '2')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );

  // Clear the old seed flag so the library gets re-seeded
  await db.runAsync(`DELETE FROM settings WHERE key = 'seeded'`);
}
