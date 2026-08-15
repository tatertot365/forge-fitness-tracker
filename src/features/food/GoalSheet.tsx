import { X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getActivityLevel,
  getGoalsMode,
  getPhase,
  getUserProfile,
  latestMeasurement,
  setActivityLevel,
  setGoalsMode,
} from "../../db/queries";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { makeSheetStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import {
  type NutritionGoal,
} from "../../types";
import { ACTIVITY_LABEL, calculateTdee, type ActivityLevel, type MacroGoals } from "../../utils/tdee";

const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

export function GoalSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: NutritionGoal | null;
  onClose: () => void;
  onSave: (cal: number, prot: number, fat: number, carbs: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const [mode, setMode] = useState<"calculated" | "manual">("manual");
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [calculated, setCalculated] = useState<MacroGoals | null>(null);
  const [calcNote, setCalcNote] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  React.useEffect(() => {
    if (!visible) return;
    // Load persisted mode + activity
    (async () => {
      const [m, a] = await Promise.all([getGoalsMode(), getActivityLevel()]);
      setMode(m);
      setActivity(a);
    })();
    // Populate manual fields from current goal
    if (current) {
      setCalInput(String(Math.round(current.calorie_goal)));
      setProteinInput(String(Math.round(current.protein_goal)));
      setFatInput(String(Math.round(current.fat_goal)));
      setCarbsInput(String(Math.round(current.carbs_goal)));
    }
  }, [visible]);

  // Recalculate whenever activity, mode, or visibility changes
  React.useEffect(() => {
    if (!visible || mode !== "calculated" || !activity) {
      setCalculated(null);
      setCalcError(null);
      return;
    }
    (async () => {
      const [measurement, phase, profile] = await Promise.all([
        latestMeasurement(),
        getPhase(),
        getUserProfile(),
      ]);
      if (!measurement?.weight_lb) {
        setCalcError(
          "No weight logged yet. Add an entry in the Measurements tab first.",
        );
        setCalculated(null);
        return;
      }
      const result = calculateTdee({
        weight_lb: measurement.weight_lb,
        body_fat_pct: measurement.body_fat_pct,
        profile,
        activity,
        phase,
      });
      if (result.ok) {
        setCalculated(result.goals);
        setCalcNote(result.note);
        setCalcError(null);
      } else {
        setCalcError(result.reason);
        setCalculated(null);
      }
    })();
  }, [visible, mode, activity]);

  const switchMode = async (m: "calculated" | "manual") => {
    if (m === "manual" && calculated) {
      // Pre-fill manual fields with calculated values when switching away
      setCalInput(String(calculated.calories));
      setProteinInput(String(calculated.protein_g));
      setFatInput(String(calculated.fat_g));
      setCarbsInput(String(calculated.carbs_g));
    }
    setMode(m);
    await setGoalsMode(m);
  };

  const onPickActivity = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...ACTIVITY_LEVELS.map((a) => ACTIVITY_LABEL[a]), "Cancel"],
        cancelButtonIndex: ACTIVITY_LEVELS.length,
        title: "Activity level",
      },
      async (idx) => {
        if (idx < ACTIVITY_LEVELS.length) {
          const chosen = ACTIVITY_LEVELS[idx];
          setActivity(chosen);
          await setActivityLevel(chosen);
        }
      },
    );
  };

  const save = async () => {
    if (mode === "calculated") {
      if (!calculated) return;
      onSave(
        calculated.calories,
        calculated.protein_g,
        calculated.fat_g,
        calculated.carbs_g,
      );
    } else {
      const c = Number(calInput);
      const p = Number(proteinInput);
      const f = Number(fatInput);
      const cb = Number(carbsInput);
      if (!Number.isFinite(c) || c <= 0) {
        Alert.alert("Enter a valid calorie goal");
        return;
      }
      if (!Number.isFinite(p) || p <= 0) {
        Alert.alert("Enter a valid protein goal");
        return;
      }
      if (!Number.isFinite(f) || f < 0) {
        Alert.alert("Enter a valid fat goal");
        return;
      }
      if (!Number.isFinite(cb) || cb < 0) {
        Alert.alert("Enter a valid carbs goal");
        return;
      }
      onSave(c, p, f, cb);
    }
  };

  const canSave =
    mode === "manual"
      ? Number(calInput) > 0 && Number(proteinInput) > 0
      : calculated !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Daily goals</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            {(["calculated", "manual"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    mode === m && styles.modeBtnTextActive,
                  ]}
                >
                  {m === "calculated" ? "Calculated" : "Manual"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === "calculated" ? (
              <>
                <Text style={styles.formLabel}>Activity level</Text>
                <Pressable
                  onPress={onPickActivity}
                  style={({ pressed }) => [
                    styles.input,
                    styles.sheetInput,
                    styles.pickerRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={
                      activity ? styles.pickerText : styles.pickerPlaceholder
                    }
                    numberOfLines={1}
                  >
                    {activity
                      ? ACTIVITY_LABEL[activity]
                      : "Select activity level…"}
                  </Text>
                  <Text style={styles.unitPickerChevron}>›</Text>
                </Pressable>

                {calcError ? (
                  <View style={styles.calcWarning}>
                    <Text style={styles.calcWarningText}>{calcError}</Text>
                  </View>
                ) : calculated ? (
                  <>
                    <View style={styles.calcResult}>
                      <Text style={styles.calcResultTitle}>
                        Calculated goals
                      </Text>
                      <View style={styles.calcResultRow}>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.calories.toLocaleString()}
                          </Text>
                          <Text style={styles.calcResultLabel}>cal</Text>
                        </View>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.protein_g}g
                          </Text>
                          <Text style={styles.calcResultLabel}>protein</Text>
                        </View>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.fat_g}g
                          </Text>
                          <Text style={styles.calcResultLabel}>fat</Text>
                        </View>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.carbs_g}g
                          </Text>
                          <Text style={styles.calcResultLabel}>carbs</Text>
                        </View>
                      </View>
                    </View>
                    {calcNote ? (
                      <Text style={styles.calcNoteText}>{calcNote}</Text>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Calories</Text>
                    <TextInput
                      value={calInput}
                      onChangeText={setCalInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="2500"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Protein (g)</Text>
                    <TextInput
                      value={proteinInput}
                      onChangeText={setProteinInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="180"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View style={[styles.formRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Fat (g)</Text>
                    <TextInput
                      value={fatInput}
                      onChangeText={setFatInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="80"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Carbs (g)</Text>
                    <TextInput
                      value={carbsInput}
                      onChangeText={setCarbsInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="250"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </>
            )}

            <Pressable
              onPress={save}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveBtn,
                !canSave && { opacity: 0.4 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Apply goals</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSheetStyles(s),
    calcNoteText: {
    fontSize: s(12),
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 17,
  },
    calcWarning: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
    calcWarningText: {
    fontSize: s(13),
    color: colors.textSecondary,
    lineHeight: 18,
  },
    modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
    modeBtnActive: { backgroundColor: colors.primary },
    modeBtnText: { fontSize: s(13), color: colors.textSecondary, fontWeight: "500" },
    modeBtnTextActive: { color: "#FFFFFF", fontWeight: "600" },
    modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
    marginBottom: 16,
  },
    pickerPlaceholder: { fontSize: s(15), color: colors.textMuted, flex: 1 },
    pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
    pickerText: { fontSize: s(15), color: colors.text, flex: 1 },
    unitPickerChevron: {
    fontSize: s(18),
    color: colors.textSecondary,
    lineHeight: 20,
  },
  });
