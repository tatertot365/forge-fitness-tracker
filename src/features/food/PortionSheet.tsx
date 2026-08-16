import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { type FoodRecent } from "../../types";
import { parseRequired } from "./helpers";

const PRESETS = [0.5, 1, 1.5, 2, 3];

// ─── Portion sheet ─────────────────────────────────────────────────────
//
// Re-adding a recent used to copy its macros verbatim, so eating half a
// serving meant retyping all four numbers in the manual form. Multiplying the
// stored values covers that without needing per-food serving sizes.

export function PortionSheet({
  recent,
  onClose,
  onAdd,
}: {
  recent: FoodRecent | null;
  onClose: () => void;
  onAdd: (r: FoodRecent, multiplier: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState(1);

  useEffect(() => {
    if (recent) {
      setSelected(1);
      setCustom("");
    }
  }, [recent]);

  if (!recent) return null;

  // A typed amount wins over the preset row; fall back to the preset while the
  // box is empty or mid-edit.
  const typed = custom.trim() === "" ? null : parseRequired(custom);
  const multiplier = typed != null && typed > 0 ? typed : selected;

  const scaled = {
    calories: Math.round(recent.calories * multiplier),
    protein_g: Math.round(recent.protein_g * multiplier * 10) / 10,
    fat_g: Math.round(recent.fat_g * multiplier * 10) / 10,
    carbs_g: Math.round(recent.carbs_g * multiplier * 10) / 10,
  };

  const invalid = custom.trim() !== "" && (typed == null || typed <= 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {recent.name}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Servings</Text>
          <View style={styles.presetRow}>
            {PRESETS.map((p) => {
              const active = typed == null && selected === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    setCustom("");
                    setSelected(p);
                  }}
                  style={({ pressed }) => [
                    styles.preset,
                    active && styles.presetActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[styles.presetText, active && styles.presetTextActive]}
                  >
                    ×{p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Or enter an amount</Text>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            keyboardType="decimal-pad"
            placeholder="e.g. 1.25"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, invalid && styles.inputError]}
          />

          <View style={styles.preview}>
            <Text style={styles.previewCals}>{scaled.calories} cal</Text>
            <Text style={styles.previewMacros}>
              P {scaled.protein_g}g · F {scaled.fat_g}g · C {scaled.carbs_g}g
            </Text>
          </View>

          <Pressable
            onPress={() => onAdd(recent, multiplier)}
            disabled={invalid}
            style={({ pressed }) => [
              styles.addBtn,
              invalid && { opacity: 0.4 },
              pressed && !invalid && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.addBtnText}>Add to log</Text>
          </Pressable>
          <View style={{ height: 8 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    title: {
      ...typography.screenTitle,
      fontSize: s(18),
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    close: { fontSize: s(18), color: colors.textSecondary, padding: 4 },
    label: {
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
      marginBottom: 8,
    },
    presetRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    preset: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
    },
    presetActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetText: { fontSize: s(13), fontWeight: "600", color: colors.text },
    presetTextActive: { color: "#FFFFFF" },
    input: {
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: s(15),
      color: colors.text,
    },
    inputError: { borderColor: colors.red, borderWidth: 1 },
    preview: {
      marginTop: 18,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radius.card,
      backgroundColor: colors.card,
    },
    previewCals: { fontSize: s(20), fontWeight: "600", color: colors.text },
    previewMacros: {
      fontSize: s(12),
      color: colors.textSecondary,
      marginTop: 3,
    },
    addBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: radius.card,
      alignItems: "center",
      marginTop: 16,
    },
    addBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
  });
