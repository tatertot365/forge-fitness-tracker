import { Plus, Search, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Card } from "../../components/Card";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { parseOptional, parseRequired } from "./helpers";

export type LogFoodDraft = {
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

/**
 * Manual food entry, shared by the Food tab's "+ Log" button and the
 * edit-a-past-day sheet.
 *
 * This was inline in `app/(tabs)/food.tsx` and bound to today's log. Pulling it
 * out lets a past day reuse the exact same form rather than maintaining a
 * second, different-looking one -- the caller decides which date the entry
 * lands on.
 */
export function LogFoodSheet({
  visible,
  title = "Log food",
  subtitle,
  initialName,
  initialCalories,
  initialProtein,
  initialFat,
  initialCarbs,
  onClose,
  onAdd,
  onSearch,
}: {
  visible: boolean;
  /** Header text. Defaults to "Log food". */
  title?: string;
  /** Optional line under the title — used to name the day being edited. */
  subtitle?: string;
  initialName?: string;
  initialCalories?: string;
  initialProtein?: string;
  initialFat?: string;
  initialCarbs?: string;
  onClose: () => void;
  onAdd: (draft: LogFoodDraft) => void | Promise<void>;
  /** When provided, shows a "Search foods" button above the manual form. */
  onSearch?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [name, setName] = useState("");
  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  // Seed on open so a food picked from search can prefill the form, and so a
  // reopened sheet never shows the previous entry's leftovers.
  useEffect(() => {
    if (!visible) return;
    setName(initialName ?? "");
    setCalInput(initialCalories ?? "");
    setProteinInput(initialProtein ?? "");
    setFatInput(initialFat ?? "");
    setCarbsInput(initialCarbs ?? "");
  }, [
    visible,
    initialName,
    initialCalories,
    initialProtein,
    initialFat,
    initialCarbs,
  ]);

  const submit = async () => {
    // parseRequired rejects a blank field; parseOptional treats blank as 0.
    // Calories and protein are required, so an empty box must not become 0.
    const cal = parseRequired(calInput);
    const prot = parseRequired(proteinInput);
    const fat = parseOptional(fatInput);
    const carbs = parseOptional(carbsInput);
    if (name.trim() === "") {
      Alert.alert("Enter a food name");
      return;
    }
    if (cal === null || prot === null || fat === null || carbs === null) {
      Alert.alert("Enter calories and protein");
      return;
    }
    await onAdd({
      name: name.trim(),
      calories: cal,
      protein_g: prot,
      fat_g: fat,
      carbs_g: carbs,
    });
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
        style={styles.manualBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.manualSheet}>
          <View style={styles.manualHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.manualTitle}>{title}</Text>
              {subtitle ? (
                <Text style={styles.manualSubtitle}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {onSearch ? (
              <Pressable
                onPress={onSearch}
                style={({ pressed }) => [
                  styles.searchBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Search size={16} color={colors.primary} strokeWidth={2} />
                <Text style={styles.searchBtnText}>Search foods</Text>
              </Pressable>
            ) : null}

            <Card>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="e.g. Chicken breast"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Calories</Text>
                  <TextInput
                    value={calInput}
                    onChangeText={setCalInput}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="165"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Protein (g)</Text>
                  <TextInput
                    value={proteinInput}
                    onChangeText={setProteinInput}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="31"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Fat (g)</Text>
                  <TextInput
                    value={fatInput}
                    onChangeText={setFatInput}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="7"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Carbs (g)</Text>
                  <TextInput
                    value={carbsInput}
                    onChangeText={setCarbsInput}
                    keyboardType="decimal-pad"
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <Pressable
                onPress={submit}
                style={({ pressed }) => [
                  styles.addBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </Card>
            <View style={{ height: 12 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    manualBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    manualSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 24,
      maxHeight: "88%",
    },
    manualHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    manualTitle: {
      ...typography.screenTitle,
      fontSize: s(18),
      color: colors.text,
    },
    manualSubtitle: {
      ...typography.caption,
      fontSize: s(12),
      color: colors.textSecondary,
      marginTop: 2,
    },
    searchBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginBottom: 12,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    searchBtnText: {
      color: colors.primary,
      fontSize: s(14),
      fontWeight: "600",
    },
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
    formRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: radius.card,
      backgroundColor: colors.primary,
    },
    addBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  });
