import * as SQLite from 'expo-sqlite';
import { initSchema } from './schema';
import { seedIfNeeded } from './seed';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('classic-physique.db');
      await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      await initSchema(db);
      await seedIfNeeded(db);
      return db;
    })();
  }
  return dbPromise;
}
