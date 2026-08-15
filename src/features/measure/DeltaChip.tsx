import { ArrowDown, ArrowUp, Minus } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";

export function DeltaChip({
  current,
  prior,
  goodOnIncrease,
  neutral,
  unit,
}: {
  current: number | null;
  prior: number | null;
  goodOnIncrease: boolean;
  neutral?: boolean;
  unit: string;
}) {
  const styles = useStyles(makeStyles);
  if (current == null || prior == null) return <View style={{ height: 18 }} />;
  const d = current - prior;
  if (Math.abs(d) < 0.05) {
    return (
      <View style={styles.deltaChip}>
        <Minus size={11} color={colors.textMuted} strokeWidth={2.5} />
        <Text style={[styles.deltaText, { color: colors.textMuted }]}>0</Text>
      </View>
    );
  }
  const up = d > 0;
  const tint = neutral
    ? colors.textSecondary
    : (goodOnIncrease ? up : !up)
      ? colors.green
      : colors.red;
  return (
    <View style={styles.deltaChip}>
      {up ? (
        <ArrowUp size={11} color={tint} strokeWidth={2.5} />
      ) : (
        <ArrowDown size={11} color={tint} strokeWidth={2.5} />
      )}
      <Text style={[styles.deltaText, { color: tint }]}>
        {Math.abs(d).toFixed(1)}
        {unit}
      </Text>
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    deltaChip: { flexDirection: "row", alignItems: "center", gap: 2 },
    deltaText: { fontSize: s(11), fontWeight: "600" },
  });
