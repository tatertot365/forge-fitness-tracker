import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import { useStyles } from '../theme/useStyles';

type Props = {
  name: string;
  sets: number;
  repRange: string;
  lastSet?: string | null;
  completed: number;
  accentColor: string;
  onPress: () => void;
  notes?: string | null;
  typeBadge?: 'drop' | 'superset' | 'bodyweight' | null;
  partnerName?: string | null;
};

export function ExerciseRow({
  name,
  sets,
  repRange,
  lastSet,
  completed,
  accentColor,
  onPress,
  notes,
  typeBadge,
  partnerName,
}: Props) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.counter}>
            {completed}/{sets}
          </Text>
        </View>
        <Text style={styles.meta}>
          {sets} sets · {repRange}
        </Text>
        {typeBadge === 'drop' ? (
          <View style={[styles.badge, { backgroundColor: colors.purple + '1F' }]}>
            <Text style={[styles.badgeText, { color: colors.purple }]}>Drop set</Text>
          </View>
        ) : null}
        {typeBadge === 'superset' ? (
          <View style={[styles.badge, { backgroundColor: colors.primary + '1F' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]} numberOfLines={1}>
              Superset{partnerName ? ` · ${partnerName}` : ''}
            </Text>
          </View>
        ) : null}
        {typeBadge === 'bodyweight' ? (
          <View style={[styles.badge, { backgroundColor: colors.green + '1F' }]}>
            <Text style={[styles.badgeText, { color: colors.green }]}>Bodyweight</Text>
          </View>
        ) : null}
        {lastSet ? <Text style={styles.lastSet}>Last: {lastSet}</Text> : null}
        {notes ? <Text style={styles.notes} numberOfLines={2}>{notes}</Text> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  accent: {
    width: 3,
    marginVertical: 10,
    marginLeft: 10,
    borderRadius: radius.accent,
  },
  body: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.exerciseName,
    fontSize: s(14),
    color: colors.text,
    flex: 1,
    paddingRight: 12,
  },
  counter: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
  },
  lastSet: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  notes: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  badgeText: {
    fontSize: s(11),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
