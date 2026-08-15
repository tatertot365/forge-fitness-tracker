import { X } from "lucide-react-native";
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
import { colors } from "../../theme/colors";
import { makeSheetStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import { type FoodFactsResult } from "../../utils/openFoodFacts";

export function BarcodeResultSheet({
  result,
  onClose,
  onAdd,
}: {
  result: FoodFactsResult | null;
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
  const [servingsInput, setServingsInput] = useState("1");
  const [calsInput, setCalsInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  React.useEffect(() => {
    if (result?.found) {
      setServingsInput("1");
      setCalsInput(String(result.caloriesPerServing));
      setProteinInput(String(result.proteinPerServing));
      setFatInput(String(result.fatPerServing));
      setCarbsInput(String(result.carbsPerServing));
    }
  }, [result]);

  if (!result?.found) return null;

  const servings = parseFloat(servingsInput) || 0;
  const totalCals = Math.round((parseFloat(calsInput) || 0) * servings);
  const totalProtein =
    Math.round((parseFloat(proteinInput) || 0) * servings * 10) / 10;
  const totalFat = Math.round((parseFloat(fatInput) || 0) * servings * 10) / 10;
  const totalCarbs =
    Math.round((parseFloat(carbsInput) || 0) * servings * 10) / 10;
  const hasResult = servings > 0;

  const save = () => {
    if (!hasResult) {
      Alert.alert("Enter a valid serving amount");
      return;
    }
    onAdd({
      name: result.productName,
      calories: totalCals,
      protein_g: totalProtein,
      fat_g: totalFat,
      carbs_g: totalCarbs,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {result.productName}
              </Text>
              <Text style={styles.sheetSubtitle}>
                1 serving = {result.servingDescription}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.formLabel, { marginBottom: 4 }]}>
              Per serving — tap to correct
            </Text>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Calories</Text>
                <TextInput
                  value={calsInput}
                  onChangeText={setCalsInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Protein (g)</Text>
                <TextInput
                  value={proteinInput}
                  onChangeText={setProteinInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
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
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Carbs (g)</Text>
                <TextInput
                  value={carbsInput}
                  onChangeText={setCarbsInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
            </View>

            <Text style={[styles.formLabel, { marginTop: 14 }]}>
              How many servings?
            </Text>
            <TextInput
              value={servingsInput}
              onChangeText={setServingsInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput]}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />

            {hasResult && servings !== 1 ? (
              <View style={styles.calcResult}>
                <Text style={styles.calcResultTitle}>
                  Total for {servingsInput} servings
                </Text>
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
  });
