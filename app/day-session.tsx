import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Plus, Trash2 } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddExerciseSheet } from "../src/components/AddExerciseSheet";
import { ExerciseRow } from "../src/components/ExerciseRow";
import { MuscleGroupPickerSheet } from "../src/components/MuscleGroupPickerSheet";
import { SectionLabel } from "../src/components/SectionLabel";
import { SwipeableExerciseRow } from "../src/components/SwipeableExerciseRow";
import { SummaryModal } from "../src/features/session";
import {
  bestSet,
  deleteExercise,
  deleteExercisesByGroup,
  finalizeSession,
  getDayPlans,
  getExercisesByDay,
  getLastCompletedSetsForExercise,
  getOrCreateSession,
  getSetLogsForSession,
  getSkippedExerciseIds,
  skipCatchupItem,
} from "../src/db/queries";
import {
  fetchRecentWorkoutMetrics,
  type HealthMetrics,
} from "../src/health";
import { colors, muscleAccent } from "../src/theme/colors";
import { radius, spacing, typography } from "../src/theme/spacing";
import { useStyles } from "../src/theme/useStyles";
import {
  DAY_LABEL,
  DAYS,
  MUSCLE_LABEL,
  type Day,
  type Exercise,
  type MuscleGroup,
  type SetLog,
} from "../src/types";
import { weekDates } from "../src/utils/date";
import { hapticSuccess, hapticTap } from "../src/utils/haptics";

type GroupedExercises = { group: MuscleGroup; items: Exercise[] }[];

