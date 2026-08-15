import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";

export function GoalProgressRow({
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
  const styles = useStyles(makeStyles);
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

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    goalRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
    goalLabel: {
    fontSize: s(12),
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
    fontSize: s(13),
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
    goalSep: {
    fontSize: s(11),
    color: colors.textMuted,
  },
    goalTarget: {
    fontSize: s(13),
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
    fontSize: s(11),
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  });
