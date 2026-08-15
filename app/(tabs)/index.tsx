import { useFocusEffect, useRouter } from "expo-router";
import {
  Download,
  Heart,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  SkipForward,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Card } from "../../src/components/Card";
import { ProgressBar } from "../../src/components/ProgressBar";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import {
  BodyStatsCard,
  EditCardioSheet,
  ExportSheet,
  MacroRingCard,
  MuscleGroupGrid,
  WeekStrip,
} from "../../src/features/home";
import { SwipeableCatchupRow } from "../../src/features/session";
import {
  addCardioToday,
  getBodyGoals,
  getCardioCountThisWeek,
  getCardioInfo,
  getCatchupItems,
  getCompletedSetCountForSession,
  getDayPlans,
  getExercisesByDay,
  getFoodEntriesForDate,
  getMobilityMinutesThisWeek,
  getMuscleGroupSetsThisWeek,
  getNutritionGoalForDate,
  getPhase,
  hasNutritionGoal,
  getSessionsForWeek,
  getSkippedDaysThisWeek,
  getSkippedExerciseIds,
  getWeekSetLogCounts,
  getWeekTotalSetCounts,
  isHealthKitAsked,
  latestMeasurement,
  startingMeasurement,
  markHealthKitAsked,
  measurementOneWeekAgo,
  setCardioInfo as saveCardioInfo,
  skipCatchupItem,
  skipDay,
  type BodyGoals,
  type CardioInfo,
} from "../../src/db/queries";
import {
  isHealthKitAvailable,
  requestHealthKitAccess,
  verifyHealthKitAccess,
} from "../../src/health";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import { useStyles } from "../../src/theme/useStyles";
import {
  DAY_LABEL,
  type CatchupItem,
  type DailyNutritionTotal,
  type Day,
  type DayPlan,
  type Measurement,
  type MuscleGroup,
  type Phase,
  type Session,
} from "../../src/types";
import { dayOfWeek, todayISO, weekDates } from "../../src/utils/date";
import { hapticSuccess, hapticTap } from "../../src/utils/haptics";

const CARDIO_TARGET: Record<Phase, number> = { cut: 4, maintain: 3, bulk: 2 };

