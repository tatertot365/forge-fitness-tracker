import DateTimePicker from "@react-native-community/datetimepicker";
import { File, Paths } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Download,
  Minus,
  Pencil,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Dimensions,
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
import Svg, { Circle, Line, Path } from "react-native-svg";
import { ProgressBar } from "../../src/components/ProgressBar";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import {
  exportFoodLogCSV,
  exportMeasurementsCSV,
  exportSessionsCSV,
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
  upsertMeasurement,
  type BodyGoals,
} from "../../src/db/queries";
import {
  calculateTdee,
  type Sex,
  type UserProfile,
} from "../../src/utils/tdee";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
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
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [prior, setPrior] = useState<Measurement | null>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [inputs, setInputs] = useState<Inputs>(EMPTY_INPUTS);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bodyGoals, setBodyGoalsState] = useState<BodyGoals>({
    goal_weight_lb: null,
    goal_body_fat_pct: null,
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
    const [l, p, h, prof, bg] = await Promise.all([
      latestMeasurement(),
      measurementOneWeekAgo(),
      getMeasurementHistory(),
      getUserProfile(),
      getBodyGoals(),
    ]);
    setLatest(l);
    setPrior(p);
    setHistory(h);
    setProfile(prof);
    setBodyGoalsState(bg);
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
    for (const [k, v] of Object.entries(parsed) as [
      keyof typeof parsed,
      number | null,
    ][]) {
      if (inputs[k].trim() !== "" && v == null) {
        Alert.alert(`Invalid value for ${k}`);
        return;
      }
    }
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

  const exportData = async () => {
    try {
      const [measurements, food, sessions] = await Promise.all([
        exportMeasurementsCSV(),
        exportFoodLogCSV(),
        exportSessionsCSV(),
      ]);

      const ts = new Date().toISOString().slice(0, 10);
      const files = [
        { name: `forge_measurements_${ts}.csv`, content: measurements },
        { name: `forge_food_log_${ts}.csv`, content: food },
        { name: `forge_sessions_${ts}.csv`, content: sessions },
      ];

      for (const f of files) {
        const file = new File(Paths.cache, f.name);
        file.write(f.content);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: f.name,
          UTI: 'public.comma-separated-values-text',
        });
      }
    } catch (e) {
      Alert.alert('Export failed', 'Could not export data. Please try again.');
    }
  };

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
              onPress={exportData}
              hitSlop={10}
              style={({ pressed }) => [
                styles.editBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Download size={12} color={colors.primary} strokeWidth={2} />
              <Text style={styles.editBtnText}>Export</Text>
            </Pressable>
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
              <Text style={styles.editBtnText}>Update</Text>
            </Pressable>
          </View>
        </View>

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

        {/* Body goals */}
        {(bodyGoals.goal_weight_lb != null ||
          bodyGoals.goal_body_fat_pct != null) && (
          <View style={styles.goalsCard}>
            <View style={styles.goalsCardHeader}>
              <Text style={styles.goalsCardTitle}>Goals</Text>
              <Pressable
                onPress={() => setGoalsModalVisible(true)}
                hitSlop={10}
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
                goal={bodyGoals.goal_weight_lb}
                unit=" lbs"
                lowerIsBetter
              />
            )}
            {bodyGoals.goal_body_fat_pct != null && (
              <GoalProgressRow
                label="Body fat"
                current={latest?.body_fat_pct ?? null}
                goal={bodyGoals.goal_body_fat_pct}
                unit="%"
                lowerIsBetter
              />
            )}
          </View>
        )}

        {/* Shoulder-to-waist ratio */}
        {latest?.shoulders_in != null && latest?.waist_in != null && (
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
                onBlur={async () => {
                  const v = parseField(heightInput);
                  if (v != null) await saveProfile({ height_in: v });
                }}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="e.g. 70 (5′10″)"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Date of birth</Text>
              <Pressable
                onPress={() => setShowDobPicker((v) => !v)}
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
                <DateTimePicker
                  value={dobDate ?? new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  textColor="#FFFFFF"
                  onChange={async (_, date) => {
                    if (date) {
                      setDobDate(date);
                      const iso = toISODate(date);
                      await saveProfile({ dob: iso });
                    }
                  }}
                  style={{ marginTop: 4 }}
                />
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
                    onChangeText={(t) =>
                      setInputs((p) => ({ ...p, weight_lb: t }))
                    }
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.sheetInput]}
                    placeholder="optional"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Body fat (%)</Text>
                  <TextInput
                    value={inputs.body_fat_pct}
                    onChangeText={(t) =>
                      setInputs((p) => ({ ...p, body_fat_pct: t }))
                    }
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.sheetInput]}
                    placeholder="optional"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              {CIRC_FIELDS.map((f) => (
                <View key={f.key} style={[styles.formRow, { marginTop: 10 }]}>
                  <Text style={styles.formLabel}>{f.label} (inches)</Text>
                  <TextInput
                    value={inputs[f.key]}
                    onChangeText={(t) =>
                      setInputs((p) => ({ ...p, [f.key]: t }))
                    }
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.sheetInput]}
                    placeholder="optional"
                    placeholderTextColor={colors.textMuted}
                  />
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

// ─── Stat card ─────────────────────────���──────────────────────────────

function StatCard({
  label,
  value,
  unit,
  current,
  prior,
  goodOnIncrease,
  neutral,
}: {
  label: string;
  value: string;
  unit: string;
  current: number | null;
  prior: number | null;
  goodOnIncrease: boolean;
  neutral?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{value !== "—" ? unit : ""}</Text>
      <DeltaChip
        current={current}
        prior={prior}
        goodOnIncrease={goodOnIncrease}
        neutral={neutral}
        unit={unit === "lbs" ? " lbs" : unit === "%" ? "%" : " lbs"}
      />
    </View>
  );
}

// ─── Goal progress row ────────────────────────────────────────────────

function GoalProgressRow({
  label,
  current,
  goal,
  unit,
  lowerIsBetter,
}: {
  label: string;
  current: number | null;
  goal: number;
  unit: string;
  lowerIsBetter: boolean;
}) {
  const hasData = current != null;
  const diff = hasData ? Math.abs(current! - goal) : null;
  const reached =
    hasData && (lowerIsBetter ? current! <= goal : current! >= goal);
  const progress = hasData
    ? lowerIsBetter
      ? Math.min(1, goal / Math.max(current!, 0.01))
      : Math.min(1, current! / goal)
    : 0;

  return (
    <View style={styles.goalRow}>
      <View style={styles.goalRowHeader}>
        <Text style={styles.goalRowLabel}>{label}</Text>
        <Text style={styles.goalRowValues}>
          {hasData ? `${current}${unit}` : "—"}
          <Text style={styles.goalRowTarget}>
            {" "}
            → {goal}
            {unit}
          </Text>
        </Text>
      </View>
      <ProgressBar
        value={progress}
        max={1}
        color={reached ? colors.green : colors.primary}
      />
      {hasData && (
        <Text style={[styles.goalRowHint, reached && { color: colors.green }]}>
          {reached ? `Goal reached!` : `${diff!.toFixed(1)}${unit} to go`}
        </Text>
      )}
    </View>
  );
}

// ─── Body goals sheet ──────────────────────────────────────────────────

function BodyGoalsSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: BodyGoals;
  onClose: () => void;
  onSave: (goals: Partial<BodyGoals>) => void;
}) {
  const [weightInput, setWeightInput] = useState("");
  const [bfInput, setBfInput] = useState("");

  React.useEffect(() => {
    if (!visible) return;
    setWeightInput(
      current.goal_weight_lb != null ? String(current.goal_weight_lb) : "",
    );
    setBfInput(
      current.goal_body_fat_pct != null
        ? String(current.goal_body_fat_pct)
        : "",
    );
  }, [visible]);

  const save = () => {
    const w = parseField(weightInput);
    const b = parseField(bfInput);
    if (weightInput.trim() !== "" && w == null) {
      Alert.alert("Enter a valid weight goal");
      return;
    }
    if (bfInput.trim() !== "" && b == null) {
      Alert.alert("Enter a valid body fat goal");
      return;
    }
    if (b != null && (b < 1 || b > 50)) {
      Alert.alert("Body fat goal should be between 1 and 50%");
      return;
    }
    const goals: Partial<BodyGoals> = {};
    if (w != null) goals.goal_weight_lb = w;
    if (b != null) goals.goal_body_fat_pct = b;
    onSave(goals);
  };

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
            <Text style={styles.sheetTitle}>Body goals</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formLabel}>Target weight (lbs)</Text>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput, { marginBottom: 14 }]}
              placeholder="e.g. 185"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.formLabel}>Target body fat (%)</Text>
            <TextInput
              value={bfInput}
              onChangeText={setBfInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput]}
              placeholder="e.g. 5"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              onPress={save}
              style={({ pressed }) => [
                styles.saveBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Save goals</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────

function MeasurementLineChart({
  data,
  valueKey,
  label,
  unit,
  color,
}: {
  data: Measurement[];
  valueKey: "weight_lb" | "body_fat_pct";
  label: string;
  unit: string;
  color: string;
}) {
  const points = data
    .map((m, i) => ({ i, value: m[valueKey] as number | null, date: m.date }))
    .filter((p) => p.value != null) as {
    i: number;
    value: number;
    date: string;
  }[];

  if (points.length < 2) {
    return (
      <View>
        <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={styles.chartEmpty}>Not enough data yet</Text>
      </View>
    );
  }

  const chartWidth = Dimensions.get("window").width - 16 * 2 - 16 * 2;
  const chartHeight = 100;
  const padX = 8;
  const padY = 12;
  const innerW = chartWidth - padX * 2;
  const innerH = chartHeight - padY * 2;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const totalSlots = data.length - 1 || 1;

  const toX = (idx: number) => padX + (idx / totalSlots) * innerW;
  const toY = (v: number) => padY + (1 - (v - minVal) / range) * innerH;

  const pathD = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${toX(p.i).toFixed(1)} ${toY(p.value).toFixed(1)}`,
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.value - first.value;
  const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${unit}`;
  const deltaColor =
    delta === 0
      ? colors.textMuted
      : valueKey === "weight_lb"
        ? colors.textSecondary
        : delta < 0
          ? colors.green
          : colors.red;

  return (
    <View>
      <View style={styles.chartHeader}>
        <Text style={styles.chartLabel}>{label}</Text>
        <View style={styles.chartMeta}>
          <Text style={[styles.chartDelta, { color: deltaColor }]}>
            {deltaStr}
          </Text>
          <Text style={styles.chartRange}>
            {last.value.toFixed(1)}
            {unit}
          </Text>
        </View>
      </View>
      <Svg width={chartWidth} height={chartHeight}>
        <Line
          x1={padX}
          x2={chartWidth - padX}
          y1={chartHeight - padY}
          y2={chartHeight - padY}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Path
          d={pathD}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <Circle
            key={p.date}
            cx={toX(p.i)}
            cy={toY(p.value)}
            r={3}
            fill={color}
          />
        ))}
      </Svg>
      <View
        style={[styles.xAxis, { width: chartWidth, paddingHorizontal: padX }]}
      >
        <Text style={styles.xLabel}>{shortDate(first.date)}</Text>
        <Text style={styles.xLabel}>{shortDate(last.date)}</Text>
      </View>
    </View>
  );
}

