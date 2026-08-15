import { getDb } from '../client';

// ─── Full backup (JSON) ───────────────────────────────────────────────

// Tables to dump in dependency order. Restore re-inserts in the same order so
// foreign keys (day_exercises -> day_plans/exercises, set_logs -> sessions/exercises)
// resolve cleanly.
const BACKUP_TABLES = [
  'settings',
  'exercises',
  'day_plans',
  'day_exercises',
  'sessions',
  'set_logs',
  'food_entries',
  'nutrition_goals',
  'measurements',
  'cardio_sessions',
  'catchup_skips',
  'day_skips',
  'stretches',
  'cooldown_logs',
] as const;

const BACKUP_VERSION = 1;

export type ForgeBackup = {
  app: 'forge';
  version: number;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export async function exportFullBackupJSON(): Promise<string> {
  const db = await getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  }
  const backup: ForgeBackup = {
    app: 'forge',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };
  return JSON.stringify(backup, null, 2);
}

export async function importFullBackupJSON(text: string): Promise<void> {
  let parsed: ForgeBackup;
  try {
    parsed = JSON.parse(text) as ForgeBackup;
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (parsed?.app !== 'forge') {
    throw new Error('This file is not a Forge backup.');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${parsed.version}. This app expects v${BACKUP_VERSION}.`,
    );
  }
  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('Backup is missing table data.');
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Clear in reverse dependency order, then insert in forward order.
    for (const t of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    for (const t of BACKUP_TABLES) {
      const rows = parsed.tables[t] ?? [];
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(',');
        const values = cols.map((c) => (row[c] ?? null) as string | number | null);
        await db.runAsync(
          `INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders})`,
          values,
        );
      }
    }
  });
}

export async function resetAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
  });
}
