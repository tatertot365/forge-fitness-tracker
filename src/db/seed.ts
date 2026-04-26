import type { SQLiteDatabase } from 'expo-sqlite';
import type { Day, MuscleGroup } from '../types';
import { muscleAccent } from '../theme/colors';

type SeedExercise = {
  muscle_group: MuscleGroup;
  name: string;
  sets: number;
  rep_range: string;
  notes: string | null;
};

const PUSH: SeedExercise[] = [
  { muscle_group: 'chest', name: 'Flat barbell bench press', sets: 4, rep_range: '6–10', notes: 'Alternate with dumbbell bench each session' },
  { muscle_group: 'chest', name: 'Incline dumbbell press', sets: 3, rep_range: '10–12', notes: 'Elbows at 45°, full stretch at bottom' },
  { muscle_group: 'chest', name: 'Machine chest fly', sets: 2, rep_range: '12–15', notes: 'Finisher — squeeze hard at peak contraction' },

  { muscle_group: 'shoulders', name: 'Dumbbell overhead press', sets: 2, rep_range: '8–10', notes: 'Reduced to 2 sets — volume shifted to laterals' },
  { muscle_group: 'shoulders', name: 'Dumbbell lateral raise', sets: 5, rep_range: '12–15', notes: 'Primary V-taper builder' },
  { muscle_group: 'shoulders', name: 'Cable lateral raise', sets: 2, rep_range: '15–20', notes: 'Low pulley, single arm — constant tension' },
  { muscle_group: 'shoulders', name: 'Cable face pull', sets: 4, rep_range: '15', notes: 'Rope attachment, pull to forehead level' },

  { muscle_group: 'triceps', name: 'Cable rope pushdown', sets: 3, rep_range: '10–12', notes: 'Flare rope at bottom — lateral head' },
  { muscle_group: 'triceps', name: 'Overhead dumbbell tricep extension', sets: 3, rep_range: '10–12', notes: 'Single arm, deep stretch — long head' },
];

const BICEPS_BLOCK: SeedExercise[] = [
  { muscle_group: 'biceps', name: 'Barbell curl / reverse grip curl (superset)', sets: 3, rep_range: '12/12', notes: 'No rest between grips' },
  { muscle_group: 'biceps', name: 'Seated dumbbell curl', sets: 3, rep_range: '10–12', notes: 'Supinate at top' },
  { muscle_group: 'biceps', name: 'Preacher machine curl (drop set)', sets: 2, rep_range: '15→20', notes: 'No rest between drops' },
];

const TUESDAY: SeedExercise[] = [
  { muscle_group: 'back-width', name: 'Wide grip pull-up', sets: 4, rep_range: 'failure', notes: 'Full hang at bottom, chin over bar at top' },
  { muscle_group: 'back-width', name: 'Wide grip lat pulldown', sets: 3, rep_range: '10–12', notes: 'Drive elbows down and back' },
  { muscle_group: 'back-width', name: 'Cable straight arm pulldown', sets: 3, rep_range: '12–15', notes: 'Constant tension — best pure lat width builder' },
  { muscle_group: 'back-width', name: 'Dumbbell pullover', sets: 3, rep_range: '12–15', notes: 'Slight bend in elbow, big stretch at top' },
  ...BICEPS_BLOCK,
  { muscle_group: 'grip', name: 'Dumbbell farmer carry', sets: 3, rep_range: '30–40 m', notes: 'Heavy — 30–40 meters per set' },
];

const CALVES_CORE: SeedExercise[] = [
  { muscle_group: 'calves', name: 'Standing calf raise', sets: 4, rep_range: '12–15', notes: 'Full stretch at bottom, pause at top' },
  { muscle_group: 'calves', name: 'Seated calf raise', sets: 3, rep_range: '30', notes: '10 toes out / 10 neutral / 10 toes in' },
  { muscle_group: 'core', name: 'Hanging leg raise', sets: 3, rep_range: '15', notes: 'Control the negative' },
  { muscle_group: 'core', name: 'Ab wheel rollout', sets: 2, rep_range: 'failure', notes: 'From knees, brace hard' },
];

const WEDNESDAY: SeedExercise[] = [
  { muscle_group: 'quads', name: 'Barbell back squat', sets: 4, rep_range: '6–10', notes: 'Primary quad builder — go deep, brace core' },
  { muscle_group: 'quads', name: 'Bulgarian split squat', sets: 3, rep_range: '10–12', notes: 'Rear foot elevated' },
  { muscle_group: 'quads', name: 'Leg press', sets: 3, rep_range: '10–12', notes: 'Alternate with hack squat each week' },
  { muscle_group: 'quads', name: 'Leg extension (drop set)', sets: 2, rep_range: '15→15', notes: 'Slow eccentric' },
  ...CALVES_CORE,
];

const FRIDAY: SeedExercise[] = [
  { muscle_group: 'back-thickness', name: 'Deadlift', sets: 4, rep_range: '6–8', notes: 'Hip hinge, brace core' },
  { muscle_group: 'back-thickness', name: 'Barbell bent-over row', sets: 4, rep_range: '8–10', notes: 'Overhand grip — primary thickness builder' },
  { muscle_group: 'back-thickness', name: 'Chest-supported dumbbell row', sets: 3, rep_range: '10–12', notes: 'Removes lower back fatigue' },
  { muscle_group: 'back-thickness', name: 'Seated cable row', sets: 3, rep_range: '10–12', notes: 'Close grip, drive elbows behind torso' },
  ...BICEPS_BLOCK,
];

const SATURDAY: SeedExercise[] = [
  { muscle_group: 'hamstrings-glutes', name: 'Lying leg curl', sets: 3, rep_range: '12–15', notes: 'Pre-fatigue before RDL' },
  { muscle_group: 'hamstrings-glutes', name: 'Romanian deadlift', sets: 4, rep_range: '8–10', notes: 'Hip hinge, big hamstring stretch' },
  { muscle_group: 'hamstrings-glutes', name: 'Walking lunge', sets: 3, rep_range: '10/leg', notes: 'Progress to barbell loading' },
  { muscle_group: 'hamstrings-glutes', name: 'Hip thrust', sets: 2, rep_range: '12', notes: 'Drive through heel' },
  ...CALVES_CORE,
];

const PLAN: Record<Day, SeedExercise[]> = {
  monday: PUSH,
  tuesday: TUESDAY,
  wednesday: WEDNESDAY,
  thursday: PUSH,
  friday: FRIDAY,
  saturday: SATURDAY,
  sunday: [],
};

export async function seedIfNeeded(db: SQLiteDatabase): Promise<void> {
  const seeded = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['seeded'],
  );
  if (seeded?.value === 'v5') return;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exercises');
    for (const day of Object.keys(PLAN) as Day[]) {
      const items = PLAN[day];
      for (let i = 0; i < items.length; i++) {
        const ex = items[i];
        await db.runAsync(
          `INSERT INTO exercises (day, muscle_group, name, sets, rep_range, notes, sort_order, accent_color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            day,
            ex.muscle_group,
            ex.name,
            ex.sets,
            ex.rep_range,
            ex.notes,
            i,
            muscleAccent[ex.muscle_group],
          ],
        );
      }
    }
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES ('seeded', 'v5')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    const existingPhase = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['phase'],
    );
    if (!existingPhase) {
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES ('phase', 'maintain')`,
      );
    }
  });
}
