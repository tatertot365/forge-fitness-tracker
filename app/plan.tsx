import { useFocusEffect, useRouter } from "expo-router";
import {
  ChevronLeft,
  Copy,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  copyDayExercises,
  deleteExercisesByGroup,
  getDayPlans,
  getExercisesByDay,
  updateDayPlan,
} from "../src/db/queries";
import { AddSheet, DaySection, EditSheet } from "../src/features/plan";
import { colors } from "../src/theme/colors";
import { typography } from "../src/theme/spacing";
import { useStyles } from "../src/theme/useStyles";
import {
  DAY_LABEL,
  DAYS,
  MUSCLE_LABEL,
  type Day,
  type DayPlan,
  type Exercise,
  type MuscleGroup,
} from "../src/types";
import {
  hapticSelect,
  hapticSuccess,
  hapticTap,
} from "../src/utils/haptics";

// ─── PlanScreen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [plans, setPlans] = useState<Record<Day, DayPlan> | null>(null);
  const [exercises, setExercises] = useState<Record<Day, Exercise[]>>(
    {} as Record<Day, Exercise[]>,
  );
  const [addSheet, setAddSheet] = useState<{ visible: boolean; day: Day }>({
    visible: false,
    day: "monday",
  });
  const [editSheet, setEditSheet] = useState<{
    visible: boolean;
    exercise: Exercise | null;
  }>({
    visible: false,
    exercise: null,
  });

  const load = useCallback(async () => {
    const [p, exByDay] = await Promise.all([
      getDayPlans(),
      Promise.all(DAYS.map((d) => getExercisesByDay(d))),
    ]);
    setPlans(p);
    const exMap = {} as Record<Day, Exercise[]>;
    DAYS.forEach((d, i) => {
      exMap[d] = exByDay[i];
    });
    setExercises(exMap);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onToggle = async (day: Day, enabled: boolean) => {
    hapticSelect();
    const val = enabled ? 1 : 0;
    setPlans((prev) =>
      prev ? { ...prev, [day]: { ...prev[day], enabled: val } } : prev,
    );
    await updateDayPlan(day, { enabled: val });
  };

  const onFocusBlur = (day: Day, focus: string) => {
    updateDayPlan(day, { name: focus.trim() });
  };

  const onDeleteGroup = (day: Day, mg: MuscleGroup) => {
    Alert.alert(
      `Remove ${MUSCLE_LABEL[mg]}?`,
      `All ${MUSCLE_LABEL[mg]} exercises will be removed from ${DAY_LABEL[day]}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteExercisesByGroup(day, mg);
            hapticTap();
            await load();
          },
        },
      ],
    );
  };

  const onCopy = (fromDay: Day) => {
    const otherDays = DAYS.filter((d) => d !== fromDay);
    Alert.alert(
      `Copy ${DAY_LABEL[fromDay]} to…`,
      "Exercises already on the target day will be skipped.",
      [
        ...otherDays.map((d) => ({
          text: DAY_LABEL[d],
          onPress: async () => {
            await copyDayExercises(fromDay, d);
            hapticSuccess();
            await load();
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  };

  const enabledCount = plans ? DAYS.filter((d) => plans[d].enabled).length : 0;
  const totalExercises = Object.values(exercises).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

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
          <Text style={styles.title}>Training plan</Text>
          <Text style={styles.subtitle}>
            {enabledCount} day{enabledCount === 1 ? "" : "s"} · {totalExercises}{" "}
            exercise
            {totalExercises === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {plans &&
          DAYS.map((day) => (
            <DaySection
              key={day}
              day={day}
              plan={plans[day]}
              exercises={exercises[day] ?? []}
              onToggle={(enabled) => onToggle(day, enabled)}
              onFocusBlur={(focus) => onFocusBlur(day, focus)}
              onAdd={() => setAddSheet({ visible: true, day })}
              onCopy={() => onCopy(day)}
              onDeleteGroup={(mg) => onDeleteGroup(day, mg)}
              onEditExercise={(ex) =>
                setEditSheet({ visible: true, exercise: ex })
              }
            />
          ))}
      </ScrollView>

      <AddSheet
        visible={addSheet.visible}
        day={addSheet.day}
        onClose={() => setAddSheet((s) => ({ ...s, visible: false }))}
        onCreated={() => load()}
      />

      <EditSheet
        visible={editSheet.visible}
        exercise={editSheet.exercise}
        onClose={() => setEditSheet((s) => ({ ...s, visible: false }))}
        onSaved={() => load()}
        onDeleted={() => load()}
      />
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
  subtitle: { fontSize: s(12), color: colors.textSecondary, marginTop: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10,
  },
});

