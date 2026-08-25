import type { SQLiteDatabase } from 'expo-sqlite';

type ExerciseSeed = { name: string; muscle_group: string; notes: string | null };

type StretchSeed = {
  name: string;
  muscle_group: string;
  hold_seconds: number;
  per_side: 0 | 1;
  notes: string | null;
};

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
  { name: 'Close grip lat pulldown',             muscle_group: 'back-width',      notes: 'V-bar — deeper stretch, more lower lat' },
  { name: 'Reverse grip lat pulldown',           muscle_group: 'back-width',      notes: 'Underhand — lats with bicep assistance' },
  { name: 'Kneeling cable pulldown',             muscle_group: 'back-width',      notes: 'Rope overhead, kneel and pull to the chest' },
  { name: 'Assisted pull-up',                    muscle_group: 'back-width',      notes: 'Machine or band — build to unassisted reps' },

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
  { name: 'Wrist curl',                          muscle_group: 'grip',            notes: 'Forearms on bench, wrists off the edge' },
  { name: 'Reverse wrist curl',                  muscle_group: 'grip',            notes: 'Palms down — forearm extensors' },
  { name: 'Towel pull-up hang',                  muscle_group: 'grip',            notes: 'Hang from a towel over the bar — thick-grip work' },
  { name: 'Fat grip hold',                       muscle_group: 'grip',            notes: 'Thick bar or grips, hold for time' },
  { name: 'Captains of Crush gripper',           muscle_group: 'grip',            notes: 'Crush grip — work in low reps' },
  { name: 'Suitcase carry',                      muscle_group: 'grip',            notes: 'Single side loaded — grip plus anti-lateral-flexion' },

  // Traps
  { name: 'Barbell shrug',                       muscle_group: 'traps',           notes: null },
  { name: 'Dumbbell shrug',                      muscle_group: 'traps',           notes: null },
  { name: 'Cable shrug',                         muscle_group: 'traps',           notes: 'Low pulley — constant tension' },
  { name: 'Behind-the-back barbell shrug',       muscle_group: 'traps',           notes: 'Hits lower trap fibres' },
  { name: 'Face pull with shrug',                muscle_group: 'traps',           notes: 'Rope attachment, shrug at peak contraction' },
  { name: 'Smith machine shrug',                 muscle_group: 'traps',           notes: 'Fixed path — lets you overload the shrug safely' },
  { name: 'Trap bar shrug',                      muscle_group: 'traps',           notes: 'Neutral grip, bar at the sides' },
  { name: 'Overhead shrug',                      muscle_group: 'traps',           notes: 'Bar locked overhead — upper and lower traps' },
  { name: 'Prone Y raise',                       muscle_group: 'traps',           notes: 'Face down on incline, arms to a Y — lower traps' },
  { name: 'Farmer carry shrug',                  muscle_group: 'traps',           notes: 'Shrug at the top of each step' },

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
  { name: 'Single-leg Romanian deadlift',        muscle_group: 'hamstrings',      notes: 'Balance and hinge — strong unilateral stretch' },
  { name: 'Cable pull-through',                  muscle_group: 'hamstrings',      notes: 'Rope between the legs, hinge and drive the hips' },
  { name: 'Glute-ham raise',                     muscle_group: 'hamstrings',      notes: 'GHD bench — control the eccentric' },
  { name: 'Standing single-leg curl',            muscle_group: 'hamstrings',      notes: 'One leg at a time on the machine' },

  // Glutes
  { name: 'Hip thrust',                          muscle_group: 'glutes',          notes: 'Drive through heel' },
  { name: 'Barbell hip thrust',                  muscle_group: 'glutes',          notes: null },
  { name: 'Cable kickback',                      muscle_group: 'glutes',          notes: null },
  { name: 'Sumo deadlift',                       muscle_group: 'glutes',          notes: null },
  { name: 'Hip abduction machine',               muscle_group: 'glutes',          notes: null },
  { name: 'Glute bridge',                        muscle_group: 'glutes',          notes: null },
  { name: 'Single-leg hip thrust',               muscle_group: 'glutes',          notes: null },
  { name: 'Donkey kick',                         muscle_group: 'glutes',          notes: null },
  { name: 'Machine hip thrust',                  muscle_group: 'glutes',          notes: 'Easier setup than the barbell version' },
  { name: 'Curtsy lunge',                        muscle_group: 'glutes',          notes: 'Step behind and across — glute medius' },
  { name: 'Reverse lunge',                       muscle_group: 'glutes',          notes: 'Step back — less knee stress than a forward lunge' },
  { name: 'Frog pump',                           muscle_group: 'glutes',          notes: 'Soles together, knees out — pure glute contraction' },

  // Calves
  { name: 'Standing calf raise',                 muscle_group: 'calves',          notes: 'Full stretch at bottom, pause at top' },
  { name: 'Seated calf raise',                   muscle_group: 'calves',          notes: null },
  { name: 'Leg press calf raise',                muscle_group: 'calves',          notes: null },
  { name: 'Single leg calf raise',               muscle_group: 'calves',          notes: null },
  { name: 'Donkey calf raise',                   muscle_group: 'calves',          notes: 'Hinged at hip — strong stretch on the gastroc' },
  { name: 'Smith machine calf raise',            muscle_group: 'calves',          notes: 'Easy to load heavy and control the pause' },
  { name: 'Hack squat calf raise',               muscle_group: 'calves',          notes: null },
  { name: 'Tibialis raise',                      muscle_group: 'calves',          notes: 'Toes toward shin — balances the calf, protects the knee' },
  { name: 'Farmer carry on toes',                muscle_group: 'calves',          notes: 'Walk on the balls of the feet' },
  { name: 'Seated calf raise machine',           muscle_group: 'calves',          notes: 'Bent knee — biases the soleus' },

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