export default function DaySessionScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = DAYS.includes(params.day as Day) ? (params.day as Day) : null;
  const sessionDate = day ? weekDates()[day] : null;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [lastBestMap, setLastBestMap] = useState<Record<number, string | null>>(
    {},
  );
  const [isRestDay, setIsRestDay] = useState(false);
  const [focusLabel, setFocusLabel] = useState("");
  const [addingToGroup, setAddingToGroup] = useState<MuscleGroup | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [summary, setSummary] = useState<null | {
    completed: number;
    total: number;
    volume: number;
    hk: HealthMetrics;
  }>(null);

  const load = useCallback(async () => {
    if (!day || !sessionDate) return;
    const plans = await getDayPlans();
    const plan = plans[day];
    setFocusLabel(plan?.name || DAY_LABEL[day]);
    if (!plan?.enabled) {
      setIsRestDay(true);
      setExercises([]);
      setSessionId(null);
      setSetLogs([]);
      setLastBestMap({});
      return;
    }
    setIsRestDay(false);
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
        const b = bestSet(last, e.type === "bodyweight");
        lastMap[e.id] =
          e.type === "bodyweight"
            ? b?.reps != null
              ? `${b.reps} reps`
              : null
            : b?.weight_lb != null && b.reps != null
              ? `${b.weight_lb} lb × ${b.reps}`
              : null;
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
    // Determine the first sort_order seen for each muscle group so groups
    // appear in the order they were originally placed, even if individual
    // exercises are interleaved in sort_order.
    const groupOrder = new Map<MuscleGroup, number>();
    for (const e of exercises) {
      if (!groupOrder.has(e.muscle_group))
        groupOrder.set(e.muscle_group, e.sort_order);
    }
    const sorted = [...exercises].sort((a, b) => {
      const ga = groupOrder.get(a.muscle_group)!;
      const gb = groupOrder.get(b.muscle_group)!;
      if (ga !== gb) return ga - gb;
      return a.sort_order - b.sort_order;
    });
    const out: GroupedExercises = [];
    for (const e of sorted) {
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
  // Count only sets belonging to exercises still on screen, capped at what each
  // one calls for. Skipping an exercise removes it from `exercises` while its
  // logs stay in `setLogs`, which would otherwise inflate this past totalSets
  // and suppress the "finish early" confirmation.
  const completedTotal = exercises.reduce(
    (sum, e) => sum + Math.min(completedByExercise[e.exercise_id] ?? 0, e.sets),
    0,
  );
  const volume = setLogs.reduce(
    (s, l) =>
      s + (l.completed && l.weight_lb && l.reps ? l.weight_lb * l.reps : 0),
    0,
  );

  const onDeleteGroup = (group: MuscleGroup) => {
    if (!day) return;
    const count = exercises.filter((e) => e.muscle_group === group).length;
    Alert.alert(
      `Remove ${MUSCLE_LABEL[group]}?`,
      `This will permanently delete ${count} exercise${count === 1 ? "" : "s"} and all their logged history from ${DAY_LABEL[day]}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteExercisesByGroup(day, group);
            hapticSuccess();
            await load();
          },
        },
      ],
    );
  };

  const onDeleteExercise = (ex: Exercise) => {
    if (!day) return;
    Alert.alert(
      `Delete ${ex.name}?`,
      `It will be removed from ${DAY_LABEL[day]} permanently, along with any sets logged for it on this day.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteExercise(ex.id);
            hapticTap();
            await load();
          },
        },
      ],
    );
  };

  const onSkipExercise = async (ex: Exercise) => {
    if (!sessionDate) return;
    await skipCatchupItem(ex.id, sessionDate);
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
  };

  const finalizeAndShow = async () => {
    if (!sessionId) return;
    const hk = await fetchRecentWorkoutMetrics();
    await finalizeSession(sessionId, hk);
    hapticSuccess();
    setSummary({ completed: completedTotal, total: totalSets, volume, hk });
  };

  const onFinish = () => {
    if (!sessionId) return;
    if (totalSets > 0 && completedTotal < totalSets) {
      Alert.alert(
        "Finish without completing all sets?",
        `${completedTotal} of ${totalSets} sets logged. The session will be marked complete.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Finish",
            style: "destructive",
            onPress: () => finalizeAndShow(),
          },
        ],
      );
      return;
    }
    finalizeAndShow();
  };

  if (!day) return null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {isRestDay ? "Rest day" : focusLabel}
          </Text>
          <Text style={styles.subtitle}>{DAY_LABEL[day]}</Text>
        </View>
      </View>

      {isRestDay ? (
        <View style={styles.restWrap}>
          <Text style={styles.restText}>
            No training scheduled. Recovery is where the growth happens.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {grouped.map(({ group, items }) => (
            <View key={group}>
              <SectionLabel
                trailing={
                  <Pressable
                    onPress={() => onDeleteGroup(group)}
                    hitSlop={8}
                    accessibilityLabel={`Delete ${MUSCLE_LABEL[group]} group`}
                    style={({ pressed }) => pressed && { opacity: 0.6 }}
                  >
                    <Trash2
                      size={14}
                      color={colors.textMuted}
                      strokeWidth={2}
                    />
                  </Pressable>
                }
              >
                {MUSCLE_LABEL[group]}
              </SectionLabel>
              {items.map((e) => (
                <SwipeableExerciseRow
                  key={e.id}
                  onSkip={() => onSkipExercise(e)}
                  onDelete={() => onDeleteExercise(e)}
                >
                  <ExerciseRow
                    name={e.name}
                    sets={e.sets}
                    repRange={e.rep_range}
                    lastSet={lastBestMap[e.id]}
                    completed={completedByExercise[e.exercise_id] ?? 0}
                    accentColor={muscleAccent[e.muscle_group] ?? colors.primary}
                    notes={e.notes}
                    typeBadge={e.type === "normal" ? null : e.type}
                    partnerName={
                      e.type === "superset" && e.superset_partner_id
                        ? (nameById[e.superset_partner_id] ?? null)
                        : null
                    }
                    onPress={() =>
                      router.push(
                        `/exercise/${e.id}?sessionId=${sessionId ?? ""}`,
                      )
                    }
                  />
                </SwipeableExerciseRow>
              ))}
              <Pressable
                onPress={() => {
                  hapticTap();
                  setAddingToGroup(group);
                }}
                style={({ pressed }) => [
                  styles.addExerciseBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Plus size={14} color={colors.primary} strokeWidth={2} />
                <Text style={styles.addExerciseText}>Add new exercise</Text>
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => {
              hapticTap();
              setPickerOpen(true);
            }}
            style={({ pressed }) => [
              styles.addGroupBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Plus size={14} color={colors.primary} strokeWidth={2} />
            <Text style={styles.addGroupText}>Add muscle group</Text>
          </Pressable>

          <Pressable
            onPress={onFinish}
            style={({ pressed }) => [
              styles.finishBtn,
              pressed && { opacity: 0.85 },
            ]}
            disabled={!sessionId}
          >
            <Text style={styles.finishBtnText}>Finish session</Text>
          </Pressable>
        </ScrollView>
      )}

      <SummaryModal
        summary={summary}
        onClose={() => {
          setSummary(null);
          router.back();
        }}
      />

      <MuscleGroupPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(g) => setAddingToGroup(g)}
      />

      {day ? (
        <AddExerciseSheet
          visible={addingToGroup !== null}
          day={day}
          initialMuscleGroup={addingToGroup}
          onClose={() => setAddingToGroup(null)}
          onCreated={async () => {
            setAddingToGroup(null);
            await load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
  subtitle: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 1,
  },

  restWrap: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
  },
  restText: { color: colors.textSecondary, fontSize: s(14), lineHeight: 20 },

  scroll: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 120,
  },

  addGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "0F",
  },
  addGroupText: { color: colors.primary, fontSize: s(13), fontWeight: "600" },
  addExerciseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  addExerciseText: { color: colors.primary, fontSize: s(13), fontWeight: "600" },

  finishBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.card,
    alignItems: "center",
  },
  finishBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
});
