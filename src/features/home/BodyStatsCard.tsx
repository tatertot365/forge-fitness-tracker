import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { colors } from "../../theme/colors";
import { type BodyGoals } from "../../db/queries";
import { useStyles } from "../../theme/useStyles";
import {
  type Measurement,
} from "../../types";
import { GoalProgressRow } from "./GoalProgressRow";
import { makeSharedStyles } from "./sharedStyles";

// ── Body stats card ───────────────────────────────────────────────────────────

export function BodyStatsCard({
  data,
  goals,
  onPress,
}: {
  data: {
    latest: Measurement | null;
    prev: Measurement | null;
    start: { weight_lb: number | null; body_fat_pct: number | null };
  };
  goals: BodyGoals;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { latest, start } = data;
  const hasGoals =
    goals.goal_weight_lb != null || goals.goal_body_fat_pct != null;
  const noMeasurements = latest === null;

  // Progress is fraction of distance moved from start toward goal. Works in
  // either direction (cut or bulk) and clamps to [0, 1] so an overshoot still
  // shows as "Goal reached".
  const progressFrom = (
    startVal: number | null,
    current: number | null,
    goal: number | null,
  ): number | null => {
    if (startVal == null || current == null || goal == null) return null;
    if (startVal === goal) return current === goal ? 1 : 0;
    const pct = (startVal - current) / (startVal - goal);
    return Math.max(0, Math.min(1, pct));
  };
  const goalReached = (
    current: number | null,
    goal: number | null,
    startVal: number | null,
  ): boolean => {
    if (current == null || goal == null) return false;
    // Direction inferred from start vs goal; without a start, fall back to
    // treating equal-or-better as reached only when current matches exactly.
    if (startVal == null) return current === goal;
    return startVal > goal ? current <= goal : current >= goal;
  };

  // Prefer the per-goal snapshot stored when the goal was set so the bar
  // doesn't drift when today's measurement is re-upserted. Fall back to the
  // earliest measurement only when no snapshot exists yet.
  const weightStart = goals.goal_weight_start_lb ?? start.weight_lb;
  const bfStart = goals.goal_body_fat_start_pct ?? start.body_fat_pct;

  const weightPct = progressFrom(
    weightStart,
    latest?.weight_lb ?? null,
    goals.goal_weight_lb,
  );
  const weightReached = goalReached(
    latest?.weight_lb ?? null,
    goals.goal_weight_lb,
    weightStart,
  );
  const weightRemain =
    latest?.weight_lb != null && goals.goal_weight_lb != null
      ? +Math.abs(latest.weight_lb - goals.goal_weight_lb).toFixed(1)
      : null;

  const bfPct = progressFrom(
    bfStart,
    latest?.body_fat_pct ?? null,
    goals.goal_body_fat_pct,
  );
  const bfReached = goalReached(
    latest?.body_fat_pct ?? null,
    goals.goal_body_fat_pct,
    bfStart,
  );
  const bfRemain =
    latest?.body_fat_pct != null && goals.goal_body_fat_pct != null
      ? +Math.abs(latest.body_fat_pct - goals.goal_body_fat_pct).toFixed(1)
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <Card style={{ marginTop: 10 }}>
        <View style={styles.glanceHeader}>
          <Text style={styles.glanceTitle}>Goal progress</Text>
          <Text style={styles.glanceNav}>Body →</Text>
        </View>

        {!hasGoals || noMeasurements ? (
          <Text style={styles.goalsEmptyText}>
            {noMeasurements
              ? "Log a check-in in Body to start tracking progress →"
              : "Set weight & body fat goals in Body →"}
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
                  weightReached
                    ? "Goal reached"
                    : weightRemain != null
                      ? `${weightRemain} lb to go`
                      : null
                }
                reached={weightReached}
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
                  bfReached
                    ? "Goal reached"
                    : bfRemain != null
                      ? `${bfRemain}% to go`
                      : null
                }
                reached={bfReached}
              />
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSharedStyles(s),
    goalsEmptyText: {
    fontSize: s(13),
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
  });
