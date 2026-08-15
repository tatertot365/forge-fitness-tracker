import { Minus, Plus, X } from "lucide-react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import React, { useEffect, useMemo, useState } from "react";
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
  findExercisesByName,
  getAllStretches,
  getLibraryExercises,
  getExercisesByDay,
  linkSuperset,
} from "../../db/queries";
import { colors, muscleAccent } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import {
  DAY_LABEL,
  MUSCLE_LABEL,
  type Day,
  type Exercise,
  type ExerciseType,
  type LibraryExercise,
  type Stretch,
  type MuscleGroup,
} from "../../types";
import { hapticSuccess } from "../../utils/haptics";
import { type PartnerPickerValue } from "./PartnerPicker";
import { makeSs } from "./sheetStyles";
import { PartnerPicker } from "./PartnerPicker";

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "shoulders",
  "triceps",
  "back-width",
  "back-thickness",
  "biceps",
  "grip",
  "traps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

// ─── AddSheet ─────────────────────────────────────────────────────────────────

type AddSheetProps = {
  visible: boolean;
  day: Day;
  onClose: () => void;
  onCreated: () => void;
};

type AddMode = "library" | "stretches" | "new";

const TYPE_ORDER: ExerciseType[] = ["normal", "superset", "drop", "bodyweight"];
const TYPE_LABELS = ["Normal", "Superset", "Drop", "Bodyweight"];

const MODE_ORDER = ["library", "stretches", "new"] as const;
const MODE_LABELS = ["Library", "Stretches", "New"];

