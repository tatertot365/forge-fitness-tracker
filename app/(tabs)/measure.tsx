import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  InputAccessoryView,
  Keyboard,
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
import { ProgressBar } from "../../src/components/ProgressBar";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import {
  backfillBodyGoalStarts,
  getActivityLevel,
  getBodyGoals,
  getGoalsMode,
  getMeasurementHistory,
  getPhase,
  getUserProfile,
  latestMeasurement,
  measurementOneWeekAgo,
  setBodyGoals,
  setNutritionGoal,
  setUserProfile,
  startingMeasurement,
  upsertMeasurement,
  type BodyGoals,
} from "../../src/db/queries";
import {
  calculateTdee,
  type Sex,
  type UserProfile,
} from "../../src/utils/tdee";
import {
  BodyGoalsSheet,
  DeltaChip,
  GoalProgressRow,
  MeasurementLineChart,
  StatCard,
} from "../../src/features/measure";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import { useStyles } from "../../src/theme/useStyles";
import { type Measurement } from "../../src/types";
import { todayISO } from "../../src/utils/date";

const TARGET_RATIO = 1.618;

type CircField = {
  key: keyof Pick<
    Measurement,
    "shoulders_in" | "waist_in" | "arms_flexed_in" | "chest_in" | "quads_in"
  >;
  label: string;
  goodOnIncrease: boolean;
};

const CIRC_FIELDS: CircField[] = [
  { key: "shoulders_in", label: "Shoulders", goodOnIncrease: true },
  { key: "waist_in", label: "Waist", goodOnIncrease: false },
  { key: "arms_flexed_in", label: "Arms (flexed)", goodOnIncrease: true },
  { key: "chest_in", label: "Chest", goodOnIncrease: true },
  { key: "quads_in", label: "Quads", goodOnIncrease: true },
];

// Sanity ranges — block save outside these to prevent typos flowing into macros.
const RANGES: Record<keyof Inputs, { min: number; max: number; label: string }> = {
  weight_lb:      { min: 50, max: 700, label: "Weight should be 50–700 lb" },
  body_fat_pct:   { min: 3,  max: 60,  label: "Body fat should be 3–60%" },
  shoulders_in:   { min: 5,  max: 80,  label: "Shoulders should be 5–80 in" },
  waist_in:       { min: 5,  max: 80,  label: "Waist should be 5–80 in" },
  arms_flexed_in: { min: 5,  max: 80,  label: "Arms should be 5–80 in" },
  chest_in:       { min: 5,  max: 80,  label: "Chest should be 5–80 in" },
  quads_in:       { min: 5,  max: 80,  label: "Quads should be 5–80 in" },
};

const HEIGHT_RANGE = { min: 36, max: 96, label: "Height should be 36–96 in" };
const HEIGHT_INPUT_ID = "height-input-accessory";
const AGE_RANGE = { min: 13, max: 100, label: "Age must be 13–100" };

type Inputs = {
  weight_lb: string;
  body_fat_pct: string;
  shoulders_in: string;
  waist_in: string;
  arms_flexed_in: string;
  chest_in: string;
  quads_in: string;
};

const EMPTY_INPUTS: Inputs = {
  weight_lb: "",
  body_fat_pct: "",
  shoulders_in: "",
  waist_in: "",
  arms_flexed_in: "",
  chest_in: "",
  quads_in: "",
};

function leanMass(
  weight_lb: number | null | undefined,
  body_fat_pct: number | null | undefined,
): number | null {
  if (weight_lb == null || body_fat_pct == null) return null;
  return weight_lb * (1 - body_fat_pct / 100);
}

