import type { Phase } from '../types';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Sex = 'male' | 'female';

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary:   'Sedentary (desk job, no exercise)',
  light:       'Lightly active (1–2 days/week)',
  moderate:    'Moderately active (3–4 days/week)',
  active:      'Active (5–6 days/week)',
  very_active: 'Very active (2x/day or physical job)',
};

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

// Cut/bulk scaled to TDEE so the deficit/surplus makes sense at any body size.
const PHASE_TDEE_MULTIPLIER: Record<Phase, number> = {
  cut:      0.80,
  maintain: 1.00,
  bulk:     1.10,
};

const CALORIE_FLOOR_MALE = 1500;
const CALORIE_FLOOR_FEMALE = 1200;
const CALORIE_FLOOR_UNKNOWN_SEX = 1500;

const PROTEIN_CAP_G = 250;

export type UserProfile = {
  height_in: number | null;
  dob: string | null;
  sex: Sex | null;
};

function ageFromDob(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export type MacroGoals = {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

export type TdeeInput = {
  weight_lb: number;
  body_fat_pct: number | null;
  profile: UserProfile;
  activity: ActivityLevel;
  phase: Phase;
};

export type TdeeResult =
  | { ok: true; goals: MacroGoals; tdee: number; bmr: number; note: string | null }
  | { ok: false; reason: string };

export function calculateTdee(input: TdeeInput): TdeeResult {
  const { weight_lb, body_fat_pct, profile, activity, phase } = input;

  const weight_kg = weight_lb * 0.453592;
  let bmr: number;
  let lean_lb: number | null = null;
  const notes: string[] = [];

  if (body_fat_pct != null && body_fat_pct > 0 && body_fat_pct < 100) {
    // Katch-McArdle — most accurate, no height/age/sex needed
    const lean_kg = weight_kg * (1 - body_fat_pct / 100);
    lean_lb = weight_lb * (1 - body_fat_pct / 100);
    bmr = 370 + 21.6 * lean_kg;
  } else {
    // Mifflin-St Jeor fallback — requires height, dob, sex
    if (!profile.height_in || !profile.dob || !profile.sex) {
      const missing: string[] = [];
      if (!profile.height_in) missing.push('height');
      if (!profile.dob) missing.push('date of birth');
      if (!profile.sex) missing.push('sex');
      return {
        ok: false,
        reason: `To calculate without body fat %, please add your ${missing.join(', ')} in the Measurements tab.`,
      };
    }
    const age = ageFromDob(profile.dob);
    const height_cm = profile.height_in * 2.54;
    const sexOffset = profile.sex === 'male' ? 5 : -161;
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + sexOffset;
    notes.push('Estimated from height, age & sex — log body fat % for a more accurate result.');
  }

  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];
  let targetCals = tdee * PHASE_TDEE_MULTIPLIER[phase];

  // Calorie floor — never drop below a safe minimum.
  const floor =
    profile.sex === 'female'
      ? CALORIE_FLOOR_FEMALE
      : profile.sex === 'male'
        ? CALORIE_FLOOR_MALE
        : CALORIE_FLOOR_UNKNOWN_SEX;
  if (targetCals < floor) {
    notes.push(
      `Goal raised to ${floor} kcal minimum — your TDEE is low, so consider a smaller deficit or more activity instead of eating less.`,
    );
    targetCals = floor;
  }
  targetCals = Math.round(targetCals);

  // Protein: lean-mass-based when BF% known (1.0/1.1 g/lb LBM — Helms et al.),
  // bodyweight-based otherwise at a lower multiplier (0.7/0.8 g/lb BW — ISSN
  // / Morton et al. evidence-backed range) since total bodyweight overshoots
  // for higher-BF individuals. Capped to avoid absurd numbers.
  const proteinPerLb = lean_lb != null
    ? (phase === 'cut' ? 1.1 : 1.0)
    : (phase === 'cut' ? 0.8 : 0.7);
  let protein_g = Math.round((lean_lb ?? weight_lb) * proteinPerLb);
  if (protein_g > PROTEIN_CAP_G) protein_g = PROTEIN_CAP_G;

  // Fat: start at 25% of calories; if protein + fat overshoot the target,
  // step fat down toward 20% before squeezing carbs to zero.
  let fatPct = 0.25;
  let fat_g = Math.round((targetCals * fatPct) / 9);
  let carbCals = targetCals - protein_g * 4 - fat_g * 9;

  if (carbCals < 0) {
    // Try trimming fat down to 20% first.
    fatPct = 0.20;
    fat_g = Math.round((targetCals * fatPct) / 9);
    carbCals = targetCals - protein_g * 4 - fat_g * 9;
  }

  if (carbCals < 0) {
    // Still negative — reduce protein to fit, keeping fat at 20%.
    const proteinCalsAllowed = targetCals - fat_g * 9;
    protein_g = Math.max(0, Math.floor(proteinCalsAllowed / 4));
    carbCals = targetCals - protein_g * 4 - fat_g * 9;
    notes.push(
      'Protein trimmed to fit calorie target — your calorie goal is unusually low for your bodyweight.',
    );
  }

  const carbs_g = Math.max(0, Math.round(carbCals / 4));

  return {
    ok: true,
    goals: { calories: targetCals, protein_g, fat_g, carbs_g },
    tdee: Math.round(tdee),
    bmr: Math.round(bmr),
    note: notes.length > 0 ? notes.join(' ') : null,
  };
}
