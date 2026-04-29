import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2, Flame, Heart, Plus, Timer, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AddExerciseSheet } from '../../src/components/AddExerciseSheet';
import { MuscleGroupPickerSheet } from '../../src/components/MuscleGroupPickerSheet';
import { Card } from '../../src/components/Card';
import { ExerciseRow } from '../../src/components/ExerciseRow';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import { SwipeableExerciseRow } from '../../src/components/SwipeableExerciseRow';
import {
  bestSet,
  deleteExercisesByGroup,
  finalizeSession,
  getDayPlans,
  getExercisesByDay,
  getLastCompletedSetsForExercise,
  getOrCreateSession,
  getSetLogsForSession,
  getSkippedExerciseIds,
  skipCatchupItem,
} from '../../src/db/queries';
import { fetchRecentWorkoutMetrics, type HealthMetrics } from '../../src/health';
import { colors, muscleAccent } from '../../src/theme/colors';
import { radius, typography } from '../../src/theme/spacing';
import {
  DAY_LABEL,
  MUSCLE_LABEL,
  type Day,
  type DayPlan,
  type Exercise,
  type MuscleGroup,
  type SetLog,
} from '../../src/types';
import { dayOfWeek, weekDates } from '../../src/utils/date';
import { hapticSuccess, hapticTap } from '../../src/utils/haptics';

type GroupedExercises = { group: MuscleGroup; items: Exercise[] }[];

