import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";

// ─── Trend hero ────────────────────────────────────────────────────────
//
// The smoothed weight leads; the raw reading is demoted to context beneath it.
// A single scale value swings with water, glycogen and gut contents, so
// showing it at hero size invites reading noise as progress.

export function TrendHeroCard({
  trend,
  raw,
  rawDate,
  ratePerWeek,
  goalWeight,
}: {
  trend: number | null;
  raw: number | null;
  rawDate: string | null;
  ratePerWeek: number | null;
  goalWeight: number | null;
}) {
  const styles = useStyles(makeStyles);

  if (trend == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Weight trend</Text>
        <Text style={styles.empty}>Log a weight to start your trend</Text>
      </View>
    );
  }

  // Direction is only meaningful against a goal: losing is progress on a cut
  // and regression on a bulk. With no goal set, stay neutral rather than
  // guessing which way the user wants to go.
  const towardGoal =
    goalWeight != null && ratePerWeek != null && Math.abs(ratePerWeek) >= 0.05
      ? (goalWeight < trend) === (ratePerWeek < 0)
      : null;
  const rateTint =
    towardGoal == null
      ? colors.textSecondary
      : towardGoal
        ? colors.green
        : colors.warning;

  const rateText =
    ratePerWeek == null
      ? "Not enough data for a rate yet"
      : Math.abs(ratePerWeek) < 0.05
        ? "Holding steady"
        : `${ratePerWeek > 0 ? "+" : "−"}${Math.abs(ratePerWeek).toFixed(1)} lb / week`;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Weight trend</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{trend.toFixed(1)}</Text>
        <Text style={styles.unit}>lbs</Text>
      </View>
      <Text style={[styles.rate, { color: rateTint }]}>{rateText}</Text>
      {raw != null && Math.abs(raw - trend) >= 0.05 ? (
        <Text style={styles.raw}>
          Last weigh-in {raw.toFixed(1)} lbs
          {rawDate ? ` · ${formatDate(rawDate)}` : ""}
        </Text>
      ) : rawDate ? (
        <Text style={styles.raw}>Last weigh-in {formatDate(rawDate)}</Text>
      ) : null}
    </View>
  );
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8,
    },
    label: {
      fontSize: s(10),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
    },
    valueRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 4 },
    value: {
      fontSize: s(34),
      fontWeight: "600",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    unit: { fontSize: s(13), color: colors.textSecondary },
    rate: { fontSize: s(13), fontWeight: "600", marginTop: 2 },
    raw: { fontSize: s(11), color: colors.textMuted, marginTop: 6 },
    empty: { fontSize: s(13), color: colors.textMuted, marginTop: 6 },
  });
