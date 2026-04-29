import type { Phase } from '../types';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

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

export type MacroGoals = {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

export type TdeeInput = {
  weight_lb: number;
  body_fat_pct: number | null;
  activity: ActivityLevel;
  phase: Phase;
};

export type TdeeResult =
  | { ok: true; goals: MacroGoals; tdee: number; bmr: number; note: string | null }
  | { ok: false; reason: string };

export function calculateTdee(input: TdeeInput): TdeeResult {
  const { weight_lb, body_fat_pct, activity, phase } = input;

  const weight_kg = weight_lb * 0.453592;
  let bmr: number;
  let note: string | null = null;

  if (body_fat_pct != null && body_fat_pct > 0 && body_fat_pct < 100) {
    // Katch-McArdle: uses lean body mass — most accurate when body fat is known
    const lean_kg = weight_kg * (1 - body_fat_pct / 100);
    bmr = 370 + 21.6 * lean_kg;
  } else {
    // Mifflin-St Jeor fallback (male, assumes ~30 years old, 5'10" / 178cm)
    // since we don't collect height/age — less accurate but reasonable
    bmr = 10 * weight_kg + 6.25 * 178 - 5 * 30 + 5;
    note = 'Estimated from weight only — log body fat % for a more accurate result.';
  }

  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];
  const targetCals = Math.round(tdee + PHASE_CALORIE_DELTA[phase]);

  // Macro split by phase
  let proteinMultiplier: number;
  let fatPct: number;

  if (phase === 'cut') {
    proteinMultiplier = 1.1; // higher protein to preserve muscle
    fatPct = 0.25;
  } else if (phase === 'bulk') {
    proteinMultiplier = 1.0;
    fatPct = 0.25;
  } else {
    proteinMultiplier = 1.0;
    fatPct = 0.25;
  }

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