export default function TodayScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  // today/todayDate/thisWeek are state, not module-time constants, so they
  // refresh when the app returns to foreground or focus changes — otherwise a
  // session left open across midnight keeps logging to "yesterday".
  const [today, setToday] = useState<Day>(() => dayOfWeek());
  const [todayDate, setTodayDate] = useState<string>(() => todayISO());
  const [thisWeek, setThisWeek] = useState<Record<Day, string>>(() =>
    weekDates(),
  );
  const [phase, setPhaseState] = useState<Phase>("maintain");
  const [catchup, setCatchup] = useState<CatchupItem[]>([]);
  const [weekSessions, setWeekSessions] = useState<Record<
    Day,
    Session | null
  > | null>(null);
  const [cardioCount, setCardioCount] = useState(0);
  const [mobilityMinutes, setMobilityMinutes] = useState(0);
  const [todayExerciseCount, setTodayExerciseCount] = useState(0);
  const [todayTotalSets, setTodayTotalSets] = useState(0);
  const [todayCompletedSets, setTodayCompletedSets] = useState(0);
  const [muscleGroupSets, setMuscleGroupSets] = useState<
    Partial<Record<MuscleGroup, number>>
  >({});
  const [dayPlans, setDayPlans] = useState<Record<Day, DayPlan> | null>(null);
  const [showHealthConnect, setShowHealthConnect] = useState(false);
  const [skippedDays, setSkippedDays] = useState<Partial<Record<Day, true>>>(
    {},
  );
  const [weekLogCounts, setWeekLogCounts] = useState<Record<
    Day,
    number
  > | null>(null);
  const [weekTotalSetCounts, setWeekTotalSetCounts] = useState<Record<
    Day,
    number
  > | null>(null);
  const [cardioInfo, setCardioInfo] = useState<CardioInfo>({
    name: "Incline treadmill walk",
    description: "12° / 3 mph / 20–30 min",
  });
  const [editCardioOpen, setEditCardioOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [todayNutrition, setTodayNutrition] =
    useState<DailyNutritionTotal | null>(null);
  const [nutritionGoalSet, setNutritionGoalSet] = useState(false);
  const [bodyStats, setBodyStats] = useState<{
    latest: Measurement | null;
    prev: Measurement | null;
    start: { weight_lb: number | null; body_fat_pct: number | null };
  }>({ latest: null, prev: null, start: { weight_lb: null, body_fat_pct: null } });
  const [bodyGoals, setBodyGoalsState] = useState<BodyGoals>({
    goal_weight_lb: null,
    goal_body_fat_pct: null,
    goal_weight_start_lb: null,
    goal_body_fat_start_pct: null,
    show_ratio_card: false,
  });

  const load = useCallback(async () => {
    // Recompute date state up-front so values used below — and the rest of the
    // screen — reflect the actual current day, not whatever was captured the
    // last time the component mounted.
    const currentDay = dayOfWeek();
    const currentDate = todayISO();
    const currentWeek = weekDates();
    setToday(currentDay);
    setTodayDate(currentDate);
    setThisWeek(currentWeek);

    const [
      p,
      c,
      w,
      cc,
      ex,
      plans,
      hkAsked,
      skips,
      logCounts,
      totalCounts,
      ci,
      mgSets,
      foodEntries,
      nutritionGoal,
      latestM,
      prevM,
      startM,
      goals,
      mobMin,
    ] = await Promise.all([
      getPhase(),
      getCatchupItems(),
      getSessionsForWeek(),
      getCardioCountThisWeek(),
      getExercisesByDay(currentDay),
      getDayPlans(),
      isHealthKitAsked(),
      getSkippedDaysThisWeek(),
      getWeekSetLogCounts(),
      getWeekTotalSetCounts(),
      getCardioInfo(),
      getMuscleGroupSetsThisWeek(),
      getFoodEntriesForDate(currentDate),
      getNutritionGoalForDate(currentDate),
      latestMeasurement(),
      measurementOneWeekAgo(),
      startingMeasurement(),
      getBodyGoals(),
      getMobilityMinutesThisWeek(),
    ]);
    const hasGoal = await hasNutritionGoal(currentDate);
    setNutritionGoalSet(hasGoal);
    const todaySessionId = w[currentDay]?.id;
    const [completedSets, todaySkippedIds] = await Promise.all([
      todaySessionId ? getCompletedSetCountForSession(todaySessionId) : Promise.resolve(0),
      getSkippedExerciseIds(currentDate),
    ]);
    // Match the workout screens: skipped exercises don't count toward the
    // denominator, otherwise "complete the rest of the day" can never satisfy
    // `completedSets >= totalSets` and the CTA stays stuck on "Resume".
    const effectiveTodayExercises = ex.filter((e) => !todaySkippedIds.has(e.id));
    setPhaseState(p);
    setCatchup(c);
    setWeekSessions(w);
    setCardioCount(cc);
    setTodayExerciseCount(effectiveTodayExercises.length);
    setTodayTotalSets(effectiveTodayExercises.reduce((s, e) => s + e.sets, 0));
    setTodayCompletedSets(completedSets);
    setDayPlans(plans);
    setShowHealthConnect(!hkAsked && isHealthKitAvailable());
    setSkippedDays(skips);
    setWeekLogCounts(logCounts);
    setWeekTotalSetCounts(totalCounts);
    setCardioInfo(ci);
    setMuscleGroupSets(mgSets);
    setTodayNutrition({
      date: currentDate,
      calories: foodEntries.reduce((s, e) => s + e.calories, 0),
      protein_g: foodEntries.reduce((s, e) => s + e.protein_g, 0),
      fat_g: foodEntries.reduce((s, e) => s + e.fat_g, 0),
      carbs_g: foodEntries.reduce((s, e) => s + e.carbs_g, 0),
      calorie_goal: nutritionGoal.calorie_goal,
      protein_goal: nutritionGoal.protein_goal,
      fat_goal: nutritionGoal.fat_goal,
      carbs_goal: nutritionGoal.carbs_goal,
    });
    setBodyStats({ latest: latestM, prev: prevM, start: startM });
    setBodyGoalsState(goals);
    setMobilityMinutes(mobMin);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Re-run load whenever the app returns to the foreground — catches the case
  // where the user left the app open across midnight (date rollover) or for an
  // extended period (stale data).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => sub.remove();
  }, [load]);

  const onSkipDay = async (d: Day) => {
    const date = thisWeek[d];
    await skipDay(d, date);
    setSkippedDays((prev) => ({ ...prev, [d]: true }));
    setCatchup((prev) => prev.filter((c) => c.day !== d));
  };

  const onLongPressDay = (d: Day) => {
    hapticTap();
    Alert.alert(
      `Skip ${DAY_LABEL[d]}?`,
      "This will dismiss all catch-up items for this day.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Skip day", style: "destructive", onPress: () => onSkipDay(d) },
      ],
    );
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

  const onAddCardio = async () => {
    hapticTap();
    await addCardioToday();
    setCardioCount((c) => c + 1);
  };

  const onConnectHealth = async () => {
    hapticTap();
    await requestHealthKitAccess();
    const verified = await verifyHealthKitAccess();
    await markHealthKitAsked();
    setShowHealthConnect(false);
    if (verified) hapticSuccess();
  };

  const cardioTarget = CARDIO_TARGET[phase];
  const todayPlan = dayPlans?.[today];
  const todayEnabled = !!todayPlan?.enabled;
  // Focus name is optional; fall back to the day name for the card title.
  const todayFocus = todayPlan?.name || DAY_LABEL[today];
  const sessionFinalized = !!weekSessions?.[today]?.completed_at;
  const sessionIsComplete =
    sessionFinalized &&
    todayTotalSets > 0 &&
    todayCompletedSets >= todayTotalSets;
  const sessionInProgress =
    !sessionIsComplete && (sessionFinalized || todayCompletedSets > 0);

  let sessionMetaText: string;
  if (!todayEnabled) {
    sessionMetaText = "Recovery & mobility";
  } else if (todayExerciseCount === 0) {
    sessionMetaText = "No exercises yet — tap to edit plan";
  } else if (sessionIsComplete) {
    sessionMetaText = "All sets done · tap to review";
  } else if (sessionInProgress) {
    sessionMetaText = `${todayCompletedSets} / ${todayTotalSets} sets done`;
  } else {
    sessionMetaText = `${todayExerciseCount} exercise${todayExerciseCount === 1 ? "" : "s"} · ${todayTotalSets} sets`;
  }
  const sessionCtaLabel = sessionIsComplete
    ? "✓ Done"
    : sessionInProgress
      ? "Resume"
      : "Open";


  return (
    <Screen>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Home</Text>
        </View>
        <Pressable
          onPress={() => setExportModalOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.6 }]}
        >
          <Download size={12} color={colors.primary} strokeWidth={2} />
          <Text style={styles.exportBtnText}>Export</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={10}
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.6 }]}
        >
          <SettingsIcon size={16} color={colors.text} strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Session card (dominant) ── */}
      <Pressable
        onPress={() =>
          todayEnabled && todayExerciseCount > 0
            ? router.push(`/session?day=${today}`)
            : router.push("/plan")
        }
        style={({ pressed }) => [
          styles.sessionCard,
          pressed && { opacity: 0.9 },
        ]}
      >
        <View style={styles.sessionCardInner}>
          <View style={styles.sessionLeft}>
            <Text style={styles.sessionDayLabel}>
              {DAY_LABEL[today].toUpperCase()}
            </Text>
            <Text style={styles.sessionFocus} numberOfLines={1}>
              {todayEnabled ? todayFocus : "Rest Day"}
            </Text>
            <Text style={styles.sessionMeta}>{sessionMetaText}</Text>
          </View>
          {todayEnabled && todayExerciseCount > 0 ? (
            <View style={styles.sessionCtaBox}>
              <Text style={styles.sessionCtaText}>{sessionCtaLabel}</Text>
              {!sessionIsComplete ? (
                <Text style={styles.sessionCtaArrow}>→</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* ── At-a-glance cards ── */}
      <MacroRingCard
        data={todayNutrition}
        goalSet={nutritionGoalSet}
        onPress={() => router.push("/food" as any)}
      />
      <BodyStatsCard
        data={bodyStats}
        goals={bodyGoals}
        onPress={() => router.push("/measure" as any)}
      />

      {/* ── Apple Health connect ── */}
      {showHealthConnect ? (
        <Pressable
          onPress={onConnectHealth}
          style={({ pressed }) => [
            styles.healthBtn,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Heart size={16} color="#FFFFFF" strokeWidth={2.2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.healthTitle}>Connect Apple Health</Text>
            <Text style={styles.healthMeta}>
              Let sessions pull heart rate, calories & duration.
            </Text>
          </View>
          <Text style={styles.healthCta}>Connect →</Text>
        </Pressable>
      ) : null}

      {/* ── Catch-up ── */}
      {catchup.length > 0 ? (
        <>
          <SectionLabel>Catch-up</SectionLabel>
          <View style={{ gap: 8 }}>
            {catchup.map((item) => (
              <SwipeableCatchupRow
                key={`${item.exercise_id}-${item.date_missed}`}
                item={item}
                onPress={() =>
                  router.push(
                    `/exercise/${item.exercise_id}?date=${item.date_missed}`,
                  )
                }
                onSkip={() => onSkipCatchup(item)}
              />
            ))}
          </View>
          {/* Per-day skip — discoverable alternative to the long-press dot. */}
          <View style={styles.skipDayRow}>
            {Array.from(new Set(catchup.map((c) => c.day))).map((d) => (
              <Pressable
                key={d}
                onPress={() => onLongPressDay(d as Day)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.skipDayBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SkipForward size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.skipDayBtnText}>
                  Skip {DAY_LABEL[d as Day]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* ── Weekly split strip ── */}
      <SectionLabel
        trailing={
          <Pressable
            onPress={() => router.push("/plan")}
            hitSlop={10}
            style={({ pressed }) => [
              styles.editPlanBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Pencil size={12} color={colors.primary} strokeWidth={2} />
            <Text style={styles.editPlanText}>Edit split</Text>
          </Pressable>
        }
      >
        Weekly split
      </SectionLabel>
      <WeekStrip
        today={today}
        todayDate={todayDate}
        thisWeek={thisWeek}
        dayPlans={dayPlans}
        weekSessions={weekSessions}
        weekLogCounts={weekLogCounts}
        weekTotalSetCounts={weekTotalSetCounts}
        skippedDays={skippedDays}
        onPressDay={(d) =>
          router.push({ pathname: "/day-session" as any, params: { day: d } })
        }
        onLongPressDay={onLongPressDay}
      />

      {/* ── Muscle group frequency ── */}
      {Object.keys(muscleGroupSets).length > 0 ? (
        <>
          <SectionLabel>Muscle volume — this week</SectionLabel>
          <MuscleGroupGrid sets={muscleGroupSets} />
        </>
      ) : null}

      {/* ── Cardio ── */}
      <SectionLabel
        trailing={
          <Pressable
            onPress={() => setEditCardioOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [
              styles.editPlanBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Pencil size={12} color={colors.primary} strokeWidth={2} />
            <Text style={styles.editPlanText}>Edit</Text>
          </Pressable>
        }
      >
        Cardio
      </SectionLabel>
      <Card>
        <Text style={styles.cardioTitle}>{cardioInfo.name}</Text>
        <Text style={styles.cardioMeta}>{cardioInfo.description}</Text>
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={cardioCount} max={cardioTarget} />
        </View>
        <View style={styles.cardioRow}>
          <Text style={styles.cardioCount}>
            {cardioCount}/{cardioTarget} this week
          </Text>
          <Pressable
            onPress={onAddCardio}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Log session</Text>
          </Pressable>
        </View>
      </Card>

      <SectionLabel>Mobility</SectionLabel>
      <Card>
        <View style={styles.mobilityRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mobilityValue}>
              {mobilityMinutes}
              <Text style={styles.mobilityUnit}> min</Text>
            </Text>
            <Text style={styles.mobilityMeta}>
              Stretching & cooldown this week
            </Text>
          </View>
        </View>
      </Card>

      <EditCardioSheet
        visible={editCardioOpen}
        current={cardioInfo}
        onClose={() => setEditCardioOpen(false)}
        onSave={async (info) => {
          await saveCardioInfo(info);
          setCardioInfo(info);
          setEditCardioOpen(false);
        }}
      />
      <ExportSheet
        visible={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </Screen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  title: { ...typography.screenTitle, fontSize: s(22), color: colors.text },

  // Session card
  sessionCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    marginTop: 14,
    overflow: "hidden",
  },
  sessionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 12,
  },
  sessionLeft: { flex: 1, gap: 3 },
  sessionDayLabel: {
    fontSize: s(10),
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
  },
  sessionFocus: { fontSize: s(22), fontWeight: "700", color: "#FFFFFF" },
  sessionMeta: { fontSize: s(12), color: "rgba(255,255,255,0.6)", marginTop: 1 },
  sessionCtaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  sessionCtaText: { color: "#FFFFFF", fontSize: s(13), fontWeight: "700" },
  sessionCtaArrow: { color: "#FFFFFF", fontSize: s(15), fontWeight: "700" },

  // Week strip
  // Cardio
  cardioTitle: { ...typography.exerciseName, fontSize: s(14), color: colors.text },
  cardioMeta: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cardioCount: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addBtnText: { color: "#FFFFFF", fontSize: s(12), fontWeight: "600" },

  mobilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mobilityValue: {
    ...typography.metricValue,
    fontSize: s(20),
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  mobilityUnit: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    fontWeight: "400",
  },
  mobilityMeta: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
  },

  // At-a-glance shared
  // Macro rings
  // Goal progress card
  editPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editPlanText: { fontSize: s(12), fontWeight: "600", color: colors.primary },

  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  exportBtnText: { fontSize: s(12), fontWeight: "600", color: colors.primary },
  settingsBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },

  skipDayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  skipDayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  skipDayBtnText: {
    fontSize: s(12),
    color: colors.textSecondary,
    fontWeight: "500",
  },

  healthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    backgroundColor: "#FF2D55",
  },
  healthTitle: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  healthMeta: { color: "rgba(255,255,255,0.85)", fontSize: s(11), marginTop: 1 },
  healthCta: { color: "#FFFFFF", fontSize: s(12), fontWeight: "600" },
});

