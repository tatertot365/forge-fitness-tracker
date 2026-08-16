import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import { type Measurement } from "../../types";
import { MeasurementLineChart } from "./MeasurementLineChart";
import { makeStyles as measureStyles } from "./measureStyles";
import { ratePerWeek, seriesFor } from "./trend";
import { type MeasurementKey } from "./types";

// ─── Metric detail ─────────────────────────────────────────────────────
//
// Opened from a row in the Current list. The list used to be a dead end: five
// numbers with no way to see where any of them came from.

export function MetricDetailSheet({
  visible,
  metricKey,
  label,
  unit,
  goodOnIncrease,
  history,
  onClose,
}: {
  visible: boolean;
  metricKey: MeasurementKey | null;
  label: string;
  unit: string;
  goodOnIncrease: boolean | null;
  history: Measurement[];
  onClose: () => void;
}) {
  const styles = useStyles(measureStyles);
  const local = useStyles(makeLocal);

  const points = metricKey ? seriesFor(history, metricKey) : [];
  const rate = ratePerWeek(points);
  const logged = points.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {metricKey && logged >= 2 ? (
              <>
                <View style={local.chartWrap}>
                  <MeasurementLineChart
                    data={history}
                    valueKey={metricKey}
                    label={label}
                    unit={unit}
                    color={colors.primary}
                    goodOnIncrease={goodOnIncrease}
                  />
                </View>
                <View style={local.statRow}>
                  <Stat
                    label="Rate"
                    value={
                      rate == null
                        ? "—"
                        : Math.abs(rate) < 0.05
                          ? "steady"
                          : `${rate > 0 ? "+" : "−"}${Math.abs(rate).toFixed(1)}${unit}/wk`
                    }
                  />
                  <Stat label="Check-ins" value={String(logged)} />
                  <Stat
                    label="Range"
                    value={`${Math.min(...points.map((p) => p.value)).toFixed(1)}–${Math.max(
                      ...points.map((p) => p.value),
                    ).toFixed(1)}`}
                  />
                </View>
              </>
            ) : (
              <Text style={local.empty}>
                {logged === 1
                  ? "Log this measurement once more to see a trend."
                  : "No history for this measurement yet."}
              </Text>
            )}
            <View style={{ height: 12 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const local = useStyles(makeLocal);
  return (
    <View style={local.stat}>
      <Text style={local.statLabel}>{label}</Text>
      <Text style={local.statValue}>{value}</Text>
    </View>
  );
}

const makeLocal = (s: (n: number) => number) =>
  StyleSheet.create({
    chartWrap: { marginTop: 4 },
    statRow: { flexDirection: "row", gap: 8, marginTop: 18 },
    stat: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    statLabel: {
      fontSize: s(10),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
    },
    statValue: {
      fontSize: s(14),
      fontWeight: "600",
      color: colors.text,
      marginTop: 3,
      fontVariant: ["tabular-nums"],
    },
    empty: {
      fontSize: s(13),
      color: colors.textMuted,
      paddingVertical: 20,
      textAlign: "center",
    },
  });
