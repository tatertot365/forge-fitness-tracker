import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { type BodyGoals } from "../../db/queries";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { parseField } from "./helpers";

// ─── Body goals sheet ──────────────────────────────────────────────────

export function BodyGoalsSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: BodyGoals;
  onClose: () => void;
  onSave: (goals: Partial<BodyGoals>) => void;
}) {
  const styles = useStyles(makeStyles);
  const [weightInput, setWeightInput] = useState("");
  const [bfInput, setBfInput] = useState("");
  const [showRatio, setShowRatio] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setWeightInput(
      current.goal_weight_lb != null ? String(current.goal_weight_lb) : "",
    );
    setBfInput(
      current.goal_body_fat_pct != null
        ? String(current.goal_body_fat_pct)
        : "",
    );
    setShowRatio(current.show_ratio_card);
  }, [visible]);

  const save = () => {
    const w = parseField(weightInput);
    const b = parseField(bfInput);
    if (weightInput.trim() !== "" && w == null) {
      Alert.alert("Enter a valid weight goal");
      return;
    }
    if (w != null && (w < 50 || w > 700)) {
      Alert.alert("Weight goal should be between 50 and 700 lb");
      return;
    }
    if (bfInput.trim() !== "" && b == null) {
      Alert.alert("Enter a valid body fat goal");
      return;
    }
    if (b != null && (b < 1 || b > 50)) {
      Alert.alert("Body fat goal should be between 1 and 50%");
      return;
    }
    const goals: Partial<BodyGoals> = { show_ratio_card: showRatio };
    if (w != null) goals.goal_weight_lb = w;
    if (b != null) goals.goal_body_fat_pct = b;
    onSave(goals);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Body goals</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formLabel}>Target weight (lbs)</Text>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput, { marginBottom: 14 }]}
              placeholder="e.g. 185"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.formLabel}>Target body fat (%)</Text>
            <TextInput
              value={bfInput}
              onChangeText={setBfInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput]}
              placeholder="e.g. 5"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Shoulder-to-waist ratio</Text>
                <Text style={styles.toggleSub}>Show ratio card on Body tab</Text>
              </View>
              <Switch
                value={showRatio}
                onValueChange={setShowRatio}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.card}
              />
            </View>
            <Pressable
              onPress={save}
              style={({ pressed }) => [
                styles.saveBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Save goals</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    formLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: 6,
  },
    input: {
    fontSize: s(15),
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
    sheetInput: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
    saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: "center",
  },
    saveBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
    toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 14,
    gap: 12,
  },
    toggleLabel: { fontSize: s(14), fontWeight: "500", color: colors.text },
    toggleSub: { fontSize: s(12), color: colors.textSecondary, marginTop: 2 },
    sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "85%",
  },
    sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
    sheetTitle: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
    sheetClose: { fontSize: s(18), color: colors.textSecondary, padding: 4 },
  });
