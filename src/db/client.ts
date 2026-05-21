import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { initSchema } from './schema';
import { seedIfNeeded } from './seed';

const DB_NAME = 'forge.db';
const LEGACY_DB_NAME = 'classic-physique.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      await migrateLegacyDb();
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      await initSchema(db);
      await seedIfNeeded(db);
      return db;
    })();
  }
  return dbPromise;
}

// Rename the pre-launch database file to the shipping name. Only runs once:
// if a legacy file exists and no new file does yet, move it (plus -wal/-shm
// sidecars) so dev history is preserved. Safe to call on every cold start.
async function migrateLegacyDb(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}SQLite/`;
  const legacy = `${dir}${LEGACY_DB_NAME}`;
  const current = `${dir}${DB_NAME}`;
  try {
    const [legacyInfo, currentInfo] = await Promise.all([
      FileSystem.getInfoAsync(legacy),
      FileSystem.getInfoAsync(current),
    ]);
    if (!legacyInfo.exists || currentInfo.exists) return;
    await FileSystem.moveAsync({ from: legacy, to: current });
    for (const suffix of ['-wal', '-shm']) {
      const fromSide = `${legacy}${suffix}`;
      const toSide = `${current}${suffix}`;
      const info = await FileSystem.getInfoAsync(fromSide);
      if (info.exists) await FileSystem.moveAsync({ from: fromSide, to: toSide });
    }
  } catch {
    // Migration is best-effort. If it fails, the user simply starts fresh.
  }
}
