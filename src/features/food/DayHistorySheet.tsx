import { CopyPlus, Pencil, Plus, X } from "lucide-react-native";
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
import {
  addFoodEntry,
  copyFoodEntriesToDate,
  deleteFoodEntry,
  getFoodEntriesForDate,
  getNutritionGoalForDate,
} from "../../db/queries";
import { hapticSuccess, hapticTap } from "../../utils/haptics";
import { parseOptional, parseRequired } from "./helpers";
import { SwipeableFoodRow } from "./SwipeableFoodRow";
import { formatHeaderDate } from "./helpers";
import { todayISO } from "../../utils/date";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { makeSheetStyles, makeEntryRowStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import {
  type FoodEntry,
  type NutritionGoal,
} from "../../types";

export function DayHistorySheet({
  date,
  onClose,
  onCopied,
  onEditEntry,
  onChanged,
  refreshKey,
}: {
  date: string | null;
  onClose: () => void;
  /** Called after entries are copied onto today, so the log can reload. */
  onCopied?: () => void;
  /**
   * Request that the parent open its edit sheet for this entry.
   *
   * The edit sheet is a Modal and this sheet is a Modal; stacking them on iOS
   * is unreliable, so the parent owns that state and renders it as a sibling.
   */
  onEditEntry?: (entry: FoodEntry) => void;
  /** Any mutation to this day, so the parent's chart and totals refresh. */
  onChanged?: () => void;
  /**
   * Bumped by the parent after it saves an edit through its own sheet, so this
   * sheet re-reads the day it is showing.
   */
  refreshKey?: number;
}) {
  const styles = useStyles(makeStyles);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  const reload = React.useCallback(async () => {
    if (!date) return;
    const [e, g] = await Promise.all([
      getFoodEntriesForDate(date),
      getNutritionGoalForDate(date),
    ]);
    setEntries(e);
    setGoal(g);
  }, [date]);

  React.useEffect(() => {
    if (!date) {
      setEntries([]);
      setGoal(null);
      // Leave edit mode behind with the sheet, so reopening another day
      // starts read-only rather than inheriting the last day's mode.
      setEditing(false);
      setAdding(false);
      return;
    }
    reload();
  }, [date, reload]);

  // Re-read when the parent signals it saved an edit through its own sheet.
  React.useEffect(() => {
    if (!date || !refreshKey) return;
    reload();
  }, [refreshKey, date, reload]);

  const clearForm = () => {
    setName("");
    setCalInput("");
    setProteinInput("");
    setFatInput("");
    setCarbsInput("");
  };

  const onDeleteEntry = (entry: FoodEntry) => {
    Alert.alert("Delete entry?", `"${entry.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFoodEntry(entry.id);
          hapticTap();
          await reload();
          onChanged?.();
        },
      },
    ]);
  };

  const onAdd = async () => {
    if (!date) return;
    // Matches the main log: calories and protein are required, so a blank box
    // must not silently become 0.
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
    // The sheet's date, never today -- this is the whole point of the screen.
    await addFoodEntry({
      date,
      name: name.trim(),
      calories: cal,
      protein_g: prot,
      fat_g: fat,
      carbs_g: carbs,
    });
    hapticSuccess();
    clearForm();
    setAdding(false);
    await reload();
    onChanged?.();
  };

  const [copying, setCopying] = useState(false);
  const today = todayISO();
  const isToday = date === today;

  const onCopy = () => {
    if (!date || entries.length === 0 || copying) return;
    const n = entries.length;
    Alert.alert(
      "Copy to today?",
      `Adds ${n} ${n === 1 ? "entry" : "entries"} from ${formatHeaderDate(
        date,
      )} to today's log. Anything already logged today stays.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Copy",
          onPress: async () => {
            setCopying(true);
            try {
              await copyFoodEntriesToDate(date, today);
              onCopied?.();
              onClose();
            } catch {
              Alert.alert("Copy failed", "Could not copy those entries.");
            } finally {
              setCopying(false);
            }
          },
        },
      ],
    );
  };

  const totalCals = entries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = entries.reduce((s, e) => s + e.protein_g, 0);
  const totalFat = entries.reduce((s, e) => s + e.fat_g, 0);
  const totalCarbs = entries.reduce((s, e) => s + e.carbs_g, 0);

  return (
    <Modal
      visible={!!date}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: "75%" }]}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {date ? formatHeaderDate(date) : ""}
              </Text>
              {goal ? (
                <Text style={styles.sheetSubtitle}>
                  {Math.round(totalCals).toLocaleString()} /{" "}
                  {Math.round(goal.calorie_goal).toLocaleString()} cal
                  {" · "}P {Math.round(totalProtein)} /{" "}
                  {Math.round(goal.protein_goal)}g{" · "}F{" "}
                  {Math.round(totalFat)} / {Math.round(goal.fat_goal)}g{" · "}C{" "}
                  {Math.round(totalCarbs)} / {Math.round(goal.carbs_goal)}g
                </Text>
              ) : null}
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => {
                  hapticTap();
                  setEditing((v) => !v);
                  setAdding(false);
                }}
                hitSlop={8}
                accessibilityLabel={editing ? "Done editing" : "Edit this day"}
                style={({ pressed }) => [
                  styles.editToggle,
                  editing && styles.editToggleActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                {editing ? null : (
                  <Pencil size={12} color={colors.primary} strokeWidth={2} />
                )}
                <Text
                  style={[
                    styles.editToggleText,
                    editing && styles.editToggleTextActive,
                  ]}
                >
                  {editing ? "Done" : "Edit"}
                </Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          >
            {entries.length === 0 ? (
              <Text style={styles.emptyText}>
                {editing
                  ? "Nothing logged this day — add something below."
                  : "Nothing logged this day."}
              </Text>
            ) : editing ? (
              // Same row component the main log uses: tap to edit, swipe to
              // delete. Editing is opt-in so a casual tap on a chart bar
              // cannot delete a past entry by accident.
              entries.map((e, i) => (
                <SwipeableFoodRow
                  key={e.id}
                  entry={e}
                  isLast={i === entries.length - 1}
                  onDelete={() => onDeleteEntry(e)}
                  onEdit={() => onEditEntry?.(e)}
                />
              ))
            ) : (
              entries.map((e, i) => (
                <View
                  key={e.id}
                  style={[
                    styles.entryRow,
                    i < entries.length - 1 && styles.entryRowDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.entryMeta}>
                      P {Math.round(e.protein_g)}g · F {Math.round(e.fat_g)}g ·
                      C {Math.round(e.carbs_g)}g
                    </Text>
                  </View>
                  <Text style={styles.entryCal}>
                    {Math.round(e.calories).toLocaleString()}
                    <Text style={styles.entryCalUnit}> cal</Text>
                  </Text>
                </View>
              ))
            )}

            {editing ? (
              adding ? (
                <View style={styles.addForm}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={[styles.input, styles.sheetInput]}
                    placeholder="Food name"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                  <View style={styles.formRow}>
                    <TextInput
                      value={calInput}
                      onChangeText={setCalInput}
                      style={[styles.input, styles.sheetInput, { flex: 1 }]}
                      placeholder="Calories"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      value={proteinInput}
                      onChangeText={setProteinInput}
                      style={[styles.input, styles.sheetInput, { flex: 1 }]}
                      placeholder="Protein g"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.formRow}>
                    <TextInput
                      value={fatInput}
                      onChangeText={setFatInput}
                      style={[styles.input, styles.sheetInput, { flex: 1 }]}
                      placeholder="Fat g"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      value={carbsInput}
                      onChangeText={setCarbsInput}
                      style={[styles.input, styles.sheetInput, { flex: 1 }]}
                      placeholder="Carbs g"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.formRow}>
                    <Pressable
                      onPress={() => {
                        clearForm();
                        setAdding(false);
                      }}
                      style={({ pressed }) => [
                        styles.cancelBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={onAdd}
                      style={({ pressed }) => [
                        styles.addConfirmBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.addConfirmText}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    setAdding(true);
                  }}
                  style={({ pressed }) => [
                    styles.addRow,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Plus size={14} color={colors.primary} strokeWidth={2.5} />
                  <Text style={styles.addRowText}>Add food to this day</Text>
                </Pressable>
              )
            ) : null}
          </ScrollView>
          {/* Hidden when viewing today: copying a day onto itself would just
              duplicate every entry. */}
          {entries.length > 0 && !isToday ? (
            <Pressable
              onPress={onCopy}
              disabled={copying}
              style={({ pressed }) => [
                styles.copyBtn,
                copying && { opacity: 0.5 },
                pressed && !copying && { opacity: 0.85 },
              ]}
            >
              <CopyPlus size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.copyBtnText}>
                {copying ? "Copying…" : "Copy to today"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSheetStyles(s),
  ...makeEntryRowStyles(s),
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  copyBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  editToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  editToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  editToggleText: { fontSize: s(12), fontWeight: "600", color: colors.primary },
  editToggleTextActive: { color: "#FFFFFF" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    marginTop: 8,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "0F",
  },
  addRowText: { color: colors.primary, fontSize: s(13), fontWeight: "600" },
  addForm: {
    marginTop: 10,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: s(14),
    fontWeight: "600",
  },
  addConfirmBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
  },
  addConfirmText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  });
