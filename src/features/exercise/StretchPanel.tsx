import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { HoldTimer } from "../../components/HoldTimer";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { type Row } from "./types";

export function StretchPanel({
  rows,
  holdSeconds,
  onRoundComplete,
}: {
  rows: Row[];
  holdSeconds: number;
  onRoundComplete: (idx: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const nextIdx = rows.findIndex((r) => !r.completed);
  const allDone = nextIdx === -1;
  const currentIdx = allDone ? rows.length - 1 : nextIdx;
  const current = rows[currentIdx];
  return (
    <View style={styles.stretchPanel}>
      <View style={styles.stretchHeader}>
        <Text style={styles.stretchHeaderLabel}>
          {allDone
            ? `All ${rows.length} ${rows.length === 1 ? "round" : "rounds"} complete`
            : `Round ${current?.setNumber ?? 1} of ${rows.length}`}
        </Text>
        <View style={styles.stretchDots}>
          {rows.map((r) => (
            <View
              key={r.setNumber}
              style={[
                styles.stretchDot,
                r.completed && styles.stretchDotDone,
              ]}
            />
          ))}
        </View>
      </View>
      {!allDone ? (
        <View style={{ marginTop: 14 }}>
          <HoldTimer
            key={`${currentIdx}-${holdSeconds}`}
            durationSeconds={holdSeconds}
            autoStart
            onComplete={() => onRoundComplete(currentIdx)}
            onSkip={() => onRoundComplete(currentIdx)}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    stretchPanel: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 12,
  },
    stretchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
    stretchHeaderLabel: {
    fontSize: s(14),
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
    stretchDots: {
    flexDirection: "row",
    gap: 6,
  },
    stretchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
    stretchDotDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  });
