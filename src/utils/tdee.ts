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

const PHASE_CALORIE_DELTA: Record<Phase, number> = {
  cut:      -400,
  maintain: 0,
  bulk:     300,
};

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
  let note: string | null = null;

  if (body_fat_pct != null && body_fat_pct > 0 && body_fat_pct < 100) {
    // Katch-McArdle — most accurate, no height/age/sex needed
    const lean_kg = weight_kg * (1 - body_fat_pct / 100);
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
    note = 'Estimated from height, age & sex — log body fat % for a more accurate result.';
  }

  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];
  const targetCals = Math.round(tdee + PHASE_CALORIE_DELTA[phase]);

  const proteinMultiplier = phase === 'cut' ? 1.1 : 1.0;
  const fatPct = 0.25;

  const protein_g = Math.round(weight_lb * proteinMultiplier);
  const fat_g = Math.round((targetCals * fatPct) / 9);
  const carbCals = targetCals - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(carbCals / 4));

  return {
    ok: true,
    goals: { calories: targetCals, protein_g, fat_g, carbs_g },
    tdee: Math.round(tdee),
    bmr: Math.round(bmr),
    note,
  };
}
