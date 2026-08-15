import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../../components/ProgressBar";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";

// ─── Goal progress row ────────────────────────────────────────────────

export function GoalProgressRow({
  label,
  current,
  start,
  goal,
  unit,
}: {
  label: string;
  current: number | null;
  start: number | null;
  goal: number;
  unit: string;
}) {
  const styles = useStyles(makeStyles);
  const hasData = current != null;
  // Direction is set by the user's starting measurement (when the goal was set)
  // relative to the goal. Fall back to current if start is unavailable.
  const reference = start ?? current;
  const lowerIsBetter = reference != null ? reference > goal : false;

  const diff = hasData ? Math.abs(current! - goal) : null;
  const reached =
    hasData && (lowerIsBetter ? current! <= goal : current! >= goal);

  let progress = 0;
  if (hasData) {
    if (start != null && start !== goal) {
      const total = Math.abs(goal - start);
      const done = lowerIsBetter
        ? Math.max(0, start - current!)
        : Math.max(0, current! - start);
      progress = Math.min(1, done / total);
    } else {
      progress = reached ? 1 : 0;
    }
  }

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

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    goalRow: { gap: 4 },
    goalRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
    goalRowLabel: { fontSize: s(13), fontWeight: "500", color: colors.text },
    goalRowValues: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
    goalRowTarget: {
    fontSize: s(12),
    fontWeight: "400",
    color: colors.textSecondary,
  },
    goalRowHint: { fontSize: s(11), color: colors.textSecondary, marginTop: 3 },
  });
