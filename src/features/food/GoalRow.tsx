import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "../../components/ProgressBar";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";

export function GoalRow({
  icon,
  label,
  value,
  goal,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const styles = useStyles(makeStyles);
  const remaining = Math.max(0, goal - value);
  const over = value > goal;
  return (
    <View>
      <View style={styles.goalHeader}>
        <View style={styles.goalLabelRow}>
          {icon}
          <Text style={styles.goalLabel}>{label}</Text>
        </View>
        <Text style={styles.goalValue}>
          {Math.round(value).toLocaleString()}
          <Text style={styles.goalGoal}>
            {" / "}
            {Math.round(goal).toLocaleString()} {unit}
          </Text>
        </Text>
      </View>
      <ProgressBar
        value={value}
        max={goal}
        color={over ? colors.warning : color}
      />
      <Text style={[styles.goalRemaining, over && { color: colors.warning }]}>
        {over
          ? `${Math.round(value - goal).toLocaleString()} ${unit} over`
          : `${Math.round(remaining).toLocaleString()} ${unit} left`}
      </Text>
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    goalGoal: {
    fontSize: s(12),
    fontWeight: "400",
    color: colors.textSecondary,
  },
    goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
    goalLabel: { ...typography.exerciseName, fontSize: s(14), color: colors.text },
    goalLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    goalRemaining: {
    fontSize: s(11),
    color: colors.textSecondary,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
    goalValue: {
    fontSize: s(14),
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  });