export default function SessionScreen() {
  const router = useRouter();
  const day = dayOfWeek();
  const sessionDate = weekDates()[day];

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [lastBestMap, setLastBestMap] = useState<Record<number, string | null>>({});
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [addingToGroup, setAddingToGroup] = useState<MuscleGroup | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [summary, setSummary] = useState<null | {
    completed: number;
    total: number;
    volume: number;
    hk: HealthMetrics;
  }>(null);

  const load = useCallback(async () => {
    const plans = await getDayPlans();
    const plan = plans[day];
    setDayPlan(plan);
    if (!plan.enabled) {
      setExercises([]);
      setSessionId(null);
      setSetLogs([]);
      setLastBestMap({});
      return;
    }
    const sid = await getOrCreateSession(day, sessionDate);
    const [ex, logs, skippedIds] = await Promise.all([
      getExercisesByDay(day),
      getSetLogsForSession(sid),
      getSkippedExerciseIds(sessionDate),
    ]);
    const filtered = ex.filter((e) => !skippedIds.has(e.id));
    const lastMap: Record<number, string | null> = {};
    await Promise.all(
      filtered.map(async (e) => {
        const last = await getLastCompletedSetsForExercise(e.id, sid);
        const b = bestSet(last, e.type === 'bodyweight');
        lastMap[e.id] = e.type === 'bodyweight'
          ? b?.reps != null ? `${b.reps} reps` : null
          : b?.weight_lb != null && b.reps != null ? `${b.weight_lb} lb × ${b.reps}` : null;
      }),
    );
    setSessionId(sid);
    setExercises(filtered);
    setSetLogs(logs);
    setLastBestMap(lastMap);
  }, [day, sessionDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const grouped: GroupedExercises = useMemo(() => {
    const out: GroupedExercises = [];
    for (const e of exercises) {
      const last = out[out.length - 1];
      if (last && last.group === e.muscle_group) last.items.push(e);
      else out.push({ group: e.muscle_group, items: [e] });
    }
    return out;
  }, [exercises]);

  const completedByExercise = useMemo(() => {
    const map: Record<number, number> = {};
    for (const l of setLogs) {
      if (l.completed) map[l.exercise_id] = (map[l.exercise_id] ?? 0) + 1;
    }
    return map;
  }, [setLogs]);

  const nameById = useMemo(() => {
    const m: Record<number, string> = {};
    for (const e of exercises) m[e.id] = e.name;
    return m;
  }, [exercises]);

  const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
  const completedTotal = Object.values(completedByExercise).reduce((a, b) => a + b, 0);
  const volume = setLogs.reduce(
    (s, l) => s + (l.completed && l.weight_lb && l.reps ? l.weight_lb * l.reps : 0),
    0,
  );

  const onDeleteGroup = (group: MuscleGroup) => {
    const count = exercises.filter((e) => e.muscle_group === group).length;
    Alert.alert(
      `Remove ${MUSCLE_LABEL[group]}?`,
      `This will permanently delete ${count} exercise${count === 1 ? '' : 's'} and all their logged history from ${DAY_LABEL[day]}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteExercisesByGroup(day, group);
            hapticSuccess();
            await load();
          },
        },
      ],
    );
  };

  const onSkipExercise = async (ex: Exercise) => {
    await skipCatchupItem(ex.id, sessionDate);
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
  };

  const onFinish = async () => {
    if (!sessionId) return;
    const hk = await fetchRecentWorkoutMetrics();
    await finalizeSession(sessionId, hk);
    hapticSuccess();
    setSummary({ completed: completedTotal, total: totalSets, volume, hk });
  };

  const onCloseSummary = () => {
    setSummary(null);
    router.replace('/(tabs)');
  };

  if (dayPlan && !dayPlan.enabled) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.title}>Rest day</Text>
          <Text style={styles.subtitle}>{DAY_LABEL[day]} — no training scheduled</Text>
        </View>
        <Card>
          <Text style={styles.restText}>
            Take it easy. Recovery is where the growth happens.
          </Text>
        </Card>
      </Screen>
    );
  }

  const focusLabel = dayPlan?.name || DAY_LABEL[day];

  return (
    <>
      <Screen>
        <View style={styles.header}>
          <Text style={styles.title}>{focusLabel}</Text>
          <Text style={styles.subtitle}>
            {DAY_LABEL[day]} · {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          </Text>
        </View>

        {grouped.map(({ group, items }) => (
          <View key={group}>
            <SectionLabel
              trailing={
                <View style={styles.groupTrailing}>
                  {group === 'shoulders' ? (
                    <View style={styles.priorityBadge}>
                      <Text style={styles.priorityText}>Priority</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => onDeleteGroup(group)}
                    hitSlop={8}
                    style={({ pressed }) => pressed && { opacity: 0.6 }}
                  >
                    <Trash2 size={14} color={colors.textMuted} strokeWidth={2} />
                  </Pressable>
                </View>
              }
            >
              {MUSCLE_LABEL[group]}
            </SectionLabel>
            {items.map((e) => (
              <SwipeableExerciseRow
                key={e.id}
                onSkip={() => onSkipExercise(e)}
              >
                <ExerciseRow
                  name={e.name}
                  sets={e.sets}
                  repRange={e.rep_range}
                  lastSet={lastBestMap[e.id]}
                  completed={completedByExercise[e.id] ?? 0}
                  accentColor={muscleAccent[e.muscle_group] ?? colors.primary}
                  notes={e.notes}
                  typeBadge={e.type === 'normal' ? null : e.type}
                  partnerName={
                    e.type === 'superset' && e.superset_partner_id
                      ? (nameById[e.superset_partner_id] ?? null)
                      : null
                  }
                  onPress={() =>
                    router.push(`/exercise/${e.id}?sessionId=${sessionId ?? ''}`)
                  }
                />
              </SwipeableExerciseRow>
            ))}
            <Pressable
              onPress={() => {
                hapticTap();
                setAddingToGroup(group);
              }}
              style={({ pressed }) => [styles.addExerciseBtn, pressed && { opacity: 0.7 }]}
            >
              <Plus size={14} color={colors.primary} strokeWidth={2} />
              <Text style={styles.addExerciseText}>Add new exercise</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={() => { hapticTap(); setPickerOpen(true); }}
          style={({ pressed }) => [styles.addGroupBtn, pressed && { opacity: 0.7 }]}
        >
          <Plus size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.addGroupText}>Add muscle group</Text>
        </Pressable>

        <Pressable
          onPress={onFinish}
          style={({ pressed }) => [styles.finishBtn, pressed && { opacity: 0.85 }]}
          disabled={!sessionId}
        >
          <Text style={styles.finishBtnText}>Finish session</Text>
        </Pressable>
      </Screen>

      <SummaryModal summary={summary} onClose={onCloseSummary} />

      <MuscleGroupPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(g) => setAddingToGroup(g)}
      />

      <AddExerciseSheet
        visible={addingToGroup !== null}
        day={day}
        muscleGroup={addingToGroup ?? 'chest'}
        onClose={() => setAddingToGroup(null)}
        onCreated={async () => {
          setAddingToGroup(null);
          await load();
        }}
      />
    </>
  );
}

function SummaryModal({
  summary,
  onClose,
}: {
  summary: null | { completed: number; total: number; volume: number; hk: HealthMetrics };
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!summary}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconWrap}>
            <CheckCircle2 size={40} color={colors.green} strokeWidth={1.5} />
          </View>
          <Text style={styles.modalTitle}>Session complete</Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Sets completed</Text>
              <Text style={styles.metricValue}>
                {summary?.completed ?? 0}/{summary?.total ?? 0}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Volume</Text>
              <Text style={styles.metricValue}>
                {Math.round(summary?.volume ?? 0).toLocaleString()}
                <Text style={styles.metricUnit}> lb</Text>
              </Text>
            </View>
          </View>

          <View style={styles.hkHeader}>
            <Heart size={13} color={colors.red} strokeWidth={2} />
            <Text style={styles.hkHeaderText}>From Apple Health</Text>
          </View>

          <View style={styles.hkRow}>
            <HkCell
              icon={<Timer size={16} color={colors.primary} strokeWidth={1.75} />}
              label="Duration"
              value={summary?.hk.durationMinutes != null ? `${summary.hk.durationMinutes} min` : '—'}
            />
            <HkCell
              icon={<Heart size={16} color={colors.red} strokeWidth={1.75} />}
              label="Avg HR"
              value={summary?.hk.avgHr != null ? `${summary.hk.avgHr} bpm` : '—'}
            />
            <HkCell
              icon={<Flame size={16} color={colors.amber} strokeWidth={1.75} />}
              label="Active"
              value={summary?.hk.calories != null ? `${summary.hk.calories} kcal` : '—'}
            />
          </View>

          {summary?.hk.durationMinutes == null &&
          summary?.hk.avgHr == null &&
          summary?.hk.calories == null ? (
            <Text style={styles.hkHint}>Enable Health access in Settings</Text>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.modalBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function HkCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.hkCell}>
      {icon}
      <Text style={styles.hkCellValue}>{value}</Text>
      <Text style={styles.hkCellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 8, paddingBottom: 4 },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  restText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },

  priorityBadge: {
    backgroundColor: colors.purple + '22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  groupTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0F',
  },
  addGroupText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  addExerciseText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  finishBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  finishBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalIconWrap: { marginBottom: 8 },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    ...typography.metricValue,
    color: colors.text,
    marginTop: 4,
  },
  metricUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
  },

  hkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginTop: 2,
  },
  hkHeaderText: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  hkRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  hkCell: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  hkCellValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  hkCellLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },

  hkHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 8,
  },

  modalBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: radius.card,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

