export type Phase = 'cut' | 'maintain' | 'bulk';

export type Day =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'back-width'
  | 'back-thickness'
  | 'biceps'
  | 'grip'
  | 'quads'
  | 'hamstrings-glutes'
  | 'calves'
  | 'core';

export type ExerciseType = 'normal' | 'drop' | 'superset' | 'bodyweight';

export type Exercise = {
  id: number;
  day: Day;
  muscle_group: MuscleGroup;
  name: string;
  sets: number;
  rep_range: string;
  notes: string | null;
  sort_order: number;
  accent_color: string;
  type: ExerciseType;
  superset_partner_id: number | null;
};

export type Session = {
  id: number;
  day: Day;
  date: string;
  completed_at: string | null;
  hk_duration_minutes: number | null;
  hk_avg_hr: number | null;
  hk_calories: number | null;
};

export type SetLog = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  weight_lb: number | null;
  reps: number | null;
  completed: 0 | 1;
  drop_weight_lb: number | null;
  drop_reps: number | null;
};

export type FoodEntry = {
  id: number;
  date: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at: string;
};

export type NutritionGoal = {
  date: string;
  calorie_goal: number;
  protein_goal: number;
  fat_goal: number;
  carbs_goal: number;
};

export type FoodRecent = {
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  last_used_at: string;
};

export type DailyNutritionTotal = {
  date: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  calorie_goal: number;
  protein_goal: number;
  fat_goal: number;
  carbs_goal: number;
};

export type Measurement = {
  id: number;
  date: string;
  weight_lb: number | null;
  body_fat_pct: number | null;
  shoulders_in: number | null;
  waist_in: number | null;
  arms_flexed_in: number | null;
  chest_in: number | null;
  quads_in: number | null;
};

export type CardioSession = {
  id: number;
  date: string;
  created_at: string;
};

export type DayPlan = {
  day: Day;
  enabled: 0 | 1;
  focus: string;
};

export type CatchupItem = {
  exercise_id: number;
  exercise_name: string;
  muscle_group: MuscleGroup;
  day: Day;
  date_missed: string;
  sets_missed: number;
  days_ago: number;
};

export const DAYS: Day[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABEL: Record<Day, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DAY_FOCUS: Record<Day, string> = {
  monday: 'Push day',
  tuesday: 'Pull day — width',
  wednesday: 'Leg day — quads',
  thursday: 'Push day',
  friday: 'Pull day — thickness',
  saturday: 'Leg day — hamstrings',
  sunday: 'Rest day',
};

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  'back-width': 'Back — width',
  'back-thickness': 'Back — thickness',
  biceps: 'Biceps',
  grip: 'Grip',
  quads: 'Quads',
  'hamstrings-glutes': 'Hamstrings & Glutes',
  calves: 'Calves',
  core: 'Core',
};