export function AddSheet({ visible, day, onClose, onCreated }: AddSheetProps) {
  const ss = useStyles(makeSs);
  const [mode, setMode] = useState<AddMode>("library");
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [stretchLibrary, setStretchLibrary] = useState<Stretch[]>([]);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [selectedStretch, setSelectedStretch] = useState<Stretch | null>(null);
  const [pickedGroup, setPickedGroup] = useState<MuscleGroup | null>(null);

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

  useEffect(() => {
    if (visible) {
      getLibraryExercises().then(setLibrary);
      getAllStretches().then(setStretchLibrary);
    }
  }, [visible]);

  // Load same-day exercises when superset type is selected
  useEffect(() => {
    if (type === "superset") {
      getExercisesByDay(day).then(setDayExercises);
      setPartnerValue(null);
    }
  }, [type, day]);

  const reset = () => {
    setMode("library");
    setSearch("");
    setFilterGroup(null);
    setSelected(null);
    setSelectedStretch(null);
    setPickedGroup(null);
    setName("");
    setSets(3);
    setWarmupSets(0);
    setRepRange("8–12");
    setNotes("");
    setType("normal");
    setHoldSeconds(30);
    setDayExercises([]);
    setPartnerValue(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const selectFromLibrary = (ex: LibraryExercise) => {
    setSelected(ex);
    setSelectedStretch(null);
    setPickedGroup(ex.muscle_group);
    setType("normal");
    setSets(3);
    setWarmupSets(0);
    setRepRange("8–12");
    setNotes(ex.notes ?? "");
  };

  const selectFromStretches = (st: Stretch) => {
    setSelectedStretch(st);
    setSelected(null);
    setPickedGroup(st.muscle_group);
    setType("stretch");
    setSets(2);
    setHoldSeconds(st.hold_seconds);
    setNotes(st.notes ?? "");
  };

  const switchMode = (m: AddMode) => {
    setMode(m);
    setSelected(null);
    setSelectedStretch(null);
    setPickedGroup(null);
    setSearch("");
    if (m === "new") {
      setName("");
      setSets(3);
      setWarmupSets(0);
      setRepRange("8–12");
      setNotes("");
      setType("normal");
    } else if (m === "stretches") {
      setType("stretch");
    }
    setPartnerValue(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.filter((e) => {
      if (filterGroup && e.muscle_group !== filterGroup) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [library, filterGroup, search]);

  const filteredStretches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stretchLibrary.filter((st) => {
      if (filterGroup && st.muscle_group !== filterGroup) return false;
      if (q && !st.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stretchLibrary, filterGroup, search]);

  const canSave =
    pickedGroup !== null &&
    (mode === "library"
      ? selected !== null
      : mode === "stretches"
        ? selectedStretch !== null
        : name.trim().length > 0) &&
    (type !== "superset" || partnerValue !== null);

  const doCreate = async (trimmed: string) => {
    if (!pickedGroup) return;
    setBusy(true);
    try {
      const isStretch = type === "stretch";
      const newId = await createExercise({
        day,
        muscle_group: pickedGroup,
        name: trimmed,
        sets,
        warmup_sets: isStretch ? 0 : warmupSets,
        rep_range: isStretch ? "—" : repRange.trim() || "8–12",
        notes: notes.trim() ? notes.trim() : null,
        type,
        hold_seconds: isStretch ? holdSeconds : null,
      });

      // Handle superset partner
      if (type === "superset" && partnerValue) {
        let partnerId: number;
        if (partnerValue.kind === "existing") {
          partnerId = partnerValue.exercise.id;
        } else {
          partnerId = await createExercise({
            day,
            muscle_group: partnerValue.muscleGroup,
            name: partnerValue.name,
            sets: partnerValue.sets,
            warmup_sets: 0,
            rep_range: partnerValue.repRange || "8–12",
            notes: null,
            type: "normal",
          });
        }
        await linkSuperset(newId, partnerId);
      }

      hapticSuccess();
      reset();
      onClose();
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!canSave || busy) return;
    const trimmed = (
      mode === "library"
        ? selected?.name ?? ""
        : mode === "stretches"
          ? selectedStretch?.name ?? ""
          : name
    ).trim();
    if (!trimmed) return;

    if (mode === "new") {
      setBusy(true);
      const existing = await findExercisesByName(trimmed);
      setBusy(false);
      if (existing.length > 0) {
        Alert.alert(
          "Name already in use",
          `"${trimmed}" already exists in the library. Adding it will use the existing entry. Add anyway?`,
          [
            { text: "Change name", style: "cancel" },
            { text: "Add anyway", onPress: () => doCreate(trimmed) },
          ],
        );
        return;
      }
    }

    await doCreate(trimmed);
  };

  const showConfig =
    mode === "new" ||
    (mode === "library" && selected !== null) ||
    (mode === "stretches" && selectedStretch !== null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={ss.backdrop}>
        <Pressable style={ss.dismiss} onPress={close} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={ss.sheet}>
            <View style={ss.sheetHeader}>
              <Text style={ss.sheetTitle}>Add to {DAY_LABEL[day]}</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {/* Mode toggle */}
              <SegmentedControl
                values={MODE_LABELS}
                selectedIndex={MODE_ORDER.indexOf(mode)}
                onChange={(e) =>
                  switchMode(MODE_ORDER[e.nativeEvent.selectedSegmentIndex])
                }
                appearance="dark"
                tintColor={colors.primary}
                backgroundColor={colors.card}
                fontStyle={{ color: colors.textSecondary }}
                activeFontStyle={{ color: "#FFFFFF", fontWeight: "600" }}
                style={ss.modeToggleNative}
              />

              {/* Library mode: search all + filter chips + list */}
              {mode === "library" && (
                <>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    style={[ss.input, { marginBottom: 10 }]}
                    placeholder="Search exercises…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      flexDirection: "row",
                      gap: 6,
                      paddingRight: 8,
                      paddingVertical: 2,
                    }}
                    keyboardShouldPersistTaps="handled"
                    style={{ marginBottom: 10 }}
                  >
                    <Pressable
                      onPress={() => setFilterGroup(null)}
                      style={({ pressed }) => [
                        ss.pill,
                        filterGroup === null && {
                          backgroundColor: colors.primary + "28",
                          borderColor: colors.primary,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          ss.pillText,
                          filterGroup === null && {
                            color: colors.primary,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {ALL_MUSCLE_GROUPS.map((mg) => {
                      const active = filterGroup === mg;
                      const accent = muscleAccent[mg] ?? colors.primary;
                      return (
                        <Pressable
                          key={mg}
                          onPress={() =>
                            setFilterGroup(active ? null : mg)
                          }
                          style={({ pressed }) => [
                            ss.pill,
                            active && {
                              backgroundColor: accent + "28",
                              borderColor: accent,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[
                              ss.pillText,
                              active && {
                                color: accent,
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {MUSCLE_LABEL[mg]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {filtered.length === 0 ? (
                    <Text style={ss.emptyText}>No exercises found</Text>
                  ) : (
                    <View style={[ss.listContainer, { maxHeight: 280 }]}>
                      <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {filtered.map((ex) => {
                          const isSel = selected?.id === ex.id;
                          const accent =
                            muscleAccent[ex.muscle_group] ?? colors.primary;
                          return (
                            <Pressable
                              key={ex.id}
                              onPress={() => selectFromLibrary(ex)}
                              style={({ pressed }) => [
                                ss.libraryRow,
                                isSel && ss.libraryRowSelected,
                                pressed && { opacity: 0.7 },
                              ]}
                            >
                              <View
                                style={{
                                  width: 3,
                                  height: 28,
                                  borderRadius: radius.accent,
                                  backgroundColor: accent,
                                  marginRight: 10,
                                }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    ss.libraryRowName,
                                    isSel && ss.libraryRowNameSelected,
                                  ]}
                                >
                                  {ex.name}
                                </Text>
                                <Text style={ss.libraryRowMeta}>
                                  {MUSCLE_LABEL[ex.muscle_group]}
                                </Text>
                              </View>
                              {isSel && (
                                <View style={ss.checkBadge}>
                                  <Text style={ss.checkText}>✓</Text>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {/* Stretches mode: pick from seeded stretch library */}
              {mode === "stretches" && (
                <>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    style={[ss.input, { marginBottom: 10 }]}
                    placeholder="Search stretches…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      flexDirection: "row",
                      gap: 6,
                      paddingRight: 8,
                      paddingVertical: 2,
                    }}
                    keyboardShouldPersistTaps="handled"
                    style={{ marginBottom: 10 }}
                  >
                    <Pressable
                      onPress={() => setFilterGroup(null)}
                      style={({ pressed }) => [
                        ss.pill,
                        filterGroup === null && {
                          backgroundColor: colors.primary + "28",
                          borderColor: colors.primary,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          ss.pillText,
                          filterGroup === null && {
                            color: colors.primary,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {ALL_MUSCLE_GROUPS.map((mg) => {
                      const active = filterGroup === mg;
                      const accent = muscleAccent[mg] ?? colors.primary;
                      return (
                        <Pressable
                          key={mg}
                          onPress={() =>
                            setFilterGroup(active ? null : mg)
                          }
                          style={({ pressed }) => [
                            ss.pill,
                            active && {
                              backgroundColor: accent + "28",
                              borderColor: accent,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[
                              ss.pillText,
                              active && {
                                color: accent,
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {MUSCLE_LABEL[mg]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {filteredStretches.length === 0 ? (
                    <Text style={ss.emptyText}>No stretches found</Text>
                  ) : (
                    <View style={[ss.listContainer, { maxHeight: 280 }]}>
                      <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {filteredStretches.map((st) => {
                          const isSel = selectedStretch?.id === st.id;
                          const accent =
                            muscleAccent[st.muscle_group] ?? colors.primary;
                          return (
                            <Pressable
                              key={st.id}
                              onPress={() => selectFromStretches(st)}
                              style={({ pressed }) => [
                                ss.libraryRow,
                                isSel && ss.libraryRowSelected,
                                pressed && { opacity: 0.7 },
                              ]}
                            >
                              <View
                                style={{
                                  width: 3,
                                  height: 28,
                                  borderRadius: radius.accent,
                                  backgroundColor: accent,
                                  marginRight: 10,
                                }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    ss.libraryRowName,
                                    isSel && ss.libraryRowNameSelected,
                                  ]}
                                >
                                  {st.name}
                                </Text>
                                <Text style={ss.libraryRowMeta}>
                                  {MUSCLE_LABEL[st.muscle_group]} · {st.hold_seconds}s
                                  {st.per_side ? ' · per side' : ''}
                                </Text>
                              </View>
                              {isSel && (
                                <View style={ss.checkBadge}>
                                  <Text style={ss.checkText}>✓</Text>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {/* New mode: name + explicit muscle group picker */}
              {mode === "new" && (
                <>
                  <Text style={ss.fieldLabel}>Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={ss.input}
                    placeholder="e.g. Lateral raise"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoFocus
                  />
                  <Text style={ss.fieldLabel}>Muscle group</Text>
                  <View style={ss.pillRow}>
                    {ALL_MUSCLE_GROUPS.map((mg) => {
                      const active = pickedGroup === mg;
                      const accent = muscleAccent[mg] ?? colors.primary;
                      return (
                        <Pressable
                          key={mg}
                          onPress={() =>
                            setPickedGroup(active ? null : mg)
                          }
                          style={({ pressed }) => [
                            ss.pill,
                            active && {
                              backgroundColor: accent + "28",
                              borderColor: accent,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[
                              ss.pillText,
                              active && {
                                color: accent,
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {MUSCLE_LABEL[mg]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Config fields (only after a library pick or new-mode setup) */}
              {showConfig && (
                <>
                  {mode === "library" && selected && pickedGroup && (
                    <View style={[ss.selectedBanner, { marginTop: 14 }]}>
                      <Text style={ss.selectedBannerText}>
                        {selected.name}
                      </Text>
                      <Text style={ss.selectedBannerSub}>
                        Adding to {MUSCLE_LABEL[pickedGroup]}
                      </Text>
                    </View>
                  )}
                  {mode === "stretches" && selectedStretch && pickedGroup && (
                    <View style={[ss.selectedBanner, { marginTop: 14 }]}>
                      <Text style={ss.selectedBannerText}>
                        {selectedStretch.name}
                      </Text>
                      <Text style={ss.selectedBannerSub}>
                        Stretch · {MUSCLE_LABEL[pickedGroup]}
                      </Text>
                    </View>
                  )}

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
                          onPress={() =>
                            setWarmupSets((s) => Math.max(0, s - 1))
                          }
                          style={({ pressed }) => [
                            ss.stepperBtn,
                            pressed && { opacity: 0.6 },
                          ]}
                        >
                          <Minus size={16} color={colors.text} />
                        </Pressable>
                        <Text style={ss.stepperValue}>{warmupSets}</Text>
                        <Pressable
                          onPress={() =>
                            setWarmupSets((s) => Math.min(5, s + 1))
                          }
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
                        style={ss.segmentedNative}
                      />
                    </>
                  )}

                  {/* Superset partner picker */}
                  {type === "superset" && (
                    <>
                      <View style={ss.partnerHeader}>
                        <Text style={ss.partnerHeaderText}>
                          Pick a superset partner
                        </Text>
                      </View>
                      <PartnerPicker
                        dayExercises={dayExercises}
                        value={partnerValue}
                        onChange={setPartnerValue}
                      />
                      {!canSave && pickedGroup !== null && (
                        <Text style={ss.partnerHint}>
                          Select or create a partner exercise to save.
                        </Text>
                      )}
                    </>
                  )}

                  <Pressable
                    onPress={onSave}
                    disabled={busy || !canSave}
                    style={({ pressed }) => [
                      ss.saveBtn,
                      (busy || !canSave) && { opacity: 0.5 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={ss.saveBtnText}>
                      {mode === "library" && selected
                        ? `Add "${selected.name}"`
                        : mode === "stretches" && selectedStretch
                          ? `Add "${selectedStretch.name}"`
                          : "Add exercise"}
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
