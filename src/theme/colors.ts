export const colors = {
  primary: '#0F2D5E',   // deep navy
  gold: '#C9A060',      // warm gold
  purple: '#8B5CF6',    // violet
  teal: '#14B8A6',      // teal
  gray: '#78716C',      // warm stone
  red: '#EF4444',
  green: '#22C55E',
  amber: '#F59E0B',
  warning: '#F97316',   // orange, distinct from red

  text: '#111111',
  textSecondary: '#5C5C5C',
  textMuted: '#9A9A9A',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.15)',
  background: '#FAF6EE',  // warm ivory
  card: '#FFFDF5',        // warm white
} as const;

export const phaseColor: Record<'cut' | 'maintain' | 'bulk', string> = {
  cut: colors.primary,
  maintain: colors.green,
  bulk: colors.amber,
};

export const muscleAccent: Record<string, string> = {
  chest: '#F97316',           // orange
  shoulders: '#8B5CF6',       // violet
  triceps: '#06B6D4',         // cyan
  'back-width': '#3B82F6',    // blue
  'back-thickness': '#6366F1', // indigo
  biceps: '#EC4899',          // rose
  grip: '#78716C',            // stone
  quads: '#F59E0B',           // amber
  'hamstrings-glutes': '#10B981', // emerald
  calves: '#14B8A6',          // teal
  core: '#A855F8',            // purple
};
