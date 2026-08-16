import { X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { makeSheetStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import {
  DEFAULT_BAR_LB,
  formatPlate,
  groupPlates,
  solvePlates,
} from "./liftMath";

const BAR_OPTIONS = [45, 35, 25, 15] as const;

/**
 * What to load on each side of the bar for a given weight.
 *
 * Bar weight is selectable because not every bar is 45 lb -- women's bars are
 * 35, and fixed/technique bars run lighter.
 */
export function PlateSheet({
  visible,
  targetLb,
  onClose,
}: {
  visible: boolean;
  targetLb: number | null;
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [barLb, setBarLb] = useState<number>(DEFAULT_BAR_LB);

  const solution = targetLb != null ? solvePlates(targetLb, barLb) : null;
  const grouped = solution ? groupPlates(solution.perSide) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Plates per side</Text>
              <Text style={styles.sheetSubtitle}>
                {targetLb != null ? `${targetLb} lb total` : ""}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.barLabel}>Bar weight</Text>
          <View style={styles.barRow}>
            {BAR_OPTIONS.map((b) => {
              const active = b === barLb;
              return (
                <Pressable
                  key={b}
                  onPress={() => setBarLb(b)}
                  style={({ pressed }) => [
                    styles.barPill,
                    active && styles.barPillActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.barPillText, active && styles.barPillTextActive]}>
                    {b} lb
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {solution === null ? (
            <Text style={styles.emptyText}>
              {targetLb != null && targetLb < barLb
                ? `${targetLb} lb is lighter than the ${barLb} lb bar.`
                : "Enter a weight to see the loading."}
            </Text>
          ) : grouped.length === 0 ? (
            <Text style={styles.emptyText}>Just the bar — no plates needed.</Text>
          ) : (
            <View style={styles.plateList}>
              {grouped.map(({ plate, count }) => (
                <View key={plate} style={styles.plateRow}>
                  <View style={styles.plateChip}>
                    <Text style={styles.plateChipText}>{formatPlate(plate)}</Text>
                  </View>
                  <Text style={styles.plateCount}>x {count}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.plateSub}>
                    {formatPlate(plate * count)} lb / side
                  </Text>
                </View>
              ))}
            </View>
          )}

          {solution && solution.remainderLb > 0 ? (
            <Text style={styles.remainderText}>
              {formatPlate(solution.remainderLb)} lb short — not loadable with
              standard plates.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    ...makeSheetStyles(s),
    barLabel: {
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
      marginBottom: 8,
    },
    barRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
    barPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    barPillActive: {
      backgroundColor: colors.primary + "1F",
      borderColor: colors.primary,
    },
    barPillText: { fontSize: s(13), fontWeight: "600", color: colors.textSecondary },
    barPillTextActive: { color: colors.primary },
    plateList: { gap: 8 },
    plateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    plateChip: {
      minWidth: 48,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    plateChipText: {
      color: "#FFFFFF",
      fontSize: s(14),
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    plateCount: { fontSize: s(14), fontWeight: "600", color: colors.text },
    plateSub: { fontSize: s(12), color: colors.textSecondary },
    remainderText: {
      marginTop: 12,
      fontSize: s(12),
      color: colors.warning,
      lineHeight: 17,
    },
    emptyText: {
      fontSize: s(13),
      color: colors.textSecondary,
      paddingVertical: 20,
      textAlign: "center",
    },
  });
