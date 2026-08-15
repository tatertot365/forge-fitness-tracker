import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { Card } from "../../components/Card";
import { colors } from "../../theme/colors";
import { type DailyNutritionTotal } from "../../types";
import { useStyles } from "../../theme/useStyles";
import { makeSharedStyles } from "./sharedStyles";

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

// ── Macro ring card ───────────────────────────────────────────────────────────

export function MacroRingCard({
  data,
  goalSet,
  onPress,
}: {
  data: DailyNutritionTotal | null;
  goalSet: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  // No real goal set yet → show a CTA instead of fake-default rings, otherwise
  // first-launch users log against placeholder targets that look real.
  if (!goalSet) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <Card style={{ marginTop: 12 }}>
          <View style={styles.glanceHeader}>
            <Text style={styles.glanceTitle}>Today's nutrition</Text>
            <Text style={styles.glanceNav}>Set goals →</Text>
          </View>
          <Text style={styles.macroEmptyText}>
            Set your nutrition goals to start tracking macros against real
            targets.
          </Text>
        </Card>
      </Pressable>
    );
  }
  const macros = [
    {
      key: "cal",
      label: "Kcal",
      value: data?.calories ?? 0,
      goal: data?.calorie_goal ?? 2500,
      color: colors.primary,
    },
    {
      key: "pro",
      label: "Protein",
      value: data?.protein_g ?? 0,
      goal: data?.protein_goal ?? 180,
      color: colors.purple,
    },
    {
      key: "fat",
      label: "Fat",
      value: data?.fat_g ?? 0,
      goal: data?.fat_goal ?? 80,
      color: colors.amber,
    },
    {
      key: "carb",
      label: "Carbs",
      value: data?.carbs_g ?? 0,
      goal: data?.carbs_goal ?? 250,
      color: colors.teal,
    },
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      <Card style={{ marginTop: 12 }}>
        <View style={styles.glanceHeader}>
          <Text style={styles.glanceTitle}>Today's nutrition</Text>
          <Text style={styles.glanceNav}>Food →</Text>
        </View>
        <View style={styles.macroRingRow}>
          {macros.map((m) => {
            const pct = m.goal > 0 ? Math.min(1, m.value / m.goal) : 0;
            const filled = pct * RING_CIRC;
            const displayVal =
              m.value >= 1000
                ? `${(m.value / 1000).toFixed(1)}k`
                : String(Math.round(m.value));
            const displayGoal =
              m.goal >= 1000
                ? `${(m.goal / 1000).toFixed(1)}k`
                : String(m.goal);
            return (
              <View key={m.key} style={styles.macroCell}>
                <View style={{ width: RING_SIZE, height: RING_SIZE }}>
                  <Svg width={RING_SIZE} height={RING_SIZE}>
                    <SvgCircle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke="rgba(255,255,255,0.10)"
                      strokeWidth={RING_STROKE}
                      fill="none"
                    />
                    <SvgCircle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_RADIUS}
                      stroke={m.color}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeDasharray={`${filled} ${RING_CIRC}`}
                      strokeLinecap="round"
                      rotation={-90}
                      origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                    />
                  </Svg>
                  <View
                    style={[StyleSheet.absoluteFill, styles.ringCenter]}
                  >
                    <Text style={[styles.ringValue, { color: m.color }]}>
                      {displayVal}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ringLabel}>{m.label}</Text>
                <Text style={styles.ringGoal}>/ {displayGoal}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </Pressable>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSharedStyles(s),
    macroEmptyText: {
    fontSize: s(13),
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
    macroRingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
    macroCell: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
    ringCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
    ringValue: {
    fontSize: s(11),
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
    ringLabel: {
    fontSize: s(11),
    fontWeight: "600",
    color: colors.textSecondary,
  },
    ringGoal: {
    fontSize: s(10),
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  });
