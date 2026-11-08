import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { CARDIO_ACTIVITIES } from "./activities";

/** Single-select chips for the cardio activity, shared by Log and the plan. */
export function ActivityChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.chips}>
      {CARDIO_ACTIVITIES.map((a) => {
        const selected = a.key === value;
        return (
          <Pressable
            key={a.key}
            onPress={() => onChange(a.key)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {a.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary + "26",
      borderColor: colors.primary,
    },
    chipText: { fontSize: s(13), color: colors.textSecondary, fontWeight: "500" },
    chipTextSelected: { color: colors.primary, fontWeight: "600" },
  });
