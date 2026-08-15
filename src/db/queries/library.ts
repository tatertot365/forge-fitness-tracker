import { getDb } from '../client';
import type {
  LibraryExercise,
  MuscleGroup,
} from '../../types';

// ─── Exercise library ─────────────────────────────────────────────────

export async function getLibraryExercises(): Promise<LibraryExercise[]> {
  const db = await getDb();
  return db.getAllAsync<LibraryExercise>(
    'SELECT * FROM exercises ORDER BY name ASC',
  );
}

export async function getLibraryExercisesByMuscle(muscle_group: MuscleGroup): Promise<LibraryExercise[]> {
  const db = await getDb();
  return db.getAllAsync<LibraryExercise>(
    'SELECT * FROM exercises WHERE muscle_group = ? ORDER BY name ASC',
    [muscle_group],
  );
}

export async function findLibraryExercisesByName(name: string): Promise<LibraryExercise[]> {
  const db = await getDb();
  return db.getAllAsync<LibraryExercise>(
    'SELECT * FROM exercises WHERE LOWER(name) = LOWER(?)',
    [name.trim()],
  );
}

export async function createLibraryExercise(input: {
  name: string;
  muscle_group: MuscleGroup;
  notes?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO exercises (name, muscle_group, notes) VALUES (?, ?, ?)`,
    [input.name.trim(), input.muscle_group, input.notes ?? null],
  );
  if (result.changes === 0) {
    // `exercises.name` is UNIQUE and case-SENSITIVE, so the row that blocked the
    // insert is the exact-case match. Matching on LOWER() here could bind to a
    // different-cased row than the one that actually conflicted.
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM exercises WHERE name = ?',
      [input.name.trim()],
    );
    return existing!.id;
  }
  return result.lastInsertRowId as number;
}
