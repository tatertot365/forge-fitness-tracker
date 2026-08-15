import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { DeltaChip } from "./DeltaChip";

// ─── Stat card ─────────────────────────���──────────────────────────────

export function StatCard({
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
  const styles = useStyles(makeStyles);
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

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
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
    fontSize: s(10),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
    statValue: {
    fontSize: s(20),
    fontWeight: "600",
    color: colors.text,
    marginTop: 3,
  },
    statUnit: { fontSize: s(11), color: colors.textSecondary, marginBottom: 2 },
  });