const STRETCHES: StretchSeed[] = [
  // Chest
  { name: 'Doorway pec stretch',          muscle_group: 'chest',           hold_seconds: 30, per_side: 0, notes: 'Forearm on frame, step through' },
  { name: 'Floor pec stretch',            muscle_group: 'chest',           hold_seconds: 30, per_side: 1, notes: 'Prone, arm out at 90°, roll onto shoulder' },
  { name: "Child's pose with arm reach",  muscle_group: 'chest',           hold_seconds: 30, per_side: 0, notes: 'Press chest toward floor' },

  // Shoulders
  { name: 'Cross-body shoulder stretch',  muscle_group: 'shoulders',       hold_seconds: 30, per_side: 1, notes: 'Pull arm across chest with opposite hand' },
  { name: 'Sleeper stretch',              muscle_group: 'shoulders',       hold_seconds: 30, per_side: 1, notes: 'Side-lying, gently rotate forearm down' },
  { name: 'Behind-back towel stretch',    muscle_group: 'shoulders',       hold_seconds: 30, per_side: 1, notes: 'Top hand pulls towel up' },
  { name: 'Wall angel',                   muscle_group: 'shoulders',       hold_seconds: 30, per_side: 0, notes: 'Back flat to wall, slide arms up and down' },

  // Triceps
  { name: 'Overhead tricep stretch',      muscle_group: 'triceps',         hold_seconds: 30, per_side: 1, notes: 'Elbow up, opposite hand presses down' },
  { name: 'Cross-body tricep stretch',    muscle_group: 'triceps',         hold_seconds: 30, per_side: 1, notes: 'Arm across chest, bend elbow' },
  { name: 'Wall tricep stretch',          muscle_group: 'triceps',         hold_seconds: 30, per_side: 1, notes: 'Elbow bent against wall, lean in' },

  // Back — width
  { name: 'Lat hang',                     muscle_group: 'back-width',      hold_seconds: 30, per_side: 0, notes: 'Passive hang from bar, full stretch' },
  { name: "Child's pose lat stretch",     muscle_group: 'back-width',      hold_seconds: 30, per_side: 1, notes: 'Walk hands to opposite side' },
  { name: 'Doorway lat stretch',          muscle_group: 'back-width',      hold_seconds: 30, per_side: 1, notes: 'Grab frame, hinge at hip, sit back' },
  { name: 'Side-lying lat opener',        muscle_group: 'back-width',      hold_seconds: 30, per_side: 1, notes: 'Reach the top arm overhead and rotate open' },

  // Back — thickness
  { name: 'Cat-cow',                      muscle_group: 'back-thickness',  hold_seconds: 45, per_side: 0, notes: 'Flow between arch and round, controlled' },
  { name: 'Thoracic rotation',            muscle_group: 'back-thickness',  hold_seconds: 30, per_side: 1, notes: 'Quadruped, hand behind head, rotate up' },
  { name: 'Prone press-up',               muscle_group: 'back-thickness',  hold_seconds: 20, per_side: 0, notes: 'Cobra position, hips on floor' },
  { name: 'Seated forward fold',          muscle_group: 'back-thickness',  hold_seconds: 30, per_side: 0, notes: 'Round the spine gently, reach for the feet' },

  // Biceps
  { name: 'Wall bicep stretch',           muscle_group: 'biceps',          hold_seconds: 30, per_side: 1, notes: 'Palm on wall behind you, turn body away' },
  { name: 'Standing bicep stretch',       muscle_group: 'biceps',          hold_seconds: 30, per_side: 0, notes: 'Hands clasped behind back, lift arms' },
  { name: 'Doorway bicep stretch',        muscle_group: 'biceps',          hold_seconds: 30, per_side: 1, notes: 'Arm back on frame at shoulder height, turn away' },

  // Grip
  { name: 'Wrist flexor stretch',         muscle_group: 'grip',            hold_seconds: 20, per_side: 1, notes: 'Arm extended, pull fingers back' },
  { name: 'Wrist extensor stretch',       muscle_group: 'grip',            hold_seconds: 20, per_side: 1, notes: 'Arm extended, pull fingers down' },
  { name: 'Prayer stretch',               muscle_group: 'grip',            hold_seconds: 20, per_side: 0, notes: 'Palms together, lower hands to stretch the wrists' },

  // Traps
  { name: 'Upper trap stretch',           muscle_group: 'traps',           hold_seconds: 30, per_side: 1, notes: 'Ear to shoulder, opposite hand reaches down' },
  { name: 'Levator scapulae stretch',     muscle_group: 'traps',           hold_seconds: 30, per_side: 1, notes: 'Look toward armpit, gentle pull on head' },
  { name: 'Chin tuck',                    muscle_group: 'traps',           hold_seconds: 20, per_side: 0, notes: 'Draw the chin straight back — counters forward head posture' },

  // Quads
  { name: 'Standing quad stretch',        muscle_group: 'quads',           hold_seconds: 30, per_side: 1, notes: 'Heel to glute, knees together' },
  { name: 'Couch stretch',                muscle_group: 'quads',           hold_seconds: 45, per_side: 1, notes: 'Rear shin up wall/couch, lunge position' },
  { name: 'Kneeling hip flexor stretch',  muscle_group: 'quads',           hold_seconds: 30, per_side: 1, notes: 'Squeeze glute, push hips forward' },
  { name: 'Side-lying quad stretch',      muscle_group: 'quads',           hold_seconds: 30, per_side: 1, notes: 'Lie on side, pull heel toward glute' },

  // Hamstrings
  { name: 'Standing forward fold',        muscle_group: 'hamstrings',      hold_seconds: 30, per_side: 0, notes: 'Hinge at hips, soft knees if needed' },
  { name: 'Single-leg hamstring stretch', muscle_group: 'hamstrings',      hold_seconds: 30, per_side: 1, notes: 'Heel on bench, hinge forward' },
  { name: 'Supine hamstring stretch',     muscle_group: 'hamstrings',      hold_seconds: 30, per_side: 1, notes: 'Lying down, strap or hands around foot' },
  { name: 'Seated straddle stretch',      muscle_group: 'hamstrings',      hold_seconds: 45, per_side: 0, notes: 'Legs wide, hinge forward from the hips' },

  // Glutes
  { name: 'Pigeon pose',                  muscle_group: 'glutes',          hold_seconds: 45, per_side: 1, notes: 'Front shin parallel to body, hinge forward' },
  { name: 'Figure-4 stretch',             muscle_group: 'glutes',          hold_seconds: 30, per_side: 1, notes: 'Lying on back, ankle on opposite knee' },
  { name: 'Seated glute stretch',         muscle_group: 'glutes',          hold_seconds: 30, per_side: 1, notes: 'Ankle on opposite knee, hinge forward' },
  { name: '90/90 hip stretch',            muscle_group: 'glutes',          hold_seconds: 45, per_side: 1, notes: 'Both knees at 90°, rotate and lean over the front shin' },

  // Calves
  { name: 'Wall calf stretch',            muscle_group: 'calves',          hold_seconds: 30, per_side: 1, notes: 'Hands on wall, back leg straight, heel down' },
  { name: 'Downward dog calf pedal',      muscle_group: 'calves',          hold_seconds: 30, per_side: 0, notes: 'Alternate heel drops in downward dog' },
  { name: 'Seated calf stretch',          muscle_group: 'calves',          hold_seconds: 30, per_side: 1, notes: 'Leg extended, strap around ball of foot' },
  { name: 'Step calf drop',               muscle_group: 'calves',          hold_seconds: 30, per_side: 1, notes: 'Heel hangs off a step, let it sink' },

  // Core
  { name: 'Cobra pose',                   muscle_group: 'core',            hold_seconds: 30, per_side: 0, notes: 'Prone, press chest up, hips down' },
  { name: 'Seated spinal twist',          muscle_group: 'core',            hold_seconds: 30, per_side: 1, notes: 'Knee bent, opposite elbow outside knee' },
  { name: "Child's pose side reach",      muscle_group: 'core',            hold_seconds: 30, per_side: 1, notes: 'Walk hands to opposite side, stretch obliques' },
  { name: 'Standing side bend',           muscle_group: 'core',            hold_seconds: 30, per_side: 1, notes: 'Reach overhead and lean away — obliques' },
  { name: 'Supine twist',                 muscle_group: 'core',            hold_seconds: 30, per_side: 1, notes: 'On back, drop knees to one side, shoulders down' },
];

export async function seedIfNeeded(db: SQLiteDatabase): Promise<void> {
  const seeded = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'seeded'`,
  );
  if (seeded?.value === 'library-v5') return;

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

  // INSERT OR IGNORE on the UNIQUE name (schema_v5), matching how exercises
  // seed: new builtin stretches reach existing installs on a version bump,
  // while rows already present -- including any the user edited -- are left
  // untouched. The old empty-table gate meant added stretches only ever
  // reached brand-new installs.
  for (const s of STRETCHES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO stretches (name, muscle_group, hold_seconds, per_side, notes, builtin)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [s.name, s.muscle_group, s.hold_seconds, s.per_side, s.notes],
    );
  }

  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('seeded', 'library-v5')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}
