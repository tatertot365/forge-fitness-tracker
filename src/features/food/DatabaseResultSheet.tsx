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
import { type FoodSearchItem } from "../../utils/openFoodFacts";
import { parseRequired } from "./helpers";

const PRESET_GRAMS = [30, 50, 100, 150, 200];

// ─── Database result ───────────────────────────────────────────────────
//
// Search hits carry per-100g nutrition and no serving size, so the amount is
// entered in grams rather than servings. This is the portion step for remote
// results; PortionSheet handles multiples of an already-logged food.

export function DatabaseResultSheet({
  item,
  onClose,
  onAdd,
}: {
  item: FoodSearchItem | null;
  onClose: () => void;
  onAdd: (
    entry: {
      name: string;
      calories: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
    },
  ) => void;
}) {
  const styles = useStyles(makeStyles);
  const [grams, setGrams] = useState("100");

  useEffect(() => {
    if (item) setGrams("100");
  }, [item]);

  if (!item) return null;

  const parsed = parseRequired(grams);
  const valid = parsed != null && parsed > 0;
  const factor = (parsed ?? 0) / 100;

  const scaled = {
    calories: Math.round(item.caloriesPer100g * factor),
    protein_g: Math.round(item.proteinPer100g * factor * 10) / 10,
    fat_g: Math.round(item.fatPer100g * factor * 10) / 10,
    carbs_g: Math.round(item.carbsPer100g * factor * 10) / 10,
  };

  // Brand first so the log reads "Chobani Nonfat Greek Yogurt"; skipped when
  // the brand is already how the product names itself.
  const label =
    item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())
      ? `${item.brand} ${item.name}`
      : item.name;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.title} numberOfLines={2}>
                {label}
              </Text>
              <Text style={styles.per100}>
                {item.caloriesPer100g} cal per 100 g
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Amount (grams)</Text>
          <View style={styles.presetRow}>
            {PRESET_GRAMS.map((g) => {
              const active = parsed === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGrams(String(g))}
                  style={({ pressed }) => [
                    styles.preset,
                    active && styles.presetActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[styles.presetText, active && styles.presetTextActive]}
                  >
                    {g}g
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
            placeholder="100"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, !valid && styles.inputError]}
          />

          <View style={styles.preview}>
            <Text style={styles.previewCals}>{scaled.calories} cal</Text>
            <Text style={styles.previewMacros}>
              P {scaled.protein_g}g · F {scaled.fat_g}g · C {scaled.carbs_g}g
            </Text>
          </View>

          <Pressable
            onPress={() =>
              onAdd({
                name: `${label} (${parsed}g)`,
                calories: scaled.calories,
                protein_g: scaled.protein_g,
                fat_g: scaled.fat_g,
                carbs_g: scaled.carbs_g,
              })
            }
            disabled={!valid}
            style={({ pressed }) => [
              styles.addBtn,
              !valid && { opacity: 0.4 },
              pressed && valid && { opacity: 0.85 },
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
    header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
    title: { ...typography.screenTitle, fontSize: s(17), color: colors.text },
    per100: { fontSize: s(12), color: colors.textSecondary, marginTop: 3 },
    close: { fontSize: s(18), color: colors.textSecondary, padding: 4 },
    label: {
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
      marginBottom: 8,
    },
    presetRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
    preset: {
      flex: 1,
      paddingVertical: 9,
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
    presetText: { fontSize: s(12), fontWeight: "600", color: colors.text },
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
      marginTop: 16,
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
