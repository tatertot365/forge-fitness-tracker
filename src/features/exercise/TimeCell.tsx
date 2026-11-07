import { Play, Square } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import { formatDuration } from "../../utils/duration";
import { hapticSuccess, hapticTap } from "../../utils/haptics";

type Props = {
  /** The typed/recorded time as shown in the field, e.g. "45s" or "1:15". */
  value: string;
  /** Per-set target, shown as the placeholder and buzzed when reached. */
  targetSeconds: number;
  /** Epoch ms the timer started, or null when this set isn't running. */
  runningSince: number | null;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  onStart: () => void;
  onStop: (elapsedSeconds: number) => void;
};

/**
 * The time column of a timed set: an editable field plus a play/stop button
 * that counts up. Elapsed time is derived from the start timestamp rather than
 * accumulated ticks, so it stays right across re-renders and backgrounding.
 */
export function TimeCell({
  value,
  targetSeconds,
  runningSince,
  onChangeText,
  onBlur,
  onStart,
  onStop,
}: Props) {
  const styles = useStyles(makeStyles);
  const running = runningSince != null;
  const [now, setNow] = useState(() => Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    if (!running) return;
    buzzed.current = false;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, runningSince]);

  const elapsed = running ? Math.max(0, Math.floor((now - runningSince) / 1000)) : 0;
  const reached = running && elapsed >= targetSeconds;

  useEffect(() => {
    if (reached && !buzzed.current) {
      buzzed.current = true;
      hapticSuccess();
    }
  }, [reached]);

  return (
    <View style={styles.cell}>
      {running ? (
        <Text
          style={[styles.live, reached && { color: colors.green }]}
          accessibilityLiveRegion="polite"
        >
          {formatDuration(elapsed)}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="numbers-and-punctuation"
          selectTextOnFocus
          style={styles.input}
          placeholder={formatDuration(targetSeconds)}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />
      )}
      <Pressable
        onPress={() => {
          hapticTap();
          if (running) onStop(elapsed);
          else onStart();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={running ? "Stop timer" : "Start timer"}
        style={({ pressed }) => [
          styles.btn,
          running && styles.btnRunning,
          pressed && { opacity: 0.6 },
        ]}
      >
        {running ? (
          <Square size={11} color="#FFFFFF" fill="#FFFFFF" />
        ) : (
          <Play size={12} color={colors.primary} fill={colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    cell: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    // Same box as the screen's weight/reps inputs, so the columns line up.
    input: {
      flex: 1,
      fontSize: s(15),
      color: colors.text,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    live: {
      flex: 1,
      fontSize: s(15),
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
      color: colors.primary,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    btn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + "1F",
    },
    btnRunning: {
      backgroundColor: colors.primary,
    },
  });
