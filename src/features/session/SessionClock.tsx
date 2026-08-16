import { Timer } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";

/**
 * Elapsed time since the session's first completed set.
 *
 * Renders nothing when `startedAt` is null. That covers both a workout the user
 * has not begun and every session logged before started_at existed -- those
 * rows are permanently null, and showing "0:00" for them would be a lie.
 */
export function SessionClock({ startedAt }: { startedAt: string | null }) {
  const styles = useStyles(makeStyles);
  const [now, setNow] = useState(() => Date.now());

  const startMs = startedAt ? Date.parse(startedAt) : NaN;
  const valid = Number.isFinite(startMs);

  useEffect(() => {
    if (!valid) return;
    // Recompute from Date.now() on every tick rather than incrementing a
    // counter: an interval that is throttled in the background would otherwise
    // drift permanently behind wall-clock time.
    const id = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [valid]);

  if (!valid) return null;

  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
  return (
    <View style={styles.wrap}>
      <Timer size={12} color={colors.textSecondary} strokeWidth={2} />
      <Text style={styles.clock}>{formatElapsed(elapsed)}</Text>
    </View>
  );
}

/** "7:12" under an hour, "1:07:12" past it. */
function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: 4 },
    clock: {
      fontSize: s(12),
      color: colors.textSecondary,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
  });
