import { useRootNavigation, useRouter } from "expo-router";
import {
  AlertTriangle,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AddExerciseSheet } from "../../src/components/AddExerciseSheet";
import { Card } from "../../src/components/Card";
import { CooldownSheet } from "../../src/components/CooldownSheet";
import { ExerciseRow } from "../../src/components/ExerciseRow";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import { SwipeableExerciseRow } from "../../src/components/SwipeableExerciseRow";
import {
  SummaryModal,
  SwipeableCatchupRow,
} from "../../src/features/session";
import {
  bestSet,
  deleteExercise,
  deleteExercisesByGroup,
  finalizeSession,
  getCatchupItems,
  getDayPlans,
  getExercisesByDay,
  getLastCompletedSetsForExercise,
  getOrCreateSession,
  getSetLogsForSession,
  getSkippedExerciseIds,
  skipCatchupItem,
} from "../../src/db/queries";
import {
  fetchRecentWorkoutMetrics,
  type HealthMetrics,
} from "../../src/health";
import { colors, muscleAccent } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import { useStyles } from "../../src/theme/useStyles";
import {
  DAY_LABEL,
  MUSCLE_LABEL,
  type CatchupItem,
  type DayPlan,
  type Exercise,
  type MuscleGroup,
  type SetLog,
} from "../../src/types";
import { dayOfWeek, weekDates } from "../../src/utils/date";
import { hapticSuccess, hapticTap } from "../../src/utils/haptics";

type GroupedExercises = { group: MuscleGroup; items: Exercise[] }[];

