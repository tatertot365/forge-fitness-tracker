import { X } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActionSheetIOS,
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
import { colors } from "../../theme/colors";
import { makeSheetStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";

const UNITS = [
  "g",
  "oz",
  "ml",
  "fl oz",
  "tbsp",
  "cup",
  "slice",
  "piece",
] as const;
type ServingUnit = (typeof UNITS)[number];

export function MacroCalculatorSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (entry: {
    name: string;
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  }) => void;
}) {
  const styles = useStyles(makeStyles);
  const [foodName, setFoodName] = useState("");
  const [unit, setUnit] = useState<ServingUnit>("g");
  const [servingSizeInput, setServingSizeInput] = useState("");
  const [calsInput, setCalsInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");
  const [amountInput, setAmountInput] = useState("");

  const servingSize = parseFloat(servingSizeInput) || 0;
  const amount = parseFloat(amountInput) || 0;
  const ratio = servingSize > 0 && amount > 0 ? amount / servingSize : 0;

  const totalCals = Math.round((parseFloat(calsInput) || 0) * ratio);
  const totalProtein =
    Math.round((parseFloat(proteinInput) || 0) * ratio * 10) / 10;
  const totalFat = Math.round((parseFloat(fatInput) || 0) * ratio * 10) / 10;
  const totalCarbs =
    Math.round((parseFloat(carbsInput) || 0) * ratio * 10) / 10;

  const hasResult = ratio > 0;

  const reset = () => {
    setFoodName("");
    setUnit("g");
    setServingSizeInput("");
    setCalsInput("");
    setProteinInput("");
    setFatInput("");
    setCarbsInput("");
    setAmountInput("");
  };

  const pickUnit = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...UNITS, "Cancel"],
        cancelButtonIndex: UNITS.length,
        title: "Serving unit",
      },
      (idx) => {
        if (idx < UNITS.length) setUnit(UNITS[idx]);
      },
    );
  };

  const save = () => {
    if (foodName.trim() === "") {
      Alert.alert("Enter a food name");
      return;
    }
    if (servingSize <= 0) {
      Alert.alert("Enter a valid serving size");
      return;
    }
    if (amount <= 0) {
      Alert.alert("Enter how much you had");
      return;
    }
    if ((parseFloat(calsInput) || 0) < 0) {
      Alert.alert("Enter valid calories");
      return;
    }
    onAdd({
      name: foodName.trim(),
      calories: totalCals,
      protein_g: totalProtein,
      fat_g: totalFat,
      carbs_g: totalCarbs,
    });
    reset();
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
            <Text style={styles.sheetTitle}>Calculate macros</Text>
            <Pressable
              onPress={() => {
                onClose();
                reset();
              }}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formLabel}>Food name</Text>
            <TextInput
              value={foodName}
              onChangeText={setFoodName}
              style={[styles.input, styles.sheetInput]}
              placeholder="e.g. Chicken breast"
              placeholderTextColor={colors.textMuted}
            />

            <View style={[styles.formRow, { marginTop: 10 }]}>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.formLabel}>Serving size</Text>
                <TextInput
                  value={servingSizeInput}
                  onChangeText={setServingSizeInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholder="100"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Unit</Text>
                <Pressable
                  onPress={pickUnit}
                  style={({ pressed }) => [
                    styles.unitPicker,
                    styles.sheetInput,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.unitPickerText}>{unit}</Text>
                  <Text style={styles.unitPickerChevron}>›</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.calcSectionLabel, { marginTop: 14 }]}>
              Nutrition per serving
            </Text>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Calories</Text>
                <TextInput
                  value={calsInput}
                  onChangeText={setCalsInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
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
                  style={[styles.input, styles.sheetInput]}
                  placeholder="31"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            <View style={[styles.formRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Fat (g)</Text>
                <TextInput
                  value={fatInput}
                  onChangeText={setFatInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
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
                  style={[styles.input, styles.sheetInput]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={[styles.calcSectionLabel, { marginTop: 14 }]}>
              Amount you had
            </Text>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput]}
              placeholder={`e.g. 150 ${unit}`}
              placeholderTextColor={colors.textMuted}
            />

            {hasResult ? (
              <View style={styles.calcResult}>
                <Text style={styles.calcResultTitle}>Calculated totals</Text>
                <View style={styles.calcResultRow}>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>
                      {totalCals.toLocaleString()}
                    </Text>
                    <Text style={styles.calcResultLabel}>cal</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalProtein}g</Text>
                    <Text style={styles.calcResultLabel}>protein</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalFat}g</Text>
                    <Text style={styles.calcResultLabel}>fat</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalCarbs}g</Text>
                    <Text style={styles.calcResultLabel}>carbs</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={save}
              style={({ pressed }) => [
                styles.saveBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Add to log</Text>
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
  ...makeSheetStyles(s),
    calcSectionLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
    unitPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
    unitPickerChevron: {
    fontSize: s(18),
    color: colors.textSecondary,
    lineHeight: 20,
  },
    unitPickerText: { fontSize: s(15), color: colors.text, fontWeight: "500" },
  });
