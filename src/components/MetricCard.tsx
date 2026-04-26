import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing, typography } from '../theme/spacing';

type Props = {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; positive: boolean } | null;
  accent?: string;
};

export function MetricCard({ label, value, unit, delta, accent }: Props) {
  return (
    <View style={[styles.card, accent ? { borderColor: accent, borderWidth: 1 } : null]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {delta ? (
        <Text style={[styles.delta, { color: delta.positive ? colors.green : colors.red }]}>
          {delta.value}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.cardY,
    paddingHorizontal: spacing.cardX,
    minHeight: 92,
    justifyContent: 'space-between',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  value: {
    ...typography.metricValue,
    color: colors.text,
  },
  unit: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  delta: {
    ...typography.caption,
    marginTop: 4,
    fontWeight: '500',
  },
});
