import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, muscleAccent } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import {
  MUSCLE_LABEL,
  type MuscleGroup,
} from "../../types";
import { volumeStatus, volumeTarget } from "./volumeTargets";

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
      {entries.map(([group, count]) => {
        const target = volumeTarget(group);
        const status = volumeStatus(count, target);
        // The bar fills toward the top of the range, so a group sitting at the
        // minimum reads as partial rather than done -- min is the floor for
        // growth, not the goal.
        const pct = Math.max(0, Math.min(1, count / target.max));
        const barColor =
          status === "under"
            ? colors.textMuted
            : status === "over"
              ? colors.amber
              : colors.green;
        return (
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
              <View style={styles.mgBarTrack}>
                <View
                  style={[
                    styles.mgBarFill,
                    { width: `${pct * 100}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
              <Text style={styles.mgCount}>
                {count}
                <Text style={styles.mgTargetText}>
                  {" "}
                  / {target.min}-{target.max} sets
                </Text>
              </Text>
            </View>
          </View>
        );
      })}
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
    color: colors.text,
    fontWeight: "600",
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
    mgTargetText: { color: colors.textSecondary, fontWeight: "400" },
    mgBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    marginTop: 6,
  },
    mgBarFill: { height: "100%", borderRadius: 2 },
  });
