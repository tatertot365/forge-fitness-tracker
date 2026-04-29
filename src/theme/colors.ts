export const colors = {
  primary: '#E8640C',        // molten orange
  gold: '#D4915A',           // hammered copper — warm secondary accent
  purple: '#A78BFA',         // violet (lightened for dark bg)
  teal: '#2DD4BF',           // teal (lightened for dark bg)
  gray: '#8A8680',           // ash gray
  red: '#F87171',            // red (lightened for dark bg)
  green: '#4ADE80',          // green (lightened for dark bg)
  amber: '#FBBF24',          // bright amber
  warning: '#FB923C',        // orange warning, distinct from primary

  text: '#F2EDEA',           // warm off-white
  textSecondary: '#9E9690',  // warm mid-gray
  textMuted: '#655F5C',      // dark muted
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.16)',
  background: '#111010',     // near-black charcoal
  card: '#1C1B1A',           // slightly lighter dark
} as const;

export const phaseColor: Record<'cut' | 'maintain' | 'bulk', string> = {
  cut: colors.primary,
  maintain: colors.green,
  bulk: colors.amber,
};

export const muscleAccent: Record<string, string> = {
  chest: '#FB923C',           // orange-400 — primary muscle, warm
  shoulders: '#A78BFA',       // violet-400
  triceps: '#22D3EE',         // cyan-400
  'back-width': '#60A5FA',    // blue-400
  'back-thickness': '#818CF8',// indigo-400
  biceps: '#F472B6',          // rose-400
  grip: '#A09890',            // ash
  quads: '#FBBF24',           // amber-400
  hamstrings: '#34D399',          // emerald-400
  glutes: '#6EE7B7',             // emerald-300 (lighter variant)
  calves: '#2DD4BF',          // teal-400
  core: '#C084FC',            // purple-400
};
