import { ChevronRight, Pencil, Plus } from "lucide-react-native";
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
} from "../../src/db/queries";
import { calculateTdee } from "../../src/utils/tdee";
import {
  BodyGoalsSheet,
  CIRC_FIELDS,
  DeltaChip,
  EditMeasurementSheet,
  GoalProgressRow,
  makeStyles,
  MeasurementLineChart,
  MetricDetailSheet,
  ratePerWeek,
  seriesFor,
  StatCard,
  TrendHeroCard,
  emaAt,
  useMeasurements,
  type MeasurementKey,
  type ParsedMeasurement,
} from "../../src/features/measure";
import { colors } from "../../src/theme/colors";
import { useStyles } from "../../src/theme/useStyles";
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
    comparisonDays,
    starting,
    history,
    bodyGoals,
    setBodyGoalsState,
    reload,
  } = useMeasurements();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [detail, setDetail] = useState<{
    key: MeasurementKey;
    label: string;
    unit: string;
    goodOnIncrease: boolean | null;
  } | null>(null);

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

  // Smoothed weight and its rate of change. The raw reading swings with water
  // and glycogen, so the trend leads and the last weigh-in sits beneath it.
  const weightSeries = seriesFor(history, "weight_lb");
  const weightTrend = emaAt(weightSeries);
  const weightRate = ratePerWeek(weightSeries);

  // Deltas compare against the previous check-in, whenever that was. Name the
  // interval so an arrow spanning months is not read as a week of progress.
  const comparisonLabel =
    comparisonDays == null
      ? null
      : comparisonDays === 1
        ? "vs yesterday"
        : comparisonDays < 14
          ? `vs ${comparisonDays} days ago`
          : comparisonDays < 60
            ? `vs ${Math.round(comparisonDays / 7)} weeks ago`
            : `vs ${Math.round(comparisonDays / 30)} months ago`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Body</Text>
          </View>
          {/* Logging is the frequent action, so it is the only thing in the
              header and reads as primary. Goals are edited from the card that
              displays them -- the old header button opened the same sheet as
              that card's pencil. */}
          <Pressable
            onPress={openEdit}
            hitSlop={10}
            accessibilityLabel="Log check-in"
            style={({ pressed }) => [
              styles.logBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.logBtnText}>Log</Text>
          </Pressable>
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

        {/* Smoothed weight leads; raw reading is context. Hidden before the
            first check-in, where the onboarding card already fills this slot. */}
        {latest !== null && (
        <TrendHeroCard
          trend={weightTrend}
          raw={latest?.weight_lb ?? null}
          rawDate={latest?.date ?? null}
          ratePerWeek={weightRate}
          goalWeight={bodyGoals.goal_weight_lb ?? null}
        />
        )}

        {/* Stats grid: weight, body fat, lean mass */}
        {comparisonLabel ? (
          <Text style={styles.comparisonNote}>{comparisonLabel}</Text>
        ) : null}
        <View style={styles.statsGrid}>
          <StatCard
            label="Weight"
            value={latest?.weight_lb != null ? `${latest.weight_lb}` : "—"}
            unit="lbs"
            current={latest?.weight_lb ?? null}
            prior={prior?.weight_lb ?? null}
            goodOnIncrease={false}
            neutral
            onPress={() =>
              setDetail({
                key: "weight_lb",
                label: "Weight",
                unit: " lbs",
                goodOnIncrease: null,
              })
            }
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
            onPress={() =>
              setDetail({
                key: "body_fat_pct",
                label: "Body fat",
                unit: "%",
                goodOnIncrease: false,
              })
            }
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

        {/* Body goals. Always rendered so the pencil is a stable home for goal
            editing -- when nothing is set the card prompts instead of hiding,
            which previously left no way in from this screen. */}
        {latest !== null && (
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
            {bodyGoals.goal_weight_lb == null &&
            bodyGoals.goal_body_fat_pct == null ? (
              <Pressable
                onPress={() => setGoalsModalVisible(true)}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.goalsEmpty}>
                  Set a weight or body fat target to track progress →
                </Text>
              </Pressable>
            ) : null}
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
              <Pressable
                key={f.key}
                onPress={() =>
                  setDetail({
                    key: f.key,
                    label: f.label,
                    unit: "″",
                    goodOnIncrease: f.goodOnIncrease,
                  })
                }
                accessibilityLabel={`${f.label} history`}
                style={({ pressed }) => [
                  styles.listRow,
                  i !== CIRC_FIELDS.length - 1 && styles.listDivider,
                  pressed && { opacity: 0.6 },
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
                  <ChevronRight
                    size={14}
                    color={colors.textMuted}
                    strokeWidth={2}
                  />
                </View>
              </Pressable>
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
                    goodOnIncrease={false}
                  />
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </Screen>

      {/* Edit modal */}
      <EditMeasurementSheet
        visible={editModalVisible}
        latest={latest}
        onClose={() => setEditModalVisible(false)}
        onSave={save}
      />
      {/* Metric history */}
      <MetricDetailSheet
        visible={detail != null}
        metricKey={detail?.key ?? null}
        label={detail?.label ?? ""}
        unit={detail?.unit ?? ""}
        goodOnIncrease={detail?.goodOnIncrease ?? null}
        history={history}
        onClose={() => setDetail(null)}
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


