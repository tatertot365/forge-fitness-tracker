export const spacing = {
  screenX: 16,
  cardY: 14,
  cardX: 16,
  rowY: 13,
  rowX: 16,
  sectionGap: 16,
  cardGap: 12,
} as const;

export const radius = {
  card: 12,
  pill: 8,
  bar: 2,
  accent: 2,
} as const;

export const typography = {
  screenTitle: { fontSize: 22, fontWeight: '500' as const },
  metricValue: { fontSize: 22, fontWeight: '500' as const },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.77,
    textTransform: 'uppercase' as const,
  },
  exerciseName: { fontSize: 14, fontWeight: '500' as const },
  body: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

// Reference width = iPhone 14 (390pt). Smaller phones (SE = 375pt) shrink
// modestly; larger phones (Pro Max = 430pt) grow modestly. The clamp keeps
// the design coherent across sizes — runaway scaling on Pro Max looks
// tablet-like and tiny text on SE hurts readability.
export const BASE_WIDTH = 390;
export const SCALE_MIN = 0.92;
export const SCALE_MAX = 1.1;

export const breakpoints = {
  sm: 380, // iPhone SE and similar
  md: 410, // standard iPhone (12/13/14/15)
  // anything wider than md is treated as "large" (Pro Max class)
} as const;

export function scale(value: number, width: number): number {
  const raw = (width / BASE_WIDTH);
  const factor = Math.max(SCALE_MIN, Math.min(SCALE_MAX, raw));
  return Math.round(value * factor);
}

// Canonical font size buckets that match the clusters already used across
// the app (11/12/13/15/18/22). Components should pull from this map via
// useResponsive so sizes stay consistent and scale together.
export const fontSizes = {
  xs: 11,
  sm: 12,
  body: 13,
  md: 15,
  lg: 18,
  xl: 22,
} as const;

export type FontSizeKey = keyof typeof fontSizes;
