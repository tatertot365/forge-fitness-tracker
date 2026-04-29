import type { SQLiteDatabase } from 'expo-sqlite';

type ExerciseSeed = { name: string; muscle_group: string; notes: string | null };

const EXERCISES: ExerciseSeed[] = [
  // Chest
  { name: 'Flat barbell bench press',           muscle_group: 'chest',           notes: null },
  { name: 'Incline barbell bench press',         muscle_group: 'chest',           notes: null },
  { name: 'Decline barbell bench press',         muscle_group: 'chest',           notes: null },
  { name: 'Flat dumbbell press',                 muscle_group: 'chest',           notes: null },
  { name: 'Incline dumbbell press',              muscle_group: 'chest',           notes: 'Elbows at 45°, full stretch at bottom' },
  { name: 'Machine chest press',                 muscle_group: 'chest',           notes: null },
  { name: 'Machine chest fly',                   muscle_group: 'chest',           notes: 'Squeeze hard at peak contraction' },
  { name: 'Cable crossover',                     muscle_group: 'chest',           notes: null },
  { name: 'Push-up',                             muscle_group: 'chest',           notes: null },

  // Shoulders
  { name: 'Dumbbell overhead press',             muscle_group: 'shoulders',       notes: null },
  { name: 'Barbell overhead press',              muscle_group: 'shoulders',       notes: null },
  { name: 'Machine shoulder press',              muscle_group: 'shoulders',       notes: null },
  { name: 'Dumbbell lateral raise',              muscle_group: 'shoulders',       notes: null },
  { name: 'Cable lateral raise',                 muscle_group: 'shoulders',       notes: 'Low pulley, single arm — constant tension' },
  { name: 'Cable face pull',                     muscle_group: 'shoulders',       notes: 'Rope attachment, pull to forehead level' },
  { name: 'Rear delt dumbbell fly',              muscle_group: 'shoulders',       notes: null },
  { name: 'Rear delt machine fly',               muscle_group: 'shoulders',       notes: null },

  // Triceps
  { name: 'Cable rope pushdown',                 muscle_group: 'triceps',         notes: 'Flare rope at bottom — lateral head' },
  { name: 'Cable bar pushdown',                  muscle_group: 'triceps',         notes: null },
  { name: 'Overhead dumbbell tricep extension',  muscle_group: 'triceps',         notes: 'Single arm, deep stretch — long head' },
  { name: 'Cable overhead tricep extension',     muscle_group: 'triceps',         notes: null },
  { name: 'Skull crusher',                       muscle_group: 'triceps',         notes: null },
  { name: 'Close-grip bench press',              muscle_group: 'triceps',         notes: null },
  { name: 'Dip',                                 muscle_group: 'triceps',         notes: 'Upright torso for tricep focus' },

  // Back — width
  { name: 'Wide grip pull-up',                   muscle_group: 'back-width',      notes: 'Full hang at bottom, chin over bar at top' },
  { name: 'Wide grip lat pulldown',              muscle_group: 'back-width',      notes: 'Drive elbows down and back' },
  { name: 'Single arm lat pulldown',             muscle_group: 'back-width',      notes: null },
  { name: 'Cable straight arm pulldown',         muscle_group: 'back-width',      notes: 'Constant tension — pure lat width builder' },
  { name: 'Dumbbell pullover',                   muscle_group: 'back-width',      notes: 'Slight bend in elbow, big stretch at top' },

  // Back — thickness
  { name: 'Deadlift',                            muscle_group: 'back-thickness',  notes: 'Hip hinge, brace core' },
  { name: 'Barbell bent-over row',               muscle_group: 'back-thickness',  notes: 'Overhand grip — primary thickness builder' },
  { name: 'Chest-supported dumbbell row',        muscle_group: 'back-thickness',  notes: 'Removes lower back fatigue' },
  { name: 'Single arm dumbbell row',             muscle_group: 'back-thickness',  notes: null },
  { name: 'Seated cable row',                    muscle_group: 'back-thickness',  notes: 'Close grip, drive elbows behind torso' },
  { name: 'T-bar row',                           muscle_group: 'back-thickness',  notes: null },
  { name: 'Machine row',                         muscle_group: 'back-thickness',  notes: null },

  // Biceps
  { name: 'Barbell curl',                        muscle_group: 'biceps',          notes: null },
  { name: 'Reverse grip barbell curl',           muscle_group: 'biceps',          notes: null },
  { name: 'Dumbbell curl',                       muscle_group: 'biceps',          notes: 'Supinate at top' },
  { name: 'Seated dumbbell curl',                muscle_group: 'biceps',          notes: 'Supinate at top' },
  { name: 'Incline dumbbell curl',               muscle_group: 'biceps',          notes: 'Long head stretch' },
  { name: 'Hammer curl',                         muscle_group: 'biceps',          notes: null },
  { name: 'Cable curl',                          muscle_group: 'biceps',          notes: null },
  { name: 'Preacher machine curl',               muscle_group: 'biceps',          notes: null },

  // Grip
  { name: 'Dumbbell farmer carry',               muscle_group: 'grip',            notes: '30–40 meters per set' },
  { name: 'Barbell farmer carry',                muscle_group: 'grip',            notes: null },
  { name: 'Plate pinch',                         muscle_group: 'grip',            notes: null },
  { name: 'Dead hang',                           muscle_group: 'grip',            notes: null },

  // Quads
  { name: 'Barbell back squat',                  muscle_group: 'quads',           notes: 'Go deep, brace core' },
  { name: 'Front squat',                         muscle_group: 'quads',           notes: null },
  { name: 'Bulgarian split squat',               muscle_group: 'quads',           notes: 'Rear foot elevated' },
  { name: 'Leg press',                           muscle_group: 'quads',           notes: null },
  { name: 'Hack squat',                          muscle_group: 'quads',           notes: null },
  { name: 'Leg extension',                       muscle_group: 'quads',           notes: 'Slow eccentric' },
  { name: 'Walking lunge',                       muscle_group: 'quads',           notes: null },

  // Hamstrings
  { name: 'Romanian deadlift',                   muscle_group: 'hamstrings',      notes: 'Hip hinge, big hamstring stretch' },
  { name: 'Lying leg curl',                      muscle_group: 'hamstrings',      notes: null },
  { name: 'Seated leg curl',                     muscle_group: 'hamstrings',      notes: null },
  { name: 'Nordic curl',                         muscle_group: 'hamstrings',      notes: null },
  { name: 'Good morning',                        muscle_group: 'hamstrings',      notes: null },
  { name: 'Stiff-leg deadlift',                  muscle_group: 'hamstrings',      notes: null },

  // Glutes
  { name: 'Hip thrust',                          muscle_group: 'glutes',          notes: 'Drive through heel' },
  { name: 'Barbell hip thrust',                  muscle_group: 'glutes',          notes: null },
  { name: 'Cable kickback',                      muscle_group: 'glutes',          notes: null },
  { name: 'Sumo deadlift',                       muscle_group: 'glutes',          notes: null },
  { name: 'Hip abduction machine',               muscle_group: 'glutes',          notes: null },
  { name: 'Glute bridge',                        muscle_group: 'glutes',          notes: null },

  // Calves
  { name: 'Standing calf raise',                 muscle_group: 'calves',          notes: 'Full stretch at bottom, pause at top' },
  { name: 'Seated calf raise',                   muscle_group: 'calves',          notes: null },
  { name: 'Leg press calf raise',                muscle_group: 'calves',          notes: null },
  { name: 'Single leg calf raise',               muscle_group: 'calves',          notes: null },

  // Core
  { name: 'Hanging leg raise',                   muscle_group: 'core',            notes: 'Control the negative' },
  { name: 'Ab wheel rollout',                    muscle_group: 'core',            notes: 'From knees, brace hard' },
  { name: 'Cable crunch',                        muscle_group: 'core',            notes: null },
  { name: 'Decline sit-up',                      muscle_group: 'core',            notes: null },
  { name: 'Plank',                               muscle_group: 'core',            notes: null },
  { name: 'Russian twist',                       muscle_group: 'core',            notes: null },
];

export async function seedIfNeeded(db: SQLiteDatabase): Promise<void> {
  const seeded = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'seeded'`,
  );
  if (seeded?.value === 'library-v2') return;

  const existingPhase = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'phase'`,
  );
  if (!existingPhase) {
    await db.runAsync(`INSERT INTO settings (key, value) VALUES ('phase', 'maintain')`);
  }

  for (const ex of EXERCISES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO exercises (name, muscle_group, notes) VALUES (?, ?, ?)`,
      [ex.name, ex.muscle_group, ex.notes],
    );
  }

  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('seeded', 'library-v2')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}
