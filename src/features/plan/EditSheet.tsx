import { Minus, Plus, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createExercise,
  deleteExercise,
  deleteExercisesByName,
  getExercise,
  getExercisesByDay,
  linkSuperset,
  unlinkSuperset,
  updateExercise,
} from "../../db/queries";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import {
  DAY_LABEL,
  type Exercise,
  type ExerciseType,
} from "../../types";
import { hapticSuccess, hapticTap } from "../../utils/haptics";
import { type PartnerPickerValue } from "./PartnerPicker";
import { makeSs } from "./sheetStyles";
import { PartnerPicker } from "./PartnerPicker";

// ─── EditSheet ────────────────────────────────────────────────────────────────

type EditSheetProps = {
  visible: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export function EditSheet({
  visible,
  exercise,
  onClose,
  onSaved,
  onDeleted,
}: EditSheetProps) {
  const ss = useStyles(makeSs);
  const [name, setName] = useState("");
  const [sets, setSets] = useState(3);
  const [warmupSets, setWarmupSets] = useState(0);
  const [repRange, setRepRange] = useState("8–12");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<ExerciseType>("normal");
  const [holdSeconds, setHoldSeconds] = useState(30);
  const [busy, setBusy] = useState(false);

  const [dayExercises, setDayExercises] = useState<Exercise[]>([]);
  const [partnerValue, setPartnerValue] = useState<PartnerPickerValue | null>(
    null,
  );
  const [currentPartner, setCurrentPartner] = useState<Exercise | null>(null);

  // Sync fields when exercise changes
  useEffect(() => {
    if (exercise) {
      setName(exercise.name);
      setSets(exercise.sets);
      setWarmupSets(exercise.warmup_sets ?? 0);
      setRepRange(exercise.rep_range);
      setNotes(exercise.notes ?? "");
      setType(exercise.type);
      setHoldSeconds(exercise.hold_seconds ?? 30);
      setPartnerValue(null);
      setCurrentPartner(null);
      setDayExercises([]);

      if (exercise.superset_partner_id) {
        getExercise(exercise.superset_partner_id).then((p) => {
          if (p) {
            setCurrentPartner(p);
            setPartnerValue({ kind: "existing", exercise: p });
          }
        });
      }
    }
  }, [exercise]);

  // Load same-day exercises when superset type is active
  useEffect(() => {
    if (type === "superset" && exercise) {
      getExercisesByDay(exercise.day).then((exs) => {
        setDayExercises(exs.filter((e) => e.id !== exercise.id));
      });
    }
  }, [type, exercise?.id, exercise?.day]);

  const canSave = !(type === "superset" && partnerValue === null);

  const doSave = async () => {
    if (!exercise || busy || !canSave) return;

    const isChangingPartner =
      type === "superset" &&
      currentPartner !== null &&
      partnerValue !== null &&
      (partnerValue.kind === "new" ||
        (partnerValue.kind === "existing" &&
          partnerValue.exercise.id !== currentPartner.id));

    const performSave = async () => {
      setBusy(true);
      try {
        const isStretch = type === "stretch";
        await updateExercise(exercise.id, {
          name: name.trim() || exercise.name,
          sets,
          warmup_sets: isStretch ? 0 : warmupSets,
          rep_range: isStretch ? "—" : repRange.trim() || exercise.rep_range,
          notes: notes.trim() || null,
          type,
          hold_seconds: isStretch ? holdSeconds : null,
        });

        if (type === "superset" && partnerValue) {
          let partnerId: number;
          if (partnerValue.kind === "existing") {
            partnerId = partnerValue.exercise.id;
          } else {
            partnerId = await createExercise({
              day: exercise.day,
              muscle_group: partnerValue.muscleGroup,
              name: partnerValue.name,
              sets: partnerValue.sets,
              warmup_sets: 0,
              rep_range: partnerValue.repRange || "8–12",
              notes: null,
              type: "normal",
            });
          }
          await linkSuperset(exercise.id, partnerId);
        } else if (type !== "superset" && exercise.type === "superset") {
          await unlinkSuperset(exercise.id);
        }

        hapticSuccess();
        onClose();
        onSaved();
      } finally {
        setBusy(false);
      }
    };

    if (isChangingPartner) {
      const newName =
        partnerValue!.kind === "existing"
          ? partnerValue!.exercise.name
          : partnerValue!.name;
      Alert.alert(
        "Replace superset partner?",
        `"${currentPartner!.name}" will be unlinked. "${newName}" will become the new partner.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace",
            onPress: () => {
              performSave();
            },
          },
        ],
      );
      return;
    }

    await performSave();
  };

  const confirmDeleteOne = () => {
    if (!exercise) return;
    Alert.alert(
      `Remove from ${DAY_LABEL[exercise.day]}?`,
      `"${exercise.name}" will be removed from ${DAY_LABEL[exercise.day]}. All logged sets for this exercise on this day will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteExercise(exercise.id);
              hapticTap();
              onClose();
              onDeleted();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmDeleteAll = () => {
    if (!exercise) return;
    Alert.alert(
      "Delete from all days?",
      `"${exercise.name}" will be permanently removed from every day it appears on. All training history for this exercise will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everywhere",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteExercisesByName(exercise.name);
              hapticTap();
              onClose();
              onDeleted();
            } finally {
              setBusy(false);
            }
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
      <View style={ss.backdrop}>
        <Pressable style={ss.dismiss} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={ss.sheet}>
            <View style={ss.sheetHeader}>
              <Text style={ss.sheetTitle}>Edit exercise</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {exercise ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                <Text style={ss.fieldLabel}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={ss.input}
                  placeholder="Exercise name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />

                <Text style={ss.fieldLabel}>
                  {type === "stretch" ? "Rounds" : "Sets"}
                </Text>
                <View style={ss.stepperRow}>
                  <Pressable
                    onPress={() => setSets((s) => Math.max(1, s - 1))}
                    style={({ pressed }) => [
                      ss.stepperBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Minus size={16} color={colors.text} />
                  </Pressable>
                  <Text style={ss.stepperValue}>{sets}</Text>
                  <Pressable
                    onPress={() => setSets((s) => Math.min(10, s + 1))}
                    style={({ pressed }) => [
                      ss.stepperBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Plus size={16} color={colors.text} />
                  </Pressable>
                </View>

                {type === "stretch" ? (
                  <>
                    <Text style={ss.fieldLabel}>Hold (seconds)</Text>
                    <View style={ss.stepperRow}>
                      <Pressable
                        onPress={() =>
                          setHoldSeconds((s) => Math.max(5, s - 5))
                        }
                        style={({ pressed }) => [
                          ss.stepperBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Minus size={16} color={colors.text} />
                      </Pressable>
                      <Text style={ss.stepperValue}>{holdSeconds}</Text>
                      <Pressable
                        onPress={() =>
                          setHoldSeconds((s) => Math.min(300, s + 5))
                        }
                        style={({ pressed }) => [
                          ss.stepperBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Plus size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={ss.fieldLabel}>Warmup sets</Text>
                    <View style={ss.stepperRow}>
                      <Pressable
                        onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                        style={({ pressed }) => [
                          ss.stepperBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Minus size={16} color={colors.text} />
                      </Pressable>
                      <Text style={ss.stepperValue}>{warmupSets}</Text>
                      <Pressable
                        onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                        style={({ pressed }) => [
                          ss.stepperBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Plus size={16} color={colors.text} />
                      </Pressable>
                    </View>

                    <Text style={ss.fieldLabel}>Rep range</Text>
                    <TextInput
                      value={repRange}
                      onChangeText={setRepRange}
                      style={ss.input}
                      placeholder="e.g. 8–12"
                      placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}

                <Text style={ss.fieldLabel}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  style={[ss.input, { minHeight: 56 }]}
                  placeholder="Optional cue or instruction"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                {type !== "stretch" && (
                  <>
                    <Text style={ss.fieldLabel}>Type</Text>
                    <View style={ss.segmented}>
                      {(
                        [
                          "normal",
                          "superset",
                          "drop",
                          "bodyweight",
                        ] as ExerciseType[]
                      ).map((t) => (
                        <Pressable
                          key={t}
                          onPress={() => setType(t)}
                          style={({ pressed }) => [
                            ss.segment,
                            type === t && ss.segmentActive,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[
                              ss.segmentText,
                              type === t && ss.segmentTextActive,
                            ]}
                          >
                            {t === "normal"
                              ? "Normal"
                              : t === "superset"
                                ? "Superset"
                                : t === "drop"
                                  ? "Drop"
                                  : "Bodyweight"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {/* Superset partner picker */}
                {type === "superset" && (
                  <>
                    <View style={ss.partnerHeader}>
                      <Text style={ss.partnerHeaderText}>
                        {currentPartner
                          ? "Superset partner"
                          : "Pick a superset partner"}
                      </Text>
                      {currentPartner &&
                        partnerValue?.kind === "existing" &&
                        partnerValue.exercise.id === currentPartner.id && (
                          <View style={ss.partnerBadge}>
                            <Text style={ss.partnerBadgeText}>
                              {currentPartner.name}
                            </Text>
                          </View>
                        )}
                    </View>
                    <PartnerPicker
                      dayExercises={dayExercises}
                      value={partnerValue}
                      onChange={setPartnerValue}
                    />
                    {!canSave && (
                      <Text style={ss.partnerHint}>
                        Select or create a partner exercise to save.
                      </Text>
                    )}
                  </>
                )}

                <Pressable
                  onPress={doSave}
                  disabled={busy || !canSave}
                  style={({ pressed }) => [
                    ss.saveBtn,
                    (busy || !canSave) && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={ss.saveBtnText}>Save changes</Text>
                </Pressable>

                <View style={ss.deleteDivider} />

                <Pressable
                  onPress={confirmDeleteOne}
                  disabled={busy}
                  style={({ pressed }) => [
                    ss.deleteBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={ss.deleteBtnText}>
                    Remove from {DAY_LABEL[exercise.day]}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={confirmDeleteAll}
                  disabled={busy}
                  style={({ pressed }) => [
                    ss.deleteBtn,
                    { marginTop: 8 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={ss.deleteBtnText}>Delete from all days</Text>
                  <Text style={ss.deleteBtnSub}>
                    Removes from every day · erases all history
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
