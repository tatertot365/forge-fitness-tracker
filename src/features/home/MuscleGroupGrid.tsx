import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, muscleAccent } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import {
  MUSCLE_LABEL,
  type MuscleGroup,
} from "../../types";

// ── Muscle group grid ─────────────────────────────────────────────────────────

export function MuscleGroupGrid({
  sets,
}: {
  sets: Partial<Record<MuscleGroup, number>>;
}) {
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  // 16px screen padding × 2 sides + 8px gap between the two columns.
  const cellWidth = (width - 40) / 2;
  const entries = Object.entries(sets) as [MuscleGroup, number][];
  return (
    <View style={styles.mgGrid}>
      {entries.map(([group, count]) => (
        <View key={group} style={[styles.mgCell, { width: cellWidth }]}>
          <View
            style={[
              styles.mgAccent,
              { backgroundColor: muscleAccent[group] ?? colors.primary },
            ]}
          />
          <View style={styles.mgContent}>
            <Text style={styles.mgName} numberOfLines={1}>
              {MUSCLE_LABEL[group]}
            </Text>
            <Text style={styles.mgCount}>
              {count} set{count === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    mgGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
    mgCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
    mgAccent: {
    width: 3,
    height: 28,
    borderRadius: 2,
  },
    mgContent: { flex: 1 },
    mgName: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.text,
  },
    mgCount: {
    fontSize: s(11),
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  });
