import { Heart, Play, Plus, Square } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "../../components/Card";
import { ProgressBar } from "../../components/ProgressBar";
import { type CardioPlan, type RunningCardio } from "../../db/queries";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { formatDuration } from "../../utils/duration";
import { cardioLabel } from "./activities";
import { planTitle } from "./plan";

type Props = {
  plan: CardioPlan;
  count: number;
  target: number;
  minutes: number;
  running: RunningCardio | null;
  /** Apple Watch cardio this week that isn't logged in Forge yet. */
  healthSuggestions: number;
  onStart: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onLog: () => void;
  onHistory: () => void;
};

/**
 * Home's cardio card: the plan, this week's progress toward the
 * phase's session goal, and either Start/Log or -- while a session is being
 * timed -- the live clock with Finish/Discard.
 */
export function CardioCard({
  plan,
  count,
  target,
  minutes,
  running,
  healthSuggestions,
  onStart,
  onFinish,
  onDiscard,
  onLog,
  onHistory,
}: Props) {
  const styles = useStyles(makeStyles);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = running
    ? Math.max(0, Math.floor((now - new Date(running.since).getTime()) / 1000))
    : 0;

  return (
    <Card>
      <Text style={styles.title}>{planTitle(plan)}</Text>
      {plan.details ? <Text style={styles.meta}>{plan.details}</Text> : null}

      {running ? (
        <View style={styles.liveBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveLabel}>{cardioLabel(running.activity)}</Text>
            <Text style={styles.liveClock} accessibilityLiveRegion="polite">
              {formatDuration(elapsed)}
            </Text>
          </View>
          <Pressable
            onPress={onDiscard}
            hitSlop={8}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.ghostText}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={onFinish}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
          >
            <Square size={11} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.primaryText}>Finish</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <ProgressBar value={count} max={target} />
      </View>
      <View style={styles.row}>
        <Pressable onPress={onHistory} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.count}>
            {count}/{target} this week{minutes > 0 ? ` · ${minutes} min` : ""}
          </Text>
          <View style={styles.linkRow}>
            <Text style={styles.historyLink}>History →</Text>
            {healthSuggestions > 0 ? (
              <View style={styles.linkRow}>
                <Heart size={10} color={colors.red} strokeWidth={2.5} />
                <Text style={styles.healthHint}>{healthSuggestions} to add</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        {!running ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onLog}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
            >
              <Plus size={14} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.secondaryText}>Log</Text>
            </Pressable>
            <Pressable
              onPress={onStart}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
            >
              <Play size={12} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.primaryText}>Start</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    title: { ...typography.exerciseName, fontSize: s(14), color: colors.text },
    meta: {
      ...typography.caption,
      fontSize: s(12),
      color: colors.textSecondary,
      marginTop: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    count: {
      ...typography.caption,
      fontSize: s(12),
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    historyLink: { fontSize: s(12), fontWeight: "600", color: colors.primary },
    healthHint: { fontSize: s(12), color: colors.textSecondary, fontWeight: "500" },
    actions: { flexDirection: "row", gap: 8 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    primaryText: { color: "#FFFFFF", fontSize: s(12), fontWeight: "600" },
    secondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.primary + "1F",
    },
    secondaryText: { color: colors.primary, fontSize: s(12), fontWeight: "600" },
    liveBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
      padding: 12,
      borderRadius: radius.card,
      backgroundColor: colors.primary + "14",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary + "55",
    },
    liveLabel: {
      fontSize: s(11),
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.primary,
    },
    liveClock: {
      fontSize: s(26),
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
      marginTop: 2,
    },
    ghostBtn: { paddingHorizontal: 6, paddingVertical: 7 },
    ghostText: { color: colors.textSecondary, fontSize: s(12), fontWeight: "600" },
  });
