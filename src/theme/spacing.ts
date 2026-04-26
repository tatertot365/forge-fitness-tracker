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
