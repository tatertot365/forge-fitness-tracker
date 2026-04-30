import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  AlertTriangle,
  Clock,
  Download,
  Heart,
  Pencil,
  Plus,
  SkipForward,
  X,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Card } from "../../src/components/Card";
import { PhasePills } from "../../src/components/PhasePills";
import { ProgressBar } from "../../src/components/ProgressBar";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import {
  addCardioToday,
  exportFoodLogCSV,
  exportMeasurementsCSV,
  exportSessionsCSV,
  getActivityLevel,
  getBodyGoals,
  getCardioCountThisWeek,
  getCardioInfo,
  getCatchupItems,
  getCompletedSetCountForSession,
  getDayPlans,
  getExercisesByDay,
  getFoodEntriesForDate,
  getGoalsMode,
  getMuscleGroupSetsThisWeek,
  getNutritionGoalForDate,
  getPhase,
  getSessionsForWeek,
  getSkippedDaysThisWeek,
  getUserProfile,
  getWeekSetLogCounts,
  getWeekTotalSetCounts,
  isHealthKitAsked,
  latestMeasurement,
  markHealthKitAsked,
  measurementOneWeekAgo,
  setCardioInfo,
  setNutritionGoal,
  setPhase as saveBasePhase,
  skipCatchupItem,
  skipDay,
  type BodyGoals,
  type CardioInfo,
} from "../../src/db/queries";
import { calculateTdee } from "../../src/utils/tdee";
import {
  initHealthKit,
  isHealthKitAvailable,
  requestHealthKitAccess,
  verifyHealthKitAccess,
} from "../../src/health";
import { colors, muscleAccent } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import {
  DAY_LABEL,
  DAYS,
  MUSCLE_LABEL,
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
import {
  hapticSelect,
  hapticSuccess,
  hapticTap,
} from "../../src/utils/haptics";

const CARDIO_TARGET: Record<Phase, number> = { cut: 4, maintain: 3, bulk: 2 };
const SCREEN_WIDTH = Dimensions.get("window").width;

export default function TodayScreen() {
  const router = useRouter();
  const today = dayOfWeek();
  const todayDate = todayISO();
  const thisWeek = weekDates();
  const [phase, setPhaseState] = useState<Phase>("maintain");
  const [catchup, setCatchup] = useState<CatchupItem[]>([]);
  const [weekSessions, setWeekSessions] = useState<Record<
    Day,
    Session | null
  > | null>(null);
  const [cardioCount, setCardioCount] = useState(0);
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
  const [bodyStats, setBodyStats] = useState<{
    latest: Measurement | null;
    prev: Measurement | null;
  }>({ latest: null, prev: null });
  const [bodyGoals, setBodyGoalsState] = useState<BodyGoals>({
    goal_weight_lb: null,
    goal_body_fat_pct: null,
    show_ratio_card: false,
  });

  const load = useCallback(async () => {
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
      goals,
    ] = await Promise.all([
      getPhase(),
      getCatchupItems(),
      getSessionsForWeek(),
      getCardioCountThisWeek(),
      getExercisesByDay(today),
      getDayPlans(),
      isHealthKitAsked(),
      getSkippedDaysThisWeek(),
      getWeekSetLogCounts(),
      getWeekTotalSetCounts(),
      getCardioInfo(),
      getMuscleGroupSetsThisWeek(),
      getFoodEntriesForDate(todayDate),
      getNutritionGoalForDate(todayDate),
      latestMeasurement(),
      measurementOneWeekAgo(),
      getBodyGoals(),
    ]);
    const todaySessionId = w[today]?.id;
    const completedSets = todaySessionId
      ? await getCompletedSetCountForSession(todaySessionId)
      : 0;
    setPhaseState(p);
    setCatchup(c);
    setWeekSessions(w);
    setCardioCount(cc);
    setTodayExerciseCount(ex.length);
    setTodayTotalSets(ex.reduce((s, e) => s + e.sets, 0));
    setTodayCompletedSets(completedSets);
    setDayPlans(plans);
    setShowHealthConnect(!hkAsked && isHealthKitAvailable());
    // Always trigger the native permission sheet on load so a fresh install
    // gets prompted even if healthkit_asked was set from a prior build.
    if (isHealthKitAvailable()) initHealthKit();
    setSkippedDays(skips);
    setWeekLogCounts(logCounts);
    setWeekTotalSetCounts(totalCounts);
    setCardioInfo(ci);
    setMuscleGroupSets(mgSets);
    setTodayNutrition({
      date: todayDate,
      calories: foodEntries.reduce((s, e) => s + e.calories, 0),
      protein_g: foodEntries.reduce((s, e) => s + e.protein_g, 0),
      fat_g: foodEntries.reduce((s, e) => s + e.fat_g, 0),
      carbs_g: foodEntries.reduce((s, e) => s + e.carbs_g, 0),
      calorie_goal: nutritionGoal.calorie_goal,
      protein_goal: nutritionGoal.protein_goal,
      fat_goal: nutritionGoal.fat_goal,
      carbs_goal: nutritionGoal.carbs_goal,
    });
    setBodyStats({ latest: latestM, prev: prevM });
    setBodyGoalsState(goals);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onChangePhase = async (p: Phase) => {
    hapticSelect();
    setPhaseState(p);
    await saveBasePhase(p);

    const [goalsMode, activity, measurement, profile] = await Promise.all([
      getGoalsMode(),
      getActivityLevel(),
      latestMeasurement(),
      getUserProfile(),
    ]);
    if (goalsMode === "calculated" && activity && measurement?.weight_lb) {
      const result = calculateTdee({
        weight_lb: measurement.weight_lb,
        body_fat_pct: measurement.body_fat_pct,
        profile,
        activity,
        phase: p,
      });
      if (result.ok) {
        await setNutritionGoal(todayISO(), {
          calorie_goal: result.goals.calories,
          protein_goal: result.goals.protein_g,
          fat_goal: result.goals.fat_g,
          carbs_goal: result.goals.carbs_g,
        });
      }
    }

    const updatedGoal = await getNutritionGoalForDate(todayDate);
    setTodayNutrition((prev) =>
      prev
        ? {
            ...prev,
            calorie_goal: updatedGoal.calorie_goal,
            protein_goal: updatedGoal.protein_goal,
            fat_goal: updatedGoal.fat_goal,
            carbs_goal: updatedGoal.carbs_goal,
          }
        : prev,
    );
  };

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
          <Text style={styles.subtitle}>
            {DAY_LABEL[today]} —{" "}
            {todayEnabled ? todayFocus.toLowerCase() : "rest day"}
          </Text>
        </View>
        <Pressable
          onPress={() => setExportModalOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.6 }]}
        >
          <Download size={12} color={colors.primary} strokeWidth={2} />
          <Text style={styles.exportBtnText}>Export</Text>
        </Pressable>
      </View>

      <View style={{ paddingTop: 8 }}>
        <PhasePills value={phase} onChange={onChangePhase} />
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
      <EditCardioSheet
        visible={editCardioOpen}
        current={cardioInfo}
        onClose={() => setEditCardioOpen(false)}
        onSave={async (info) => {
          await setCardioInfo(info);
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

// ── Edit cardio sheet ─────────────────────────────────────────────────────────

function EditCardioSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: CardioInfo;
  onClose: () => void;
  onSave: (info: CardioInfo) => Promise<void>;
}) {
  const [name, setName] = useState(current.name);
  const [description, setDescription] = useState(current.description);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(current.name);
      setDescription(current.description);
    }
  }, [visible, current.name, current.description]);

  const handleSave = async () => {
    const trimName = name.trim();
    if (!trimName || busy) return;
    setBusy(true);
    try {
      await onSave({ name: trimName, description: description.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Cardio</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Exercise name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.fieldInput}
              placeholder="e.g. Incline treadmill walk"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoFocus
            />

            <Text style={styles.fieldLabel}>Details</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={styles.fieldInput}
              placeholder="e.g. 12° / 3 mph / 20–30 min"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable
              onPress={handleSave}
              disabled={busy || !name.trim()}
              style={({ pressed }) => [
                styles.sheetSaveBtn,
                (busy || !name.trim()) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.sheetSaveBtnText}>Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Export sheet ──────────────────────────────────────────────────────────────

function ExportSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState(true);
  const [nutrition, setNutrition] = useState(true);
  const [measurements, setMeasurements] = useState(true);
  const [busy, setBusy] = useState(false);

  const noneSelected = !sessions && !nutrition && !measurements;

  const handleExport = async () => {
    if (noneSelected) return;
    setBusy(true);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      const files: { name: string; content: string }[] = [];
      if (sessions) {
        files.push({ name: `forge_sessions_${ts}.csv`, content: await exportSessionsCSV() });
      }
      if (nutrition) {
        files.push({ name: `forge_food_log_${ts}.csv`, content: await exportFoodLogCSV() });
      }
      if (measurements) {
        files.push({ name: `forge_measurements_${ts}.csv`, content: await exportMeasurementsCSV() });
      }
      for (const f of files) {
        const uri = FileSystem.cacheDirectory + f.name;
        await FileSystem.writeAsStringAsync(uri, f.content, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: f.name,
          UTI: 'public.comma-separated-values-text',
        });
      }
      onClose();
    } catch {
      Alert.alert('Export failed', 'Could not export data. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const CheckRow = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <Pressable onPress={onToggle} style={styles.exportCheckRow}>
      <Text style={styles.exportCheckLabel}>{label}</Text>
      <View style={[styles.exportCheckbox, value && styles.exportCheckboxChecked]}>
        {value && <Text style={styles.exportCheckmark}>✓</Text>}
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Export data</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <CheckRow label="Exercise history" value={sessions} onToggle={() => setSessions((v) => !v)} />
          <CheckRow label="Nutrition history" value={nutrition} onToggle={() => setNutrition((v) => !v)} />
          <CheckRow label="Measurement history" value={measurements} onToggle={() => setMeasurements((v) => !v)} />
          <Pressable
            onPress={handleExport}
            disabled={busy || noneSelected}
            style={({ pressed }) => [
              styles.sheetSaveBtn,
              { marginTop: 20 },
              (busy || noneSelected) && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.sheetSaveBtnText}>{busy ? 'Exporting…' : 'Export'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Week strip ────────────────────────────────────────────────────────────────

function WeekStrip({
  today,
  todayDate,
  thisWeek,
  dayPlans,
  weekSessions,
  weekLogCounts,
  weekTotalSetCounts,
  skippedDays,
  onPressDay,
  onLongPressDay,
}: {
  today: Day;
  todayDate: string;
  thisWeek: Record<Day, string>;
  dayPlans: Record<Day, DayPlan> | null;
  weekSessions: Record<Day, Session | null> | null;
  weekLogCounts: Record<Day, number> | null;
  weekTotalSetCounts: Record<Day, number> | null;
  skippedDays: Partial<Record<Day, true>>;
  onPressDay: (d: Day) => void;
  onLongPressDay: (d: Day) => void;
}) {
  const slotWidth = (SCREEN_WIDTH - 32) / 7;

  return (
    <View style={styles.strip}>
      {DAYS.map((d) => {
        const isTraining = !!dayPlans?.[d]?.enabled;
        const finalized = !!weekSessions?.[d]?.completed_at;
        const isSkipped = !!skippedDays[d];
        const isPast = thisWeek[d] < todayDate;
        const isToday = d === today;
        const completedSetsForDay = weekLogCounts?.[d] ?? 0;
        const totalSetsForDay = weekTotalSetCounts?.[d] ?? 0;
        const hasLogs = completedSetsForDay > 0;
        const allSetsComplete =
          finalized &&
          totalSetsForDay > 0 &&
          completedSetsForDay >= totalSetsForDay;
        const completed = allSetsComplete;
        const isPartial = isTraining && !completed && !isSkipped && (hasLogs || finalized);
        const isMissed =
          isTraining &&
          isPast &&
          !isToday &&
          !completed &&
          !isSkipped &&
          !hasLogs &&
          !finalized;
        const canSkip =
          isTraining && !completed && !isSkipped && (isPast || isToday);

        let dotBg: string;
        let dotBorder: string;
        if (!isTraining) {
          dotBg = "transparent";
          dotBorder = colors.border;
        } else if (completed) {
          dotBg = colors.green;
          dotBorder = colors.green;
        } else if (isSkipped) {
          dotBg = colors.gray;
          dotBorder = colors.gray;
        } else if (isPartial) {
          dotBg = colors.warning;
          dotBorder = colors.warning;
        } else if (isMissed) {
          dotBg = colors.red;
          dotBorder = colors.red;
        } else if (isToday) {
          dotBg = colors.primary;
          dotBorder = colors.primary;
        } else {
          dotBg = "transparent";
          dotBorder = colors.borderStrong;
        }

        const abbr = DAY_LABEL[d].slice(0, 2);

        return (
          <Pressable
            key={d}
            onPress={() => (isTraining ? onPressDay(d) : undefined)}
            onLongPress={() => (canSkip ? onLongPressDay(d) : undefined)}
            delayLongPress={400}
            style={[styles.stripSlot, { width: slotWidth }]}
          >
            <View
              style={[
                styles.stripDot,
                { backgroundColor: dotBg, borderColor: dotBorder },
                isToday && styles.stripDotToday,
              ]}
            />
            <Text
              style={[
                styles.stripDayLabel,
                isToday && { color: colors.primary, fontWeight: "700" },
                !isTraining && { color: colors.textMuted },
              ]}
            >
              {abbr}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Catch-up rows ─────────────────────────────────────────────────────────────

function SwipeableCatchupRow({
  item,
  onPress,
  onSkip,
}: {
  item: CatchupItem;
  onPress: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);

  const handleSkip = () => {
    hapticTap();
    ref.current?.close();
    onSkip();
  };

  const renderRight = () => (
    <Pressable
      onPress={handleSkip}
      style={({ pressed }) => [styles.skipAction, pressed && { opacity: 0.85 }]}
    >
      <SkipForward size={18} color="#FFFFFF" strokeWidth={2} />
      <Text style={styles.skipLabel}>Skip</Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <CatchupRow item={item} onPress={onPress} />
    </ReanimatedSwipeable>
  );
}

function CatchupRow({
  item,
  onPress,
}: {
  item: CatchupItem;
  onPress: () => void;
}) {
  const atRisk = item.days_ago >= 3;
  const Icon = atRisk ? AlertTriangle : Clock;
  const iconColor = atRisk ? colors.warning : colors.gray;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.catchRow, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.catchAccent,
          {
            backgroundColor: muscleAccent[item.muscle_group] ?? colors.primary,
          },
        ]}
      />
      <View style={{ flex: 1, paddingVertical: 12, paddingRight: 16, gap: 2 }}>
        <Text style={styles.catchName}>{item.exercise_name}</Text>
        <Text style={styles.catchMeta}>
          {DAY_LABEL[item.day]} · {item.sets_missed} set
          {item.sets_missed === 1 ? "" : "s"} ·{" "}
          {MUSCLE_LABEL[item.muscle_group]}
        </Text>
      </View>
      <View style={styles.catchTrailing}>
        <Icon size={16} color={iconColor} strokeWidth={2} />
        <Text style={[styles.catchTrailingText, { color: iconColor }]}>
          {atRisk ? "at risk" : `${item.days_ago}d ago`}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Muscle group grid ─────────────────────────────────────────────────────────

const CELL_WIDTH = (SCREEN_WIDTH - 40) / 2; // 16px padding × 2 sides + 8px gap

function MuscleGroupGrid({
  sets,
}: {
  sets: Partial<Record<MuscleGroup, number>>;
}) {
  const entries = Object.entries(sets) as [MuscleGroup, number][];
  return (
    <View style={styles.mgGrid}>
      {entries.map(([group, count]) => (
        <View key={group} style={styles.mgCell}>
          <View
            style={[
              styles.mgAccent,
              { backgroundColor: muscleAccent[group] ?? colors.primary },
            ]}
          />
          <View style={styles.mgContent}>
            <Text style={styles.mgName} numberOfLines={1}>
              {MUSCLE_LABEL[group]}
            </Text>
            <Text style={styles.mgCount}>
              {count} set{count === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Macro ring card ───────────────────────────────────────────────────────────

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function MacroRingCard({
  data,
  onPress,
}: {
  data: DailyNutritionTotal | null;
  onPress: () => void;
}) {
  const macros = [
    {
      key: "cal",
      label: "Kcal",
      value: data?.calories ?? 0,
      goal: data?.calorie_goal ?? 2500,
      color: colors.primary,
    },
    {
      key: "pro",
      label: "Protein",
      value: data?.protein_g ?? 0,
      goal: data?.protein_goal ?? 180,
      color: colors.purple,
    },
    {
      key: "fat",
      label: "Fat",
      value: data?.fat_g ?? 0,
      goal: data?.fat_goal ?? 80,
      color: colors.amber,
    },
    {
      key: "carb",
      label: "Carbs",
      value: data?.carbs_g ?? 0,
      goal: data?.carbs_goal ?? 250,
      color: colors.teal,
    },
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <Card style={{ marginTop: 12 }}>
        <View style={styles.glanceHeader}>
          <Text style={styles.glanceTitle}>Today's nutrition</Text>
          <Text style={styles.glanceNav}>Food →</Text>
        </View>
        <View style={styles.macroRingRow}>
          {macros.map((m) => {
            const pct = m.goal > 0 ? Math.min(1, m.value / m.goal) : 0;
            const filled = pct * RING_CIRC;
            const displayVal =
              m.value >= 1000
                ? `${(m.value / 1000).toFixed(1)}k`
                : String(Math.round(m.value));
            const displayGoal =
              m.goal >= 1000
                ? `${(m.goal / 1000).toFixed(1)}k`
                : String(m.goal);
            return (
              <View key={m.key} style={styles.macroCell}>
                <View style={{ width: RING_SIZE, height: RING_SIZE }}>
                  <Svg width={RING_SIZE} height={RING_SIZE}>
                    <SvgCircle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke="rgba(255,255,255,0.10)"
                      strokeWidth={RING_STROKE}
                      fill="none"
                    />
                    <SvgCircle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke={m.color}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeDasharray={`${filled} ${RING_CIRC}`}
                      strokeLinecap="round"
                      rotation={-90}
                      origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                    />
                  </Svg>
                  <View
                    style={[StyleSheet.absoluteFillObject, styles.ringCenter]}
                  >
                    <Text style={[styles.ringValue, { color: m.color }]}>
                      {displayVal}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ringLabel}>{m.label}</Text>
                <Text style={styles.ringGoal}>/ {displayGoal}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </Pressable>
  );
}

// ── Body stats card ───────────────────────────────────────────────────────────

function BodyStatsCard({
  data,
  goals,
  onPress,
}: {
  data: { latest: Measurement | null; prev: Measurement | null };
  goals: BodyGoals;
  onPress: () => void;
}) {
  const { latest } = data;
  const hasGoals =
    goals.goal_weight_lb != null || goals.goal_body_fat_pct != null;

  const weightPct =
    latest?.weight_lb != null &&
    goals.goal_weight_lb != null &&
    goals.goal_weight_lb > 0
      ? Math.min(1, goals.goal_weight_lb / latest.weight_lb)
      : null;
  const weightRemain =
    latest?.weight_lb != null && goals.goal_weight_lb != null
      ? +(latest.weight_lb - goals.goal_weight_lb).toFixed(1)
      : null;

  const bfPct =
    latest?.body_fat_pct != null &&
    goals.goal_body_fat_pct != null &&
    goals.goal_body_fat_pct > 0
      ? Math.min(1, goals.goal_body_fat_pct / latest.body_fat_pct)
      : null;
  const bfRemain =
    latest?.body_fat_pct != null && goals.goal_body_fat_pct != null
      ? +(latest.body_fat_pct - goals.goal_body_fat_pct).toFixed(1)
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <Card style={{ marginTop: 10 }}>
        <View style={styles.glanceHeader}>
          <Text style={styles.glanceTitle}>Goal progress</Text>
          <Text style={styles.glanceNav}>Measure →</Text>
        </View>

        {!hasGoals ? (
          <Text style={styles.goalsEmptyText}>
            Set weight & body fat goals in Measure →
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {goals.goal_weight_lb != null && (
              <GoalProgressRow
                label="Weight"
                current={
                  latest?.weight_lb != null ? `${latest.weight_lb} lb` : "—"
                }
                goal={`${goals.goal_weight_lb} lb`}
                progress={weightPct}
                remain={
                  weightRemain != null && weightRemain > 0
                    ? `${weightRemain} lb to go`
                    : weightRemain != null && weightRemain <= 0
                      ? "Goal reached"
                      : null
                }
                reached={weightRemain != null && weightRemain <= 0}
              />
            )}
            {goals.goal_body_fat_pct != null && (
              <GoalProgressRow
                label="Body fat"
                current={
                  latest?.body_fat_pct != null ? `${latest.body_fat_pct}%` : "—"
                }
                goal={`${goals.goal_body_fat_pct}%`}
                progress={bfPct}
                remain={
                  bfRemain != null && bfRemain > 0
                    ? `${bfRemain}% to go`
                    : bfRemain != null && bfRemain <= 0
                      ? "Goal reached"
                      : null
                }
                reached={bfRemain != null && bfRemain <= 0}
              />
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

function GoalProgressRow({
  label,
  current,
  goal,
  progress,
  remain,
  reached,
}: {
  label: string;
  current: string;
  goal: string;
  progress: number | null;
  remain: string | null;
  reached: boolean;
}) {
  const barColor = reached ? colors.green : colors.primary;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.goalRowHeader}>
        <Text style={styles.goalLabel}>{label}</Text>
        <View style={styles.goalValues}>
          <Text style={styles.goalCurrent}>{current}</Text>
          <Text style={styles.goalSep}>→</Text>
          <Text style={[styles.goalTarget, reached && { color: colors.green }]}>
            {goal}
          </Text>
        </View>
      </View>
      <View style={styles.goalBarTrack}>
        <View
          style={[
            styles.goalBarFill,
            {
              width: `${Math.round((progress ?? 0) * 100)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      {remain != null && (
        <Text style={[styles.goalRemain, reached && { color: colors.green }]}>
          {remain}
        </Text>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

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
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.55)",
  },
  sessionFocus: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  sessionMeta: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  sessionCtaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  sessionCtaText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  sessionCtaArrow: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  // Week strip
  strip: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  stripSlot: {
    alignItems: "center",
    gap: 6,
  },
  stripDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  stripDotToday: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stripDayLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
  },

  // Catch-up
  catchRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  catchAccent: {
    width: 3,
    marginVertical: 10,
    marginLeft: 10,
    borderRadius: radius.accent,
    marginRight: 12,
  },
  catchName: { ...typography.exerciseName, color: colors.text },
  catchMeta: { ...typography.caption, color: colors.textSecondary },
  catchTrailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 14,
    gap: 2,
  },
  catchTrailingText: { fontSize: 11, fontWeight: "600" },

  // Cardio
  cardioTitle: { ...typography.exerciseName, color: colors.text },
  cardioMeta: {
    ...typography.caption,
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
  addBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },

  mgGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mgCell: {
    width: CELL_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  mgAccent: {
    width: 3,
    height: 28,
    borderRadius: 2,
  },
  mgContent: { flex: 1 },
  mgName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  mgCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  // At-a-glance shared
  glanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  glanceTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  glanceNav: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  // Macro rings
  macroRingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  macroCell: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  ringCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringValue: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  ringLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  ringGoal: {
    fontSize: 10,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },

  // Goal progress card
  goalsEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
  goalRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  goalValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  goalCurrent: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  goalSep: {
    fontSize: 11,
    color: colors.textMuted,
  },
  goalTarget: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  goalBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  goalBarFill: {
    height: 6,
    borderRadius: 3,
  },
  goalRemain: {
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },

  editPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editPlanText: { fontSize: 12, fontWeight: "600", color: colors.primary },

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
  exportBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },

  exportCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  exportCheckLabel: { fontSize: 15, fontWeight: "500", color: colors.text },
  exportCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  exportCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  exportCheckmark: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", lineHeight: 16 },

  skipAction: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.gray,
    borderRadius: radius.card,
    marginLeft: 6,
  },
  skipLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  fieldLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
  },
  fieldInput: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sheetSaveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: "center",
  },
  sheetSaveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

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
  healthTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  healthMeta: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 1 },
  healthCta: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
});
