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
  { name: 'Pec deck fly',                        muscle_group: 'chest',           notes: 'Squeeze hard at peak contraction' },
  { name: 'Decline dumbbell press',              muscle_group: 'chest',           notes: null },
  { name: 'Weighted dip',                        muscle_group: 'chest',           notes: 'Lean torso forward for chest focus' },
  { name: 'Low cable fly',                       muscle_group: 'chest',           notes: 'Low pulley, arms arc upward — upper chest' },

  // Shoulders
  { name: 'Dumbbell overhead press',             muscle_group: 'shoulders',       notes: null },
  { name: 'Barbell overhead press',              muscle_group: 'shoulders',       notes: null },
  { name: 'Machine shoulder press',              muscle_group: 'shoulders',       notes: null },
  { name: 'Dumbbell lateral raise',              muscle_group: 'shoulders',       notes: null },
  { name: 'Cable lateral raise',                 muscle_group: 'shoulders',       notes: 'Low pulley, single arm — constant tension' },
  { name: 'Cable face pull',                     muscle_group: 'shoulders',       notes: 'Rope attachment, pull to forehead level' },
  { name: 'Rear delt dumbbell fly',              muscle_group: 'shoulders',       notes: null },
  { name: 'Rear delt machine fly',               muscle_group: 'shoulders',       notes: null },
  { name: 'Arnold press',                        muscle_group: 'shoulders',       notes: 'Rotate palms outward as you press' },
  { name: 'Landmine press',                      muscle_group: 'shoulders',       notes: 'Shoulder-friendly pressing angle' },
  { name: 'Machine lateral raise',               muscle_group: 'shoulders',       notes: 'Easier to load progressively than dumbbells' },
  { name: 'Barbell upright row',                 muscle_group: 'shoulders',       notes: 'Elbows above wrists throughout' },

  // Triceps
  { name: 'Cable rope pushdown',                 muscle_group: 'triceps',         notes: 'Flare rope at bottom — lateral head' },
  { name: 'Cable bar pushdown',                  muscle_group: 'triceps',         notes: null },
  { name: 'Overhead dumbbell tricep extension',  muscle_group: 'triceps',         notes: 'Single arm, deep stretch — long head' },
  { name: 'Cable overhead tricep extension',     muscle_group: 'triceps',         notes: null },
  { name: 'Skull crusher',                       muscle_group: 'triceps',         notes: null },
  { name: 'Close-grip bench press',              muscle_group: 'triceps',         notes: null },
  { name: 'Dip',                                 muscle_group: 'triceps',         notes: 'Upright torso for tricep focus' },
  { name: 'Machine tricep extension',            muscle_group: 'triceps',         notes: null },
  { name: 'JM press',                            muscle_group: 'triceps',         notes: 'Hybrid skull crusher / close-grip — long head' },
  { name: 'Tricep kickback',                     muscle_group: 'triceps',         notes: 'Hinge at hip, upper arm parallel to floor' },

  // Back — width
  { name: 'Wide grip pull-up',                   muscle_group: 'back-width',      notes: 'Full hang at bottom, chin over bar at top' },
  { name: 'Wide grip lat pulldown',              muscle_group: 'back-width',      notes: 'Drive elbows down and back' },
  { name: 'Single arm lat pulldown',             muscle_group: 'back-width',      notes: null },
  { name: 'Cable straight arm pulldown',         muscle_group: 'back-width',      notes: 'Constant tension — pure lat width builder' },
  { name: 'Dumbbell pullover',                   muscle_group: 'back-width',      notes: 'Slight bend in elbow, big stretch at top' },
  { name: 'Chin-up',                             muscle_group: 'back-width',      notes: 'Underhand grip — more bicep contribution' },
  { name: 'Neutral grip pull-up',                muscle_group: 'back-width',      notes: 'Palms facing each other' },
  { name: 'Machine pullover',                    muscle_group: 'back-width',      notes: null },

  // Back — thickness
  { name: 'Deadlift',                            muscle_group: 'back-thickness',  notes: 'Hip hinge, brace core' },
  { name: 'Barbell bent-over row',               muscle_group: 'back-thickness',  notes: 'Overhand grip — primary thickness builder' },
  { name: 'Chest-supported dumbbell row',        muscle_group: 'back-thickness',  notes: 'Removes lower back fatigue' },
  { name: 'Single arm dumbbell row',             muscle_group: 'back-thickness',  notes: null },
  { name: 'Seated cable row',                    muscle_group: 'back-thickness',  notes: 'Close grip, drive elbows behind torso' },
  { name: 'T-bar row',                           muscle_group: 'back-thickness',  notes: null },
  { name: 'Machine row',                         muscle_group: 'back-thickness',  notes: null },
  { name: 'Pendlay row',                         muscle_group: 'back-thickness',  notes: 'Dead stop each rep — more explosive' },
  { name: 'Trap bar deadlift',                   muscle_group: 'back-thickness',  notes: 'More quad-friendly than conventional' },
  { name: 'Rack pull',                           muscle_group: 'back-thickness',  notes: 'Partial ROM from knee height — upper back focus' },
  { name: 'Seal row',                            muscle_group: 'back-thickness',  notes: 'Chest on bench — eliminates hip drive' },

  // Biceps
  { name: 'Barbell curl',                        muscle_group: 'biceps',          notes: null },
  { name: 'Reverse grip barbell curl',           muscle_group: 'biceps',          notes: null },
  { name: 'Dumbbell curl',                       muscle_group: 'biceps',          notes: 'Supinate at top' },
  { name: 'Seated dumbbell curl',                muscle_group: 'biceps',          notes: 'Supinate at top' },
  { name: 'Incline dumbbell curl',               muscle_group: 'biceps',          notes: 'Long head stretch' },
  { name: 'Hammer curl',                         muscle_group: 'biceps',          notes: null },
  { name: 'Cable curl',                          muscle_group: 'biceps',          notes: null },
  { name: 'Preacher machine curl',               muscle_group: 'biceps',          notes: null },
  { name: 'Concentration curl',                  muscle_group: 'biceps',          notes: 'Elbow braced on inner thigh' },
  { name: 'Zottman curl',                        muscle_group: 'biceps',          notes: 'Supinate up, pronate down — builds brachialis' },
  { name: 'Spider curl',                         muscle_group: 'biceps',          notes: 'Prone on incline bench — short head peak' },
  { name: 'Cross-body hammer curl',              muscle_group: 'biceps',          notes: 'Curl across body to opposite shoulder' },

  // Grip
  { name: 'Dumbbell farmer carry',               muscle_group: 'grip',            notes: '30–40 meters per set' },
  { name: 'Barbell farmer carry',                muscle_group: 'grip',            notes: null },
  { name: 'Plate pinch',                         muscle_group: 'grip',            notes: null },
  { name: 'Dead hang',                           muscle_group: 'grip',            notes: null },

  // Traps
  { name: 'Barbell shrug',                       muscle_group: 'traps',           notes: null },
  { name: 'Dumbbell shrug',                      muscle_group: 'traps',           notes: null },
  { name: 'Cable shrug',                         muscle_group: 'traps',           notes: 'Low pulley — constant tension' },
  { name: 'Behind-the-back barbell shrug',       muscle_group: 'traps',           notes: 'Hits lower trap fibres' },
  { name: 'Face pull with shrug',                muscle_group: 'traps',           notes: 'Rope attachment, shrug at peak contraction' },

  // Quads
  { name: 'Barbell back squat',                  muscle_group: 'quads',           notes: 'Go deep, brace core' },
  { name: 'Front squat',                         muscle_group: 'quads',           notes: null },
  { name: 'Bulgarian split squat',               muscle_group: 'quads',           notes: 'Rear foot elevated' },
  { name: 'Leg press',                           muscle_group: 'quads',           notes: null },
  { name: 'Hack squat',                          muscle_group: 'quads',           notes: null },
  { name: 'Leg extension',                       muscle_group: 'quads',           notes: 'Slow eccentric' },
  { name: 'Walking lunge',                       muscle_group: 'quads',           notes: null },
  { name: 'Smith machine squat',                 muscle_group: 'quads',           notes: null },
  { name: 'Step-up',                             muscle_group: 'quads',           notes: 'Drive through front heel' },
  { name: 'Sissy squat',                         muscle_group: 'quads',           notes: 'Knees travel far forward — terminal knee extension' },

  // Hamstrings
  { name: 'Romanian deadlift',                   muscle_group: 'hamstrings',      notes: 'Hip hinge, big hamstring stretch' },
  { name: 'Lying leg curl',                      muscle_group: 'hamstrings',      notes: null },
  { name: 'Seated leg curl',                     muscle_group: 'hamstrings',      notes: null },
  { name: 'Nordic curl',                         muscle_group: 'hamstrings',      notes: null },
  { name: 'Good morning',                        muscle_group: 'hamstrings',      notes: null },
  { name: 'Stiff-leg deadlift',                  muscle_group: 'hamstrings',      notes: null },
  { name: 'Trap bar RDL',                        muscle_group: 'hamstrings',      notes: null },
  { name: 'Kettlebell swing',                    muscle_group: 'hamstrings',      notes: 'Hip hinge — not a squat' },

  // Glutes
  { name: 'Hip thrust',                          muscle_group: 'glutes',          notes: 'Drive through heel' },
  { name: 'Barbell hip thrust',                  muscle_group: 'glutes',          notes: null },
  { name: 'Cable kickback',                      muscle_group: 'glutes',          notes: null },
  { name: 'Sumo deadlift',                       muscle_group: 'glutes',          notes: null },
  { name: 'Hip abduction machine',               muscle_group: 'glutes',          notes: null },
  { name: 'Glute bridge',                        muscle_group: 'glutes',          notes: null },
  { name: 'Single-leg hip thrust',               muscle_group: 'glutes',          notes: null },
  { name: 'Donkey kick',                         muscle_group: 'glutes',          notes: null },

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
  { name: 'Pallof press',                        muscle_group: 'core',            notes: 'Anti-rotation — resist twisting, don\'t move' },
  { name: 'Hollow body hold',                    muscle_group: 'core',            notes: 'Lower back pressed flat, legs and arms extended' },
  { name: 'Side plank',                          muscle_group: 'core',            notes: null },
  { name: 'Dragon flag',                         muscle_group: 'core',            notes: 'Full body lever — control the eccentric' },
  { name: 'Landmine rotation',                   muscle_group: 'core',            notes: 'Rotational power — keep arms straight' },
  { name: 'GHD sit-up',                          muscle_group: 'core',            notes: 'Full hip extension at bottom' },
];

export async function seedIfNeeded(db: SQLiteDatabase): Promise<void> {
  const seeded = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'seeded'`,
  );
  if (seeded?.value === 'library-v3') return;

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
    `INSERT INTO settings (key, value) VALUES ('seeded', 'library-v3')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}
