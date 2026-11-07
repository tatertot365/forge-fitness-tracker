import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { radius } from "../theme/spacing";
import { useStyles } from "../theme/useStyles";
import { hapticTap } from "../utils/haptics";

const VISIBLE_MS = 5000;

type Pending = { message: string; onUndo: () => void | Promise<void> };

/**
 * A short-lived toast with an Undo button, for actions that are easy to
 * trigger by accident (skipping an exercise sits right next to its swipe
 * target). Showing a new one replaces the old -- the earlier action simply
 * stays done.
 *
 *   const undo = useUndoToast();
 *   undo.show("Squat skipped", () => unskip(...));
 *   return <>{...}{undo.toast}</>;
 *
 * Render `toast` outside any ScrollView so it floats over the screen. Raise
 * `bottom` on screens with a pinned bottom button, so the toast never covers
 * it -- a tap aimed at Undo just as the toast times out would otherwise land
 * on that button.
 */
export function useUndoToast({ bottom = 100 }: { bottom?: number } = {}) {
  const styles = useStyles(makeStyles);
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(null);
  }, []);

  const show = useCallback(
    (message: string, onUndo: Pending["onUndo"]) => {
      if (timer.current) clearTimeout(timer.current);
      setPending({ message, onUndo });
      timer.current = setTimeout(() => setPending(null), VISIBLE_MS);
    },
    [],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onUndo = async () => {
    if (!pending) return;
    const { onUndo: undo } = pending;
    hapticTap();
    clear();
    await undo();
  };

  const toast = pending ? (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={2}>
          {pending.message}
        </Text>
        <Pressable
          onPress={onUndo}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={styles.undo}>Undo</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return { show, toast };
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    // Matches the food screen's toast, lifted above the floating tab bar.
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      paddingHorizontal: 24,
    },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: colors.card,
      borderRadius: radius.card,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      maxWidth: "100%",
    },
    text: {
      flexShrink: 1,
      color: colors.text,
      fontSize: s(13),
      fontWeight: "500",
    },
    undo: {
      color: colors.primary,
      fontSize: s(13),
      fontWeight: "700",
    },
  });
