import { X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
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
import { makeSheetStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import {
  type FoodEntry,
} from "../../types";

export function EditFoodSheet({
  entry,
  onClose,
  onSave,
}: {
  entry: FoodEntry | null;
  onClose: () => void;
  onSave: (
    id: number,
    patch: {
      name: string;
      calories: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
    },
  ) => void;
}) {
  const styles = useStyles(makeStyles);
  const [name, setName] = useState("");
  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  React.useEffect(() => {
    if (entry) {
      setName(entry.name);
      setCalInput(String(entry.calories));
      setProteinInput(String(entry.protein_g));
      setFatInput(String(entry.fat_g));
      setCarbsInput(String(entry.carbs_g));
    }
  }, [entry]);

  const save = () => {
    if (!entry) return;
    const c = Number(calInput);
    const p = Number(proteinInput);
    const f = fatInput.trim() === "" ? 0 : Number(fatInput);
    const cb = carbsInput.trim() === "" ? 0 : Number(carbsInput);
    if (name.trim() === "") {
      Alert.alert("Enter a name");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      Alert.alert("Enter valid calories");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      Alert.alert("Enter valid protein");
      return;
    }
    if (!Number.isFinite(f) || f < 0) {
      Alert.alert("Enter valid fat");
      return;
    }
    if (!Number.isFinite(cb) || cb < 0) {
      Alert.alert("Enter valid carbs");
      return;
    }
    onSave(entry.id, {
      name: name.trim(),
      calories: c,
      protein_g: p,
      fat_g: f,
      carbs_g: cb,
    });
  };

  return (
    <Modal
      visible={!!entry}
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
            <Text style={styles.sheetTitle}>Edit entry</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.formLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, styles.sheetInput]}
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Calories</Text>
              <TextInput
                value={calInput}
                onChangeText={setCalInput}
                keyboardType="decimal-pad"
                style={[styles.input, styles.sheetInput]}
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
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          <Pressable
            onPress={save}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSheetStyles(s),
  });