// ─── Helpers ───────────────────────────��──────────────────────────────

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function DeltaChip({
  current,
  prior,
  goodOnIncrease,
  neutral,
  unit,
}: {
  current: number | null;
  prior: number | null;
  goodOnIncrease: boolean;
  neutral?: boolean;
  unit: string;
}) {
  if (current == null || prior == null) return <View style={{ height: 18 }} />;
  const d = current - prior;
  if (Math.abs(d) < 0.05) {
    return (
      <View style={styles.deltaChip}>
        <Minus size={11} color={colors.textMuted} strokeWidth={2.5} />
        <Text style={[styles.deltaText, { color: colors.textMuted }]}>0</Text>
      </View>
    );
  }
  const up = d > 0;
  const tint = neutral
    ? colors.textSecondary
    : (goodOnIncrease ? up : !up)
      ? colors.green
      : colors.red;
  return (
    <View style={styles.deltaChip}>
      {up ? (
        <ArrowUp size={11} color={tint} strokeWidth={2.5} />
      ) : (
        <ArrowDown size={11} color={tint} strokeWidth={2.5} />
      )}
      <Text style={[styles.deltaText, { color: tint }]}>
        {Math.abs(d).toFixed(1)}
        {unit}
      </Text>
    </View>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: {
    ...typography.caption,
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
  editBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },

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
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  goalRow: { gap: 4 },
  goalRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  goalRowLabel: { fontSize: 13, fontWeight: "500", color: colors.text },
  goalRowValues: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  goalRowTarget: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  goalRowHint: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },

  // Stats grid
  statsGrid: { flexDirection: "row", gap: 8, marginBottom: 2 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
    gap: 1,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginTop: 3,
  },
  statUnit: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },

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
    fontSize: 11,
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
  ratioValue: { fontSize: 34, fontWeight: "600", color: colors.text },
  ratioTarget: { fontSize: 14, color: colors.textSecondary },
  ratioPct: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 8,
  },
  ratioHint: {
    fontSize: 12,
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
  listLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  listTrailing: { flexDirection: "row", alignItems: "center", gap: 8 },
  listValue: {
    fontSize: 15,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  deltaChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  deltaText: { fontSize: 11, fontWeight: "600" },

  // Profile collapsible
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 8,
  },
  profileHeaderText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  profileHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileIncomplete: {
    fontSize: 11,
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
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
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
  saveBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: 15, color: colors.text },
  pickerPlaceholder: { fontSize: 15, color: colors.textMuted },
  pickerChevron: { fontSize: 18, color: colors.textSecondary, lineHeight: 20 },

  // BF banner
  bfBanner: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  bfBannerText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  // Chart
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  chartLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  chartMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  chartDelta: { fontSize: 12, fontWeight: "600" },
  chartRange: {
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  chartEmpty: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  xLabel: { fontSize: 10, color: colors.textMuted },

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
  sheetTitle: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  sheetClose: { fontSize: 18, color: colors.textSecondary, padding: 4 },
});
