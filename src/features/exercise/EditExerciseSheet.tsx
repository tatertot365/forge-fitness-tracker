import { Minus, Plus, Trash2, X } from "lucide-react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
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
  deleteExercise,
  getExercisesByDay,
  linkSuperset,
  unlinkSuperset,
  updateExercise,
} from "../../db/queries";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import {
  MUSCLE_LABEL,
  type Exercise,
  type ExerciseType,
} from "../../types";
import { hapticSuccess } from "../../utils/haptics";

const TYPE_ORDER: ExerciseType[] = ["normal", "drop", "superset", "bodyweight"];
const TYPE_LABELS = ["Normal", "Drop", "Superset", "Bodyweight"];

export function EditExerciseSheet({
  visible,
  exercise,
  dayExercises,
  onClose,
  onSaved,
  onDeleted,
}: {
  visible: boolean;
  exercise: Exercise;
  dayExercises: Exercise[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDeleted: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets);
  const [warmupSets, setWarmupSets] = useState(exercise.warmup_sets);
  const [repRange, setRepRange] = useState(exercise.rep_range);
  const [notes, setNotes] = useState(exercise.notes ?? "");
  const [type, setType] = useState<ExerciseType>(exercise.type);
  const [partnerId, setPartnerId] = useState<number | null>(
    exercise.superset_partner_id,
  );
  const [busy, setBusy] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    if (type === "superset") {
      getExercisesByDay(exercise.day).then((rows) =>
        setAllExercises(rows.filter((e) => e.id !== exercise.id)),
      );
    }
  }, [type, exercise.id, exercise.day]);

  const partnerCandidates = allExercises;
  const canSave =
    name.trim().length > 0 && (type !== "superset" || partnerId !== null);

  const onSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setBusy(true);
    try {
      await updateExercise(exercise.id, {
        name: trimmedName,
        sets,
        warmup_sets: warmupSets,
        rep_range: repRange.trim() || exercise.rep_range,
        notes: notes.trim() ? notes.trim() : null,
        type,
      });
      if (type === "superset" && partnerId) {
        await linkSuperset(exercise.id, partnerId);
      } else if (exercise.type === "superset" && type !== "superset") {
        await unlinkSuperset(exercise.id);
      }
      hapticSuccess();
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      "Delete exercise",
      `Remove "${exercise.name}" from this day? All logged sets for this exercise will be deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteExercise(exercise.id);
            } catch {
              setBusy(false);
              return;
            }
            hapticSuccess();
            onDeleted();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit exercise</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}
            >
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.fieldInput}
                placeholder="Exercise name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Sets</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => setSets((s) => Math.max(1, s - 1))}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.stepperValue}>{sets}</Text>
                <Pressable
                  onPress={() => setSets((s) => Math.min(10, s + 1))}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Warmup sets</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.stepperValue}>{warmupSets}</Text>
                <Pressable
                  onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Rep range</Text>
              <TextInput
                value={repRange}
                onChangeText={setRepRange}
                style={styles.fieldInput}
                placeholder="e.g. 8–12"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                style={[styles.fieldInput, { minHeight: 56 }]}
                placeholder="Optional cue or instruction"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <SegmentedControl
                values={TYPE_LABELS}
                selectedIndex={TYPE_ORDER.indexOf(type)}
                onChange={(e) =>
                  setType(TYPE_ORDER[e.nativeEvent.selectedSegmentIndex])
                }
                appearance="dark"
                tintColor={colors.primary}
                backgroundColor={colors.card}
                fontStyle={{ color: colors.textSecondary }}
                activeFontStyle={{ color: "#FFFFFF", fontWeight: "600" }}
                style={styles.segmentedNative}
              />

              {type === "superset" ? (
                <>
                  <Text style={styles.fieldLabel}>Pair with</Text>
                  {partnerCandidates.length === 0 ? (
                    <Text style={styles.sheetHint}>
                      No other exercises in your library yet. Add one first.
                    </Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {partnerCandidates.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => setPartnerId(c.id)}
                          style={({ pressed }) => [
                            styles.partnerOption,
                            partnerId === c.id && styles.partnerOptionActive,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.partnerOptionText,
                              partnerId === c.id &&
                                styles.partnerOptionTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {c.name}
                          </Text>
                          <Text
                            style={[
                              styles.partnerOptionDay,
                              partnerId === c.id && { color: colors.primary },
                            ]}
                          >
                            {MUSCLE_LABEL[c.muscle_group]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : null}

              <Text style={styles.sheetHint}>
                Changes apply to this day in future sessions. Logged history
                stays linked to this exercise.
              </Text>

              <Pressable
                onPress={onSave}
                disabled={busy || !canSave}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (busy || !canSave) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.saveBtnText}>Save changes</Text>
              </Pressable>

              <Pressable
                onPress={onDelete}
                disabled={busy}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Trash2 size={14} color={colors.red} strokeWidth={2} />
                <Text style={styles.deleteBtnText}>Delete exercise</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: "center",
  },
    saveBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
    sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
    sheetDismiss: { flex: 1 },
    sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "88%",
  },
    sheetScroll: {
    gap: 4,
    paddingBottom: 28,
  },
    sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
    sheetTitle: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
    fieldLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
  },
    fieldInput: {
    fontSize: s(15),
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
    stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
    stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
    stepperValue: {
    fontSize: s(18),
    fontWeight: "600",
    color: colors.text,
    minWidth: 24,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
    sheetHint: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 4,
  },
    deleteBtn: {
    marginTop: 2,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
    deleteBtnText: { color: colors.red, fontSize: s(14), fontWeight: "600" },
    segmentedNative: { marginBottom: 4 },
    partnerOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
    partnerOptionActive: {
    backgroundColor: colors.primary + "15",
    borderColor: colors.primary,
  },
    partnerOptionText: { fontSize: s(14), color: colors.text, flex: 1 },
    partnerOptionTextActive: { color: colors.primary, fontWeight: "600" },
    partnerOptionDay: {
    fontSize: s(11),
    color: colors.textMuted,
    fontWeight: "500",
  },
  });