export default function SessionScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const rootNavigation = useRootNavigation();
  const day = dayOfWeek();
  const sessionDate = weekDates()[day];

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [lastBestMap, setLastBestMap] = useState<Record<number, string | null>>(
    {},
  );
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [catchup, setCatchup] = useState<CatchupItem[]>([]);
  const [catchupOpen, setCatchupOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<null | {
    completed: number;
    total: number;
    volume: number;
    hk: HealthMetrics;
  }>(null);
  const [summary, setSummary] = useState<null | {
    completed: number;
    total: number;
    volume: number;
    hk: HealthMetrics;
  }>(null);

  const load = useCallback(async () => {
    const [plans, catchupItems] = await Promise.all([
      getDayPlans(),
      getCatchupItems(),
    ]);
    setCatchup(catchupItems);
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

  useEffect(() => {
    load();
    if (!rootNavigation) return;
    return rootNavigation.addListener("state", load);
  }, [load, rootNavigation]);

  const grouped: GroupedExercises = useMemo(() => {
    const groupOrder = new Map<MuscleGroup, number>();
    for (const e of exercises) {
      const cur = groupOrder.get(e.muscle_group);
      if (cur === undefined || e.sort_order < cur)
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
  const completedTotal = Object.values(completedByExercise).reduce(
    (a, b) => a + b,
    0,
  );
  const volume = setLogs.reduce(
    (s, l) =>
      s + (l.completed && l.weight_lb && l.reps ? l.weight_lb * l.reps : 0),
    0,
  );

  const onDeleteGroup = (group: MuscleGroup) => {
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
    await skipCatchupItem(ex.id, sessionDate);
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
  };

  const onSkipCatchup = async (item: CatchupItem) => {
    await skipCatchupItem(item.exercise_id, item.date_missed);
    setCatchup((prev) =>
      prev.filter(
        (c) =>
          !(
            c.exercise_id === item.exercise_id &&
            c.date_missed === item.date_missed
          ),
      ),
    );
  };

  const finalizeAndShow = async () => {
    if (!sessionId) return;
    const hk = await fetchRecentWorkoutMetrics();
    await finalizeSession(sessionId, hk);
    hapticSuccess();
    setPendingSummary({
      completed: completedTotal,
      total: totalSets,
      volume,
      hk,
    });
    setCooldownOpen(true);
  };

  const onCloseCooldown = () => {
    setCooldownOpen(false);
    if (pendingSummary) {
      setSummary(pendingSummary);
      setPendingSummary(null);
    }
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

  const onCloseSummary = () => {
    setSummary(null);
    router.replace("/(tabs)");
  };

  const catchupSection =
    catchup.length > 0 ? (
      <CatchupDropdown
        items={catchup}
        open={catchupOpen}
        onToggle={() => {
          hapticTap();
          setCatchupOpen((v) => !v);
        }}
        onPressItem={(item) =>
          router.push(`/exercise/${item.exercise_id}?date=${item.date_missed}`)
        }
        onSkipItem={onSkipCatchup}
      />
    ) : null;

  if (dayPlan && !dayPlan.enabled) {
    return (
      <Screen>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Rest day</Text>
          </View>
          <Pressable
            onPress={() => router.push("/plan")}
            hitSlop={10}
            accessibilityLabel="View full plan"
            style={({ pressed }) => [
              styles.fullPlanBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.fullPlanBtnText}>Full plan</Text>
          </Pressable>
        </View>
        {catchupSection}
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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{focusLabel}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/plan")}
            hitSlop={10}
            accessibilityLabel="View full plan"
            style={({ pressed }) => [
              styles.fullPlanBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.fullPlanBtnText}>Full plan</Text>
          </Pressable>
        </View>

        {catchupSection}

        {grouped.map(({ group, items }) => (
          <View key={group}>
            <SectionLabel
              trailing={
                <View style={styles.groupTrailing}>
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
                </View>
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
                  holdSeconds={e.hold_seconds}
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
          </View>
        ))}

        <Pressable
          onPress={() => {
            hapticTap();
            setAddOpen(true);
          }}
          style={({ pressed }) => [
            styles.addGroupBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Plus size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.addGroupText}>Add exercise</Text>
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
      </Screen>

      <CooldownSheet
        visible={cooldownOpen}
        sessionId={sessionId}
        onClose={onCloseCooldown}
      />

      <SummaryModal summary={summary} onClose={onCloseSummary} />

      <AddExerciseSheet
        visible={addOpen}
        day={day}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          setAddOpen(false);
          await load();
        }}
      />
    </>
  );
}

function CatchupDropdown({
  items,
  open,
  onToggle,
  onPressItem,
  onSkipItem,
}: {
  items: CatchupItem[];
  open: boolean;
  onToggle: () => void;
  onPressItem: (item: CatchupItem) => void;
  onSkipItem: (item: CatchupItem) => void;
}) {
  const styles = useStyles(makeStyles);
  const atRiskCount = items.filter((i) => i.days_ago >= 3).length;
  return (
    <View style={styles.catchupWrap}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.catchupHeader,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.catchupHeaderLabel}>Catch-up</Text>
        <View style={styles.catchupBadge}>
          <Text style={styles.catchupBadgeText}>{items.length}</Text>
        </View>
        {atRiskCount > 0 ? (
          <View style={styles.catchupAtRiskBadge}>
            <AlertTriangle size={11} color={colors.warning} strokeWidth={2.2} />
            <Text style={styles.catchupAtRiskText}>{atRiskCount} at risk</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <ChevronDown
          size={16}
          color={colors.textSecondary}
          strokeWidth={2}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open ? (
        <View style={styles.catchupList}>
          {items.map((item) => (
            <SwipeableCatchupRow
              key={`${item.exercise_id}-${item.date_missed}`}
              item={item}
              onPress={() => onPressItem(item)}
              onSkip={() => onSkipItem(item)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  title: { ...typography.screenTitle, fontSize: s(22), color: colors.text },
  fullPlanBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  fullPlanBtnText: { fontSize: s(12), fontWeight: "600", color: colors.primary },
  restText: { color: colors.textSecondary, fontSize: s(14), lineHeight: 20 },

  groupTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  finishBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.card,
    alignItems: "center",
  },
  finishBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },

  catchupWrap: {
    marginTop: 12,
    marginBottom: 4,
  },
  catchupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  catchupHeaderLabel: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.text,
  },
  catchupBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  catchupBadgeText: {
    color: "#FFFFFF",
    fontSize: s(11),
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  catchupAtRiskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.warning + "1F",
  },
  catchupAtRiskText: {
    fontSize: s(11),
    fontWeight: "600",
    color: colors.warning,
  },
  catchupList: {
    gap: 8,
    marginTop: 8,
  },
});