export default function MeasureScreen() {
  const styles = useStyles(makeStyles);
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [prior, setPrior] = useState<Measurement | null>(null);
  const [starting, setStarting] = useState<{
    weight_lb: number | null;
    body_fat_pct: number | null;
  }>({ weight_lb: null, body_fat_pct: null });
  const [history, setHistory] = useState<Measurement[]>([]);
  const [inputs, setInputs] = useState<Inputs>(EMPTY_INPUTS);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Inputs, string>>>({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bodyGoals, setBodyGoalsState] = useState<BodyGoals>({
    goal_weight_lb: null,
    goal_body_fat_pct: null,
    goal_weight_start_lb: null,
    goal_body_fat_start_pct: null,
    show_ratio_card: false,
  });
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    height_in: null,
    dob: null,
    sex: null,
  });
  const [heightInput, setHeightInput] = useState("");
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  const load = useCallback(async () => {
    await backfillBodyGoalStarts();
    const [l, p, h, prof, bg, st] = await Promise.all([
      latestMeasurement(),
      measurementOneWeekAgo(),
      getMeasurementHistory(),
      getUserProfile(),
      getBodyGoals(),
      startingMeasurement(),
    ]);
    setLatest(l);
    setPrior(p);
    setHistory(h);
    setProfile(prof);
    setBodyGoalsState(bg);
    setStarting(st);
    setHeightInput(prof.height_in != null ? String(prof.height_in) : "");
    setDobDate(prof.dob ? new Date(prof.dob) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveProfile = async (patch: Partial<UserProfile>) => {
    await setUserProfile(patch);
    setProfile((p) => ({ ...p, ...patch }));
  };

  const commitHeight = async () => {
    const v = parseField(heightInput);
    if (v == null) return;
    if (v < HEIGHT_RANGE.min || v > HEIGHT_RANGE.max) {
      Alert.alert(HEIGHT_RANGE.label);
      setHeightInput(
        profile.height_in != null ? String(profile.height_in) : "",
      );
      return;
    }
    await saveProfile({ height_in: v });
  };

  const pickSex = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Male", "Female", "Cancel"], cancelButtonIndex: 2 },
      async (idx) => {
        if (idx === 0) await saveProfile({ sex: "male" });
        else if (idx === 1) await saveProfile({ sex: "female" });
      },
    );
  };

  const openEdit = () => {
    if (latest) {
      setInputs({
        weight_lb: latest.weight_lb != null ? String(latest.weight_lb) : "",
        body_fat_pct:
          latest.body_fat_pct != null ? String(latest.body_fat_pct) : "",
        shoulders_in:
          latest.shoulders_in != null ? String(latest.shoulders_in) : "",
        waist_in: latest.waist_in != null ? String(latest.waist_in) : "",
        arms_flexed_in:
          latest.arms_flexed_in != null ? String(latest.arms_flexed_in) : "",
        chest_in: latest.chest_in != null ? String(latest.chest_in) : "",
        quads_in: latest.quads_in != null ? String(latest.quads_in) : "",
      });
    } else {
      setInputs(EMPTY_INPUTS);
    }
    setEditModalVisible(true);
  };

  const save = async () => {
    const parsed = {
      weight_lb: parseField(inputs.weight_lb),
      body_fat_pct: parseField(inputs.body_fat_pct),
      shoulders_in: parseField(inputs.shoulders_in),
      waist_in: parseField(inputs.waist_in),
      arms_flexed_in: parseField(inputs.arms_flexed_in),
      chest_in: parseField(inputs.chest_in),
      quads_in: parseField(inputs.quads_in),
    };
    const errs: Partial<Record<keyof Inputs, string>> = {};
    for (const [k, v] of Object.entries(parsed) as [
      keyof typeof parsed,
      number | null,
    ][]) {
      if (inputs[k].trim() !== "" && v == null) {
        errs[k] = "Enter a valid number";
        continue;
      }
      if (v != null) {
        const r = RANGES[k];
        if (v < r.min || v > r.max) {
          errs[k] = r.label;
        }
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    const today = todayISO();
    await upsertMeasurement(today, parsed);

    const [goalsMode, activity, phase, freshProfile] = await Promise.all([
      getGoalsMode(),
      getActivityLevel(),
      getPhase(),
      getUserProfile(),
    ]);
    if (goalsMode === "calculated" && activity) {
      const weight = parsed.weight_lb ?? (await latestMeasurement())?.weight_lb;
      const bodyFat =
        parsed.body_fat_pct ??
        (await latestMeasurement())?.body_fat_pct ??
        null;
      if (weight) {
        const result = calculateTdee({
          weight_lb: weight,
          body_fat_pct: bodyFat,
          profile: freshProfile,
          activity,
          phase,
        });
        if (result.ok) {
          await setNutritionGoal(today, {
            calorie_goal: result.goals.calories,
            protein_goal: result.goals.protein_g,
            fat_goal: result.goals.fat_g,
            carbs_goal: result.goals.carbs_g,
          });
        }
      }
    }

    Keyboard.dismiss();
    setEditModalVisible(false);
    setInputs(EMPTY_INPUTS);
    load();
  };

  const ratio =
    latest?.shoulders_in != null &&
    latest?.waist_in != null &&
    latest.waist_in > 0
      ? latest.shoulders_in / latest.waist_in
      : null;
  const pctOff =
    ratio != null
      ? Math.abs((TARGET_RATIO - ratio) / TARGET_RATIO) * 100
      : null;

  const currentLean = leanMass(latest?.weight_lb, latest?.body_fat_pct);
  const priorLean = leanMass(prior?.weight_lb, prior?.body_fat_pct);

  const hasBfHistory = history.some((m) => m.body_fat_pct != null);
  const profileComplete =
    profile.height_in != null && profile.dob != null && profile.sex != null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Measurements</Text>
            <Text style={styles.subtitle}>
              Shoulder-to-waist ratio · target {TARGET_RATIO}
            </Text>
          </View>
          <View style={styles.headerBtns}>
            <Pressable
              onPress={() => setGoalsModalVisible(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.editBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.editBtnText}>Goals</Text>
            </Pressable>
            <Pressable
              onPress={openEdit}
              hitSlop={10}
              style={({ pressed }) => [
                styles.editBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Pencil size={12} color={colors.primary} strokeWidth={2} />
              <Text style={styles.editBtnText}>Log</Text>
            </Pressable>
          </View>
        </View>

        {/* First-launch onboarding prompt */}
        {latest === null && (
          <Pressable
            onPress={openEdit}
            style={({ pressed }) => [
              styles.firstCheckInCard,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.firstCheckInTitle}>Log your first check-in</Text>
            <Text style={styles.firstCheckInSub}>
              Track weight, body fat and measurements to see your trends over time.
            </Text>
            <Text style={styles.firstCheckInCta}>Tap Log above to get started →</Text>
          </Pressable>
        )}

        {/* Stats grid: weight, body fat, lean mass */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Weight"
            value={latest?.weight_lb != null ? `${latest.weight_lb}` : "—"}
            unit="lbs"
            current={latest?.weight_lb ?? null}
            prior={prior?.weight_lb ?? null}
            goodOnIncrease={false}
            neutral
          />
          <StatCard
            label="Body fat"
            value={
              latest?.body_fat_pct != null ? `${latest.body_fat_pct}` : "—"
            }
            unit="%"
            current={latest?.body_fat_pct ?? null}
            prior={prior?.body_fat_pct ?? null}
            goodOnIncrease={false}
          />
          <StatCard
            label="Lean mass"
            value={currentLean != null ? currentLean.toFixed(1) : "—"}
            unit="lbs"
            current={currentLean}
            prior={priorLean}
            goodOnIncrease={true}
          />
        </View>

        {/* Profile — collapsible */}
        <Pressable
          onPress={() => setProfileExpanded((v) => !v)}
          style={styles.profileHeader}
        >
          <Text style={styles.profileHeaderText}>Profile</Text>
          <View style={styles.profileHeaderRight}>
            {!profileComplete && (
              <Text style={styles.profileIncomplete}>Incomplete</Text>
            )}
            {profileExpanded ? (
              <ChevronUp
                size={14}
                color={colors.textSecondary}
                strokeWidth={2}
              />
            ) : (
              <ChevronDown
                size={14}
                color={colors.textSecondary}
                strokeWidth={2}
              />
            )}
          </View>
        </Pressable>
        {profileExpanded && (
          <View style={styles.formCard}>
            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Height (inches)</Text>
              <TextInput
                value={heightInput}
                onChangeText={setHeightInput}
                onBlur={commitHeight}
                onSubmitEditing={() => {
                  commitHeight();
                  Keyboard.dismiss();
                }}
                returnKeyType="done"
                inputAccessoryViewID={
                  Platform.OS === "ios" ? HEIGHT_INPUT_ID : undefined
                }
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="e.g. 70 (5′10″)"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Date of birth</Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDobPicker(true);
                }}
                style={({ pressed }) => [
                  styles.input,
                  styles.pickerRow,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={dobDate ? styles.pickerText : styles.pickerPlaceholder}
                >
                  {dobDate ? formatDob(dobDate) : "Select date…"}
                </Text>
                <Text style={styles.pickerChevron}>›</Text>
              </Pressable>
              {showDobPicker && (
                <>
                  <DateTimePicker
                    value={dobDate ?? new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    textColor="#FFFFFF"
                    onChange={async (event, date) => {
                      // Android fires once with type=set/dismissed and the
                      // picker dismisses itself — close it here too.
                      if (Platform.OS === "android") {
                        setShowDobPicker(false);
                        if (event.type !== "set" || !date) return;
                      } else if (!date) {
                        return;
                      }
                      const age = Math.floor(
                        (Date.now() - date.getTime()) /
                          (365.25 * 24 * 3600 * 1000),
                      );
                      if (age < AGE_RANGE.min || age > AGE_RANGE.max) {
                        Alert.alert(AGE_RANGE.label);
                        return;
                      }
                      setDobDate(date);
                      const iso = toISODate(date);
                      await saveProfile({ dob: iso });
                    }}
                    style={{ marginTop: 4 }}
                  />
                  {Platform.OS === "ios" && (
                    <Pressable
                      onPress={() => setShowDobPicker(false)}
                      style={({ pressed }) => [
                        styles.dobDoneBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.dobDoneBtnText}>Done</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
            <View style={[styles.formRow, { marginBottom: 0 }]}>
              <Text style={styles.formLabel}>Sex</Text>
              <Pressable
                onPress={pickSex}
                style={({ pressed }) => [
                  styles.input,
                  styles.pickerRow,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={
                    profile.sex ? styles.pickerText : styles.pickerPlaceholder
                  }
                >
                  {profile.sex === "male"
                    ? "Male"
                    : profile.sex === "female"
                      ? "Female"
                      : "Select…"}
                </Text>
                <Text style={styles.pickerChevron}>›</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Body goals */}
        {(bodyGoals.goal_weight_lb != null ||
          bodyGoals.goal_body_fat_pct != null) && (
          <View style={styles.goalsCard}>
            <View style={styles.goalsCardHeader}>
              <Text style={styles.goalsCardTitle}>Goals</Text>
              <Pressable
                onPress={() => setGoalsModalVisible(true)}
                hitSlop={10}
                accessibilityLabel="Edit goals"
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Pencil
                  size={13}
                  color={colors.textSecondary}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
            {bodyGoals.goal_weight_lb != null && (
              <GoalProgressRow
                label="Weight"
                current={latest?.weight_lb ?? null}
                start={bodyGoals.goal_weight_start_lb ?? starting.weight_lb}
                goal={bodyGoals.goal_weight_lb}
                unit=" lbs"
              />
            )}
            {bodyGoals.goal_body_fat_pct != null && (
              <GoalProgressRow
                label="Body fat"
                current={latest?.body_fat_pct ?? null}
                start={
                  bodyGoals.goal_body_fat_start_pct ?? starting.body_fat_pct
                }
                goal={bodyGoals.goal_body_fat_pct}
                unit="%"
              />
            )}
          </View>
        )}

        {/* Shoulder-to-waist ratio */}
        {bodyGoals.show_ratio_card && latest?.shoulders_in != null && latest?.waist_in != null && (
          <View style={styles.ratioCard}>
            <Text style={styles.ratioLabel}>Shoulder-to-waist ratio</Text>
            <View style={styles.ratioValueRow}>
              <Text style={styles.ratioValue}>
                {ratio != null ? ratio.toFixed(2) : "—"}
              </Text>
              <Text style={styles.ratioTarget}>/ {TARGET_RATIO}</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar
                value={ratio ?? 0}
                max={TARGET_RATIO}
                color={colors.primary}
              />
            </View>
            <Text style={styles.ratioPct}>
              {pctOff != null ? `${pctOff.toFixed(1)}% off target` : ""}
            </Text>
            <Text style={styles.ratioHint}>
              Expand shoulders or tighten waist to close the gap.
            </Text>
          </View>
        )}

        {/* Circumference measurements */}
        <SectionLabel>Current</SectionLabel>
        <View style={styles.listCard}>
          {CIRC_FIELDS.map((f, i) => {
            const current = latest?.[f.key] ?? null;
            const previous = prior?.[f.key] ?? null;
            return (
              <View
                key={f.key}
                style={[
                  styles.listRow,
                  i !== CIRC_FIELDS.length - 1 && styles.listDivider,
                ]}
              >
                <Text style={styles.listLabel}>{f.label}</Text>
                <View style={styles.listTrailing}>
                  <Text style={styles.listValue}>
                    {current != null ? `${current.toFixed(1)}″` : "—"}
                  </Text>
                  <DeltaChip
                    current={current}
                    prior={previous}
                    goodOnIncrease={f.goodOnIncrease}
                    unit="″"
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Body fat prompt banner */}
        {latest?.body_fat_pct == null && (
          <View style={styles.bfBanner}>
            <Text style={styles.bfBannerText}>
              Log your body fat % to unlock lean mass tracking and more accurate
              macro calculations.
            </Text>
          </View>
        )}

        {/* Trend chart */}
        {history.length >= 2 ? (
          <>
            <SectionLabel>Trends</SectionLabel>
            <View style={styles.chartCard}>
              <MeasurementLineChart
                data={history}
                valueKey="weight_lb"
                label="Weight"
                unit=" lbs"
                color={colors.primary}
              />
              {hasBfHistory ? (
                <View style={{ marginTop: 20 }}>
                  <MeasurementLineChart
                    data={history}
                    valueKey="body_fat_pct"
                    label="Body fat"
                    unit="%"
                    color={colors.warning}
                  />
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </Screen>

      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={HEIGHT_INPUT_ID}>
          <View style={styles.accessoryBar}>
            <Pressable
              onPress={() => {
                commitHeight();
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [
                styles.accessoryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.accessoryBtnText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* Edit modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetBackdrop}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setEditModalVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Update measurements</Text>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Text style={styles.sheetClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Weight (lbs)</Text>
                  <TextInput
                    value={inputs.weight_lb}
                    onChangeText={(t: string) => {
                      setInputs((p) => ({ ...p, weight_lb: t }));
                      if (fieldErrors.weight_lb)
                        setFieldErrors((e) => ({ ...e, weight_lb: undefined }));
                    }}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      styles.sheetInput,
                      fieldErrors.weight_lb && styles.inputError,
                    ]}
                    placeholder="optional"
                    placeholderTextColor={colors.textMuted}
                  />
                  {fieldErrors.weight_lb ? (
                    <Text style={styles.errorText}>{fieldErrors.weight_lb}</Text>
                  ) : null}
                </View>
                <View style={{ flex: 1, marginTop: 10 }}>
                  <Text style={styles.formLabel}>Body fat (%)</Text>
                  <TextInput
                    value={inputs.body_fat_pct}
                    onChangeText={(t: string) => {
                      setInputs((p) => ({ ...p, body_fat_pct: t }));
                      if (fieldErrors.body_fat_pct)
                        setFieldErrors((e) => ({
                          ...e,
                          body_fat_pct: undefined,
                        }));
                    }}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      styles.sheetInput,
                      fieldErrors.body_fat_pct && styles.inputError,
                    ]}
                    placeholder="optional"
                    placeholderTextColor={colors.textMuted}
                  />
                  {fieldErrors.body_fat_pct ? (
                    <Text style={styles.errorText}>{fieldErrors.body_fat_pct}</Text>
                  ) : null}
                </View>
              </View>
              {CIRC_FIELDS.map((f) => (
                <View key={f.key} style={[styles.formRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>{f.label} (inches)</Text>
                    <TextInput
                      value={inputs[f.key]}
                      onChangeText={(t: string) => {
                        setInputs((p) => ({ ...p, [f.key]: t }));
                        if (fieldErrors[f.key])
                          setFieldErrors((e) => ({ ...e, [f.key]: undefined }));
                      }}
                      keyboardType="decimal-pad"
                      style={[
                        styles.input,
                        styles.sheetInput,
                        fieldErrors[f.key] && styles.inputError,
                      ]}
                      placeholder="optional"
                      placeholderTextColor={colors.textMuted}
                    />
                    {fieldErrors[f.key] ? (
                      <Text style={styles.errorText}>{fieldErrors[f.key]}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <Pressable
                onPress={save}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { marginTop: 16 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.saveBtnText}>Save measurements</Text>
              </Pressable>
              <View style={{ height: 8 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Goals modal */}
      <BodyGoalsSheet
        visible={goalsModalVisible}
        current={bodyGoals}
        onClose={() => setGoalsModalVisible(false)}
        onSave={async (goals) => {
          await setBodyGoals(goals);
          setBodyGoalsState((prev) => ({ ...prev, ...goals }));
          setGoalsModalVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDob(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function parseField(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── Styles ─────────────────────────────���─────────────────────────────

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  inputError: {
    borderColor: colors.red,
    borderWidth: 1,
  },
  errorText: {
    color: colors.red,
    fontSize: s(12),
    marginTop: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { ...typography.screenTitle, fontSize: s(22), color: colors.text },
  subtitle: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
  },

  headerBtns: { flexDirection: "row", gap: 8 },
  editBtn: {
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
  editBtnText: { fontSize: s(12), fontWeight: "600", color: colors.primary },

  // Goals card
  goalsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginTop: 6,
    gap: 12,
  },
  goalsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalsCardTitle: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  // First-launch card
  firstCheckInCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  firstCheckInTitle: {
    fontSize: s(15),
    fontWeight: "600",
    color: colors.text,
  },
  firstCheckInSub: {
    fontSize: s(13),
    color: colors.textSecondary,
    lineHeight: 18,
  },
  firstCheckInCta: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.primary,
    marginTop: 4,
  },

  // Stats grid
  statsGrid: { flexDirection: "row", gap: 8, marginBottom: 2 },
  // Ratio card
  ratioCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    marginTop: 6,
  },
  ratioLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  ratioValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  ratioValue: { fontSize: s(34), fontWeight: "600", color: colors.text },
  ratioTarget: { fontSize: s(14), color: colors.textSecondary },
  ratioPct: {
    fontSize: s(12),
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 8,
  },
  ratioHint: {
    fontSize: s(12),
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: "italic",
  },

  // List
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  listDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listLabel: { fontSize: s(14), fontWeight: "500", color: colors.text },
  listTrailing: { flexDirection: "row", alignItems: "center", gap: 8 },
  listValue: {
    fontSize: s(15),
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  // Profile collapsible
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 8,
  },
  profileHeaderText: {
    fontSize: s(11),
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  profileHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileIncomplete: {
    fontSize: s(11),
    color: colors.warning,
    fontWeight: "500",
  },

  // Form
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  formRow: { marginBottom: 10 },
  formLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    fontSize: s(15),
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  sheetInput: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: s(15), color: colors.text },
  pickerPlaceholder: { fontSize: s(15), color: colors.textMuted },
  pickerChevron: { fontSize: s(18), color: colors.textSecondary, lineHeight: 20 },

  dobDoneBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dobDoneBtnText: { color: "#FFFFFF", fontSize: s(13), fontWeight: "600" },

  accessoryBar: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  accessoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  accessoryBtnText: { color: "#FFFFFF", fontSize: s(13), fontWeight: "600" },

  // BF banner
  bfBanner: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  bfBannerText: { fontSize: s(13), color: colors.textSecondary, lineHeight: 18 },

  // Chart
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  // Edit sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
  sheetClose: { fontSize: s(18), color: colors.textSecondary, padding: 4 },
});

