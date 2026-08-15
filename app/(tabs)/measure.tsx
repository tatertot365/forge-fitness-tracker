import { Pencil } from "lucide-react-native";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { ProgressBar } from "../../src/components/ProgressBar";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import {
  getActivityLevel,
  getGoalsMode,
  getPhase,
  getUserProfile,
  latestMeasurement,
  setBodyGoals,
  setNutritionGoal,
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
  CIRC_FIELDS,
  DeltaChip,
  EditMeasurementSheet,
  GoalProgressRow,
  makeStyles,
  MeasurementLineChart,
  StatCard,
  HeightInputAccessory,
  ProfileSection,
  useHeightField,
  useMeasurements,
  type ParsedMeasurement,
} from "../../src/features/measure";
import { colors } from "../../src/theme/colors";
import { useStyles } from "../../src/theme/useStyles";
import { type Measurement } from "../../src/types";
import { todayISO } from "../../src/utils/date";

const TARGET_RATIO = 1.618;

function leanMass(
  weight_lb: number | null | undefined,
  body_fat_pct: number | null | undefined,
): number | null {
  if (weight_lb == null || body_fat_pct == null) return null;
  return weight_lb * (1 - body_fat_pct / 100);
}

export default function MeasureScreen() {
  const styles = useStyles(makeStyles);
  const {
    latest,
    prior,
    starting,
    history,
    bodyGoals,
    setBodyGoalsState,
    profile,
    saveProfile,
    reload,
  } = useMeasurements();
  const { heightInput, setHeightInput, commitHeight } = useHeightField(
    profile,
    saveProfile,
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);

  const openEdit = () => setEditModalVisible(true);

  const save = async (parsed: ParsedMeasurement) => {
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
    reload();
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
        <ProfileSection
          profile={profile}
          onSave={saveProfile}
          heightInput={heightInput}
          setHeightInput={setHeightInput}
          commitHeight={commitHeight}
        />
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

      <HeightInputAccessory onDone={commitHeight} />

      {/* Edit modal */}
      <EditMeasurementSheet
        visible={editModalVisible}
        latest={latest}
        onClose={() => setEditModalVisible(false)}
        onSave={save}
      />
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


