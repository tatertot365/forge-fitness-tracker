import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, GripVertical, Minus, Plus, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createExercise,
  deleteExercise,
  deleteExercisesByName,
  findExercisesByName,
  getAllUniqueExercises,
  getDayPlans,
  getExercise,
  getExercisesByDay,
  linkSuperset,
  reorderExercisesInGroup,
  reorderGroupsInDay,
  unlinkSuperset,
  updateDayPlan,
  updateExercise,
} from '../src/db/queries';
import { colors, muscleAccent } from '../src/theme/colors';
import { radius, typography } from '../src/theme/spacing';
import {
  DAY_LABEL,
  DAYS,
  MUSCLE_LABEL,
  type Day,
  type DayPlan,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
} from '../src/types';
import { hapticSelect, hapticSuccess, hapticTap } from '../src/utils/haptics';

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'shoulders', 'triceps',
  'back-width', 'back-thickness', 'biceps', 'grip',
  'quads', 'hamstrings-glutes', 'calves', 'core',
];

// ─── PartnerPicker ────────────────────────────────────────────────────────────

type PartnerPickerValue =
  | { kind: 'existing'; exercise: Exercise }
  | { kind: 'new'; name: string; muscleGroup: MuscleGroup; sets: number; repRange: string };

type PartnerPickerProps = {
  dayExercises: Exercise[];
  value: PartnerPickerValue | null;
  onChange: (v: PartnerPickerValue | null) => void;
};

function PartnerPicker({ dayExercises, value, onChange }: PartnerPickerProps) {
  const [mode, setMode] = useState<'library' | 'new'>(
    value?.kind === 'new' ? 'new' : 'library',
  );
  const [search, setSearch] = useState('');
  const [npName, setNpName] = useState(value?.kind === 'new' ? value.name : '');
  const [npMg, setNpMg] = useState<MuscleGroup | null>(
    value?.kind === 'new' ? value.muscleGroup : null,
  );
  const [npSets, setNpSets] = useState(value?.kind === 'new' ? value.sets : 3);
  const [npRepRange, setNpRepRange] = useState(
    value?.kind === 'new' ? value.repRange : '8–12',
  );

  const switchMode = (m: 'library' | 'new') => {
    setMode(m);
    onChange(null);
  };

  const selectExisting = (ex: Exercise) => {
    onChange({ kind: 'existing', exercise: ex });
  };

  const updateNew = (patch: {
    name?: string;
    mg?: MuscleGroup | null;
    sets?: number;
    repRange?: string;
  }) => {
    const n = patch.name !== undefined ? patch.name : npName;
    const m = patch.mg !== undefined ? patch.mg : npMg;
    const s = patch.sets !== undefined ? patch.sets : npSets;
    const r = patch.repRange !== undefined ? patch.repRange : npRepRange;

    if (patch.name !== undefined) setNpName(patch.name);
    if (patch.mg !== undefined) setNpMg(patch.mg);
    if (patch.sets !== undefined) setNpSets(patch.sets);
    if (patch.repRange !== undefined) setNpRepRange(patch.repRange);

    if (n.trim() && m) {
      onChange({
        kind: 'new',
        name: n.trim(),
        muscleGroup: m,
        sets: s,
        repRange: r.trim() || '8–12',
      });
    } else {
      onChange(null);
    }
  };

  const filtered = search.trim()
    ? dayExercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : dayExercises;

  return (
    <View>
      <View style={[ss.modeToggle, { marginTop: 6 }]}>
        {(['library', 'new'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            style={[ss.modeBtn, mode === m && ss.modeBtnActive]}
          >
            <Text style={[ss.modeBtnText, mode === m && ss.modeBtnTextActive]}>
              {m === 'library' ? 'From this day' : 'Create new'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'library' && (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={[ss.input, { marginBottom: 8 }]}
            placeholder="Search exercises…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {filtered.length === 0 ? (
            <Text style={ss.emptyText}>
              {search.trim()
                ? 'No matches'
                : 'No other exercises on this day — use "Create new" to add one'}
            </Text>
          ) : (
            <View style={ss.listContainer}>
              {filtered.map((ex) => {
                const isSel =
                  value?.kind === 'existing' && value.exercise.id === ex.id;
                return (
                  <Pressable
                    key={ex.id}
                    onPress={() => selectExisting(ex)}
                    style={({ pressed }) => [
                      ss.libraryRow,
                      isSel && ss.libraryRowSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[ss.libraryRowName, isSel && ss.libraryRowNameSelected]}>
                        {ex.name}
                      </Text>
                      <Text style={ss.libraryRowMeta}>
                        {ex.sets} sets · {ex.rep_range}
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
            </View>
          )}
        </>
      )}

      {mode === 'new' && (
        <>
          <Text style={ss.fieldLabel}>Name</Text>
          <TextInput
            value={npName}
            onChangeText={(t) => updateNew({ name: t })}
            style={ss.input}
            placeholder="e.g. Overhead tricep extension"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          <Text style={ss.fieldLabel}>Muscle group</Text>
          <View style={ss.pillRow}>
            {ALL_MUSCLE_GROUPS.map((mg) => {
              const active = npMg === mg;
              const accent = muscleAccent[mg] ?? colors.primary;
              return (
                <Pressable
                  key={mg}
                  onPress={() => updateNew({ mg: active ? null : mg })}
                  style={({ pressed }) => [
                    ss.pill,
                    active && { backgroundColor: accent + '28', borderColor: accent },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[ss.pillText, active && { color: accent, fontWeight: '600' }]}>
                    {MUSCLE_LABEL[mg]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={ss.fieldLabel}>Sets</Text>
          <View style={ss.stepperRow}>
            <Pressable
              onPress={() => updateNew({ sets: Math.max(1, npSets - 1) })}
              style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
            >
              <Minus size={16} color={colors.text} />
            </Pressable>
            <Text style={ss.stepperValue}>{npSets}</Text>
            <Pressable
              onPress={() => updateNew({ sets: Math.min(10, npSets + 1) })}
              style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
            >
              <Plus size={16} color={colors.text} />
            </Pressable>
          </View>

          <Text style={ss.fieldLabel}>Rep range</Text>
          <TextInput
            value={npRepRange}
            onChangeText={(t) => updateNew({ repRange: t })}
            style={ss.input}
            placeholder="e.g. 8–12"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}
    </View>
  );
}

// ─── EditSheet ────────────────────────────────────────────────────────────────

type EditSheetProps = {
  visible: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

function EditSheet({ visible, exercise, onClose, onSaved, onDeleted }: EditSheetProps) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [warmupSets, setWarmupSets] = useState(0);
  const [repRange, setRepRange] = useState('8–12');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<ExerciseType>('normal');
  const [busy, setBusy] = useState(false);

  const [dayExercises, setDayExercises] = useState<Exercise[]>([]);
  const [partnerValue, setPartnerValue] = useState<PartnerPickerValue | null>(null);
  const [currentPartner, setCurrentPartner] = useState<Exercise | null>(null);

  // Sync fields when exercise changes
  useEffect(() => {
    if (exercise) {
      setName(exercise.name);
      setSets(exercise.sets);
      setWarmupSets(exercise.warmup_sets ?? 0);
      setRepRange(exercise.rep_range);
      setNotes(exercise.notes ?? '');
      setType(exercise.type);
      setPartnerValue(null);
      setCurrentPartner(null);
      setDayExercises([]);

      if (exercise.superset_partner_id) {
        getExercise(exercise.superset_partner_id).then((p) => {
          if (p) {
            setCurrentPartner(p);
            setPartnerValue({ kind: 'existing', exercise: p });
          }
        });
      }
    }
  }, [exercise]);

  // Load same-day exercises when superset type is active
  useEffect(() => {
    if (type === 'superset' && exercise) {
      getExercisesByDay(exercise.day).then((exs) => {
        setDayExercises(exs.filter((e) => e.id !== exercise.id));
      });
    }
  }, [type, exercise?.id, exercise?.day]);

  const canSave = !(type === 'superset' && partnerValue === null);

  const doSave = async () => {
    if (!exercise || busy || !canSave) return;

    const isChangingPartner =
      type === 'superset' &&
      currentPartner !== null &&
      partnerValue !== null &&
      (partnerValue.kind === 'new' ||
        (partnerValue.kind === 'existing' &&
          partnerValue.exercise.id !== currentPartner.id));

    const performSave = async () => {
      setBusy(true);
      try {
        await updateExercise(exercise.id, {
          name: name.trim() || exercise.name,
          sets,
          warmup_sets: warmupSets,
          rep_range: repRange.trim() || exercise.rep_range,
          notes: notes.trim() || null,
          type,
        });

        if (type === 'superset' && partnerValue) {
          let partnerId: number;
          if (partnerValue.kind === 'existing') {
            partnerId = partnerValue.exercise.id;
          } else {
            partnerId = await createExercise({
              day: exercise.day,
              muscle_group: partnerValue.muscleGroup,
              name: partnerValue.name,
              sets: partnerValue.sets,
              warmup_sets: 0,
              rep_range: partnerValue.repRange || '8–12',
              notes: null,
              accent_color: muscleAccent[partnerValue.muscleGroup] ?? colors.primary,
              type: 'normal',
            });
          }
          await linkSuperset(exercise.id, partnerId);
        } else if (type !== 'superset' && exercise.type === 'superset') {
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
        partnerValue!.kind === 'existing'
          ? partnerValue!.exercise.name
          : partnerValue!.name;
      Alert.alert(
        'Replace superset partner?',
        `"${currentPartner!.name}" will be unlinked. "${newName}" will become the new partner.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', onPress: () => { performSave(); } },
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
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
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
      'Delete from all days?',
      `"${exercise.name}" will be permanently removed from every day it appears on. All training history for this exercise will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everywhere',
          style: 'destructive',
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ss.backdrop}>
        <Pressable style={ss.dismiss} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={ss.sheet}>
            <View style={ss.sheetHeader}>
              <Text style={ss.sheetTitle}>Edit exercise</Text>
              <Pressable onPress={onClose} hitSlop={10}>
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

                <Text style={ss.fieldLabel}>Sets</Text>
                <View style={ss.stepperRow}>
                  <Pressable
                    onPress={() => setSets((s) => Math.max(1, s - 1))}
                    style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Minus size={16} color={colors.text} />
                  </Pressable>
                  <Text style={ss.stepperValue}>{sets}</Text>
                  <Pressable
                    onPress={() => setSets((s) => Math.min(10, s + 1))}
                    style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Plus size={16} color={colors.text} />
                  </Pressable>
                </View>

                <Text style={ss.fieldLabel}>Warmup sets</Text>
                <View style={ss.stepperRow}>
                  <Pressable
                    onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                    style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Minus size={16} color={colors.text} />
                  </Pressable>
                  <Text style={ss.stepperValue}>{warmupSets}</Text>
                  <Pressable
                    onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                    style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
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

                <Text style={ss.fieldLabel}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  style={[ss.input, { minHeight: 56 }]}
                  placeholder="Optional cue or instruction"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                <Text style={ss.fieldLabel}>Type</Text>
                <View style={ss.segmented}>
                  {(['normal', 'superset', 'drop', 'bodyweight'] as ExerciseType[]).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={({ pressed }) => [
                        ss.segment,
                        type === t && ss.segmentActive,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[ss.segmentText, type === t && ss.segmentTextActive]}>
                        {t === 'normal'
                          ? 'Normal'
                          : t === 'superset'
                          ? 'Superset'
                          : t === 'drop'
                          ? 'Drop'
                          : 'Bodyweight'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Superset partner picker */}
                {type === 'superset' && (
                  <>
                    <View style={ss.partnerHeader}>
                      <Text style={ss.partnerHeaderText}>
                        {currentPartner ? 'Superset partner' : 'Pick a superset partner'}
                      </Text>
                      {currentPartner && partnerValue?.kind === 'existing' &&
                        partnerValue.exercise.id === currentPartner.id && (
                          <View style={ss.partnerBadge}>
                            <Text style={ss.partnerBadgeText}>{currentPartner.name}</Text>
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
                  style={({ pressed }) => [ss.deleteBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={ss.deleteBtnText}>Remove from {DAY_LABEL[exercise.day]}</Text>
                </Pressable>

                <Pressable
                  onPress={confirmDeleteAll}
                  disabled={busy}
                  style={({ pressed }) => [ss.deleteBtn, { marginTop: 8 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={ss.deleteBtnText}>Delete from all days</Text>
                  <Text style={ss.deleteBtnSub}>Removes from every day · erases all history</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── AddSheet ─────────────────────────────────────────────────────────────────

type AddSheetProps = {
  visible: boolean;
  day: Day;
  onClose: () => void;
  onCreated: () => void;
};

type AddMode = 'library' | 'new';

function AddSheet({ visible, day, onClose, onCreated }: AddSheetProps) {
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [mode, setMode] = useState<AddMode>('library');
  const [search, setSearch] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);

  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [warmupSets, setWarmupSets] = useState(0);
  const [repRange, setRepRange] = useState('8–12');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<ExerciseType>('normal');
  const [busy, setBusy] = useState(false);

  const [dayExercises, setDayExercises] = useState<Exercise[]>([]);
  const [partnerValue, setPartnerValue] = useState<PartnerPickerValue | null>(null);

  useEffect(() => {
    if (visible) {
      getAllUniqueExercises().then(setAllExercises);
    }
  }, [visible]);

  // Load same-day exercises when superset type is selected
  useEffect(() => {
    if (type === 'superset') {
      getExercisesByDay(day).then(setDayExercises);
      setPartnerValue(null);
    }
  }, [type, day]);

  const reset = () => {
    setMuscleGroup(null);
    setMode('library');
    setSearch('');
    setSelected(null);
    setName('');
    setSets(3);
    setWarmupSets(0);
    setRepRange('8–12');
    setNotes('');
    setType('normal');
    setDayExercises([]);
    setPartnerValue(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const selectFromLibrary = (ex: Exercise) => {
    setSelected(ex);
    setType(ex.type === 'superset' ? 'normal' : (ex.type as ExerciseType));
    setSets(ex.sets ?? 3);
    setWarmupSets(ex.warmup_sets ?? 0);
    setRepRange(ex.rep_range ?? '8–12');
    setNotes('');
  };

  const switchMode = (m: AddMode) => {
    setMode(m);
    setSelected(null);
    setSearch('');
    if (m === 'new') {
      setName('');
      setSets(3);
      setWarmupSets(0);
      setRepRange('8–12');
      setNotes('');
      setType('normal');
    }
    setPartnerValue(null);
  };

  const filtered = search.trim()
    ? allExercises.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allExercises;

  const canSave =
    muscleGroup !== null &&
    (mode === 'library' ? selected !== null : name.trim().length > 0) &&
    (type !== 'superset' || partnerValue !== null);

  const doCreate = async (trimmed: string) => {
    if (!muscleGroup) return;
    setBusy(true);
    try {
      const newId = await createExercise({
        day,
        muscle_group: muscleGroup,
        name: trimmed,
        sets,
        warmup_sets: warmupSets,
        rep_range: repRange.trim() || '8–12',
        notes: notes.trim() ? notes.trim() : null,
        accent_color: muscleAccent[muscleGroup] ?? colors.primary,
        type,
      });

      // Handle superset partner
      if (type === 'superset' && partnerValue) {
        let partnerId: number;
        if (partnerValue.kind === 'existing') {
          partnerId = partnerValue.exercise.id;
        } else {
          partnerId = await createExercise({
            day,
            muscle_group: partnerValue.muscleGroup,
            name: partnerValue.name,
            sets: partnerValue.sets,
            warmup_sets: 0,
            rep_range: partnerValue.repRange || '8–12',
            notes: null,
            accent_color: muscleAccent[partnerValue.muscleGroup] ?? colors.primary,
            type: 'normal',
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
    const trimmed = (mode === 'library' ? selected?.name ?? '' : name).trim();
    if (!trimmed) return;

    if (mode === 'new') {
      setBusy(true);
      const existing = await findExercisesByName(trimmed);
      setBusy(false);
      if (existing.length > 0) {
        const days = [...new Set(existing.map((e) => DAY_LABEL[e.day]))].join(', ');
        Alert.alert(
          'Name already in use',
          `"${trimmed}" already exists on ${days}. Both entries will share training history. Add anyway?`,
          [
            { text: 'Change name', style: 'cancel' },
            { text: 'Add anyway', onPress: () => doCreate(trimmed) },
          ],
        );
        return;
      }
    }

    await doCreate(trimmed);
  };

  const showConfig =
    muscleGroup !== null &&
    (mode === 'new' || (mode === 'library' && selected !== null));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={ss.backdrop}>
        <Pressable style={ss.dismiss} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={ss.sheet}>
            <View style={ss.sheetHeader}>
              <Text style={ss.sheetTitle}>Add to {DAY_LABEL[day]}</Text>
              <Pressable onPress={close} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {/* Muscle group picker */}
              <Text style={ss.fieldLabel}>Muscle group</Text>
              <View style={ss.pillRow}>
                {ALL_MUSCLE_GROUPS.map((mg) => {
                  const active = muscleGroup === mg;
                  const accent = muscleAccent[mg] ?? colors.primary;
                  return (
                    <Pressable
                      key={mg}
                      onPress={() => setMuscleGroup(active ? null : mg)}
                      style={({ pressed }) => [
                        ss.pill,
                        active && { backgroundColor: accent + '28', borderColor: accent },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[ss.pillText, active && { color: accent, fontWeight: '600' }]}>
                        {MUSCLE_LABEL[mg]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {muscleGroup !== null && (
                <>
                  {/* Mode toggle */}
                  <View style={[ss.modeToggle, { marginTop: 14 }]}>
                    {(['library', 'new'] as AddMode[]).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => switchMode(m)}
                        style={[ss.modeBtn, mode === m && ss.modeBtnActive]}
                      >
                        <Text style={[ss.modeBtnText, mode === m && ss.modeBtnTextActive]}>
                          {m === 'library' ? 'From library' : 'New exercise'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Library search list */}
                  {mode === 'library' && (
                    <>
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        style={[ss.input, { marginBottom: 8 }]}
                        placeholder="Search exercises…"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        clearButtonMode="while-editing"
                      />
                      {filtered.length === 0 ? (
                        <Text style={ss.emptyText}>No exercises found</Text>
                      ) : (
                        <View style={ss.listContainer}>
                          {filtered.map((ex) => {
                            const isSel = selected?.id === ex.id;
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
                                <View style={{ flex: 1 }}>
                                  <Text style={[ss.libraryRowName, isSel && ss.libraryRowNameSelected]}>
                                    {ex.name}
                                  </Text>
                                  <Text style={ss.libraryRowMeta}>
                                    {DAY_LABEL[ex.day]} · {ex.sets} sets · {ex.rep_range}
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
                        </View>
                      )}
                    </>
                  )}

                  {/* Config fields */}
                  {showConfig && (
                    <>
                      {mode === 'new' && (
                        <>
                          <Text style={ss.fieldLabel}>Name</Text>
                          <TextInput
                            value={name}
                            onChangeText={setName}
                            style={ss.input}
                            placeholder="e.g. Lateral raise"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="words"
                          />
                        </>
                      )}

                      {mode === 'library' && selected && (
                        <View style={ss.selectedBanner}>
                          <Text style={ss.selectedBannerText}>{selected.name}</Text>
                          <Text style={ss.selectedBannerSub}>
                            Configure for {MUSCLE_LABEL[muscleGroup]}
                          </Text>
                        </View>
                      )}

                      <Text style={ss.fieldLabel}>Sets</Text>
                      <View style={ss.stepperRow}>
                        <Pressable
                          onPress={() => setSets((s) => Math.max(1, s - 1))}
                          style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Minus size={16} color={colors.text} />
                        </Pressable>
                        <Text style={ss.stepperValue}>{sets}</Text>
                        <Pressable
                          onPress={() => setSets((s) => Math.min(10, s + 1))}
                          style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Plus size={16} color={colors.text} />
                        </Pressable>
                      </View>

                      <Text style={ss.fieldLabel}>Warmup sets</Text>
                      <View style={ss.stepperRow}>
                        <Pressable
                          onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                          style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
                        >
                          <Minus size={16} color={colors.text} />
                        </Pressable>
                        <Text style={ss.stepperValue}>{warmupSets}</Text>
                        <Pressable
                          onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                          style={({ pressed }) => [ss.stepperBtn, pressed && { opacity: 0.6 }]}
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

                      <Text style={ss.fieldLabel}>Notes</Text>
                      <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        style={[ss.input, { minHeight: 56 }]}
                        placeholder="Optional cue or instruction"
                        placeholderTextColor={colors.textMuted}
                        multiline
                      />

                      <Text style={ss.fieldLabel}>Type</Text>
                      <View style={ss.segmented}>
                        {(['normal', 'superset', 'drop', 'bodyweight'] as ExerciseType[]).map((t) => (
                          <Pressable
                            key={t}
                            onPress={() => setType(t)}
                            style={({ pressed }) => [
                              ss.segment,
                              type === t && ss.segmentActive,
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Text style={[ss.segmentText, type === t && ss.segmentTextActive]}>
                              {t === 'normal'
                                ? 'Normal'
                                : t === 'superset'
                                ? 'Superset'
                                : t === 'drop'
                                ? 'Drop'
                                : 'Bodyweight'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {/* Superset partner picker */}
                      {type === 'superset' && (
                        <>
                          <View style={ss.partnerHeader}>
                            <Text style={ss.partnerHeaderText}>Pick a superset partner</Text>
                          </View>
                          <PartnerPicker
                            dayExercises={dayExercises}
                            value={partnerValue}
                            onChange={setPartnerValue}
                          />
                          {!canSave && muscleGroup !== null && (
                            <Text style={ss.partnerHint}>
                              Select or create a partner exercise to save.
                            </Text>
                          )}
                        </>
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
                      {mode === 'library' && selected ? `Add "${selected.name}"` : 'Add exercise'}
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

// ─── DraggableRow ─────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 56;

function DraggableRow({
  exercise,
  mg,
  displayIdx,
  totalCount,
  isLastInGroup,
  activeIdx,
  dragTranslation,
  onEdit,
  onDrop,
  onMeasureHeight,
}: {
  exercise: Exercise;
  mg: MuscleGroup;
  displayIdx: number;
  totalCount: number;
  isLastInGroup: boolean;
  activeIdx: SharedValue<number>;
  dragTranslation: SharedValue<number>;
  onEdit: (ex: Exercise) => void;
  onDrop: (from: number, to: number) => void;
  onMeasureHeight?: (h: number) => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const n = totalCount;
    const H = ITEM_HEIGHT;

    if (activeIdx.value === -1) {
      return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, shadowOpacity: 0 };
    }

    if (activeIdx.value === displayIdx) {
      return {
        transform: [{ translateY: dragTranslation.value }, { scale: 1.02 }],
        zIndex: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      };
    }

    const from = activeIdx.value;
    const target = Math.max(0, Math.min(n - 1,
      Math.round((from * H + dragTranslation.value) / H),
    ));

    let shift = 0;
    if (from < target && displayIdx > from && displayIdx <= target) {
      shift = -H;
    } else if (from > target && displayIdx >= target && displayIdx < from) {
      shift = H;
    }

    return {
      transform: [
        { translateY: withSpring(shift, { damping: 22, stiffness: 320 }) },
        { scale: 1 },
      ],
      zIndex: 0,
      shadowOpacity: 0,
    };
  });

  const gesture = Gesture.Exclusive(
    Gesture.Pan()
      .activateAfterLongPress(300)
      .onStart(() => {
        activeIdx.value = displayIdx;
        dragTranslation.value = 0;
        runOnJS(hapticSelect)();
      })
      .onUpdate((e) => {
        if (activeIdx.value === displayIdx) {
          dragTranslation.value = e.translationY;
        }
      })
      .onEnd((e) => {
        if (activeIdx.value === displayIdx) {
          const target = Math.max(0, Math.min(totalCount - 1,
            Math.round((displayIdx * ITEM_HEIGHT + e.translationY) / ITEM_HEIGHT),
          ));
          activeIdx.value = -1;
          dragTranslation.value = 0;
          runOnJS(onDrop)(displayIdx, target);
        }
      })
      .onFinalize(() => {
        if (activeIdx.value === displayIdx) {
          activeIdx.value = -1;
          dragTranslation.value = 0;
        }
      }),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        onEdit(exercise);
      }),
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={onMeasureHeight ? (e) => onMeasureHeight(e.nativeEvent.layout.height) : undefined}
        style={[
          ds.exerciseRow,
          !isLastInGroup && ds.exerciseDivider,
          { backgroundColor: colors.card },
          animStyle,
        ]}
      >
        <View style={[ds.accentBar, { backgroundColor: muscleAccent[mg] ?? colors.primary }]} />
        <View style={{ flex: 1 }}>
          <Text style={ds.exerciseName} numberOfLines={1}>{exercise.name}</Text>
          <Text style={ds.exerciseMeta}>
            {exercise.sets} sets · {exercise.rep_range}
            {exercise.warmup_sets ? ` · ${exercise.warmup_sets}W` : ''}
            {exercise.type === 'superset' ? ' · SS' : ''}
          </Text>
        </View>
        <GripVertical size={16} color={colors.textMuted} strokeWidth={1.5} />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── DraggableExerciseGroup ───────────────────────────────────────────────────

function DraggableExerciseGroup({
  mg,
  exercises,
  onEdit,
}: {
  mg: MuscleGroup;
  exercises: Exercise[];
  onEdit: (ex: Exercise) => void;
}) {
  const [localOrder, setLocalOrder] = useState<number[]>(() => exercises.map((_, i) => i));
  const activeIdx = useSharedValue(-1);
  const dragTranslation = useSharedValue(0);
  const measuredHeight = useRef(ITEM_HEIGHT);

  useEffect(() => {
    setLocalOrder(exercises.map((_, i) => i));
    activeIdx.value = -1;
    dragTranslation.value = 0;
  }, [exercises]);

  const onDrop = useCallback((from: number, to: number) => {
    if (from === to) return;
    hapticSuccess();

    setLocalOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);

      // Reassign sort_orders: new position i gets the sort_order that was at position i
      const originalSortOrders = exercises.map((e) => e.sort_order);
      const updates = next.map((origIdx, newPos) => ({
        id: exercises[origIdx].id,
        sort_order: originalSortOrders[newPos],
      }));
      reorderExercisesInGroup(updates);

      return next;
    });
  }, [exercises]);

  return (
    <View>
      {(localOrder.length === exercises.length ? localOrder : exercises.map((_, i) => i)).map((origIdx, displayIdx) => {
        const ex = exercises[origIdx];
        if (!ex) return null;
        return (
          <DraggableRow
            key={ex.id}
            exercise={ex}
            mg={mg}
            displayIdx={displayIdx}
            totalCount={exercises.length}
            isLastInGroup={displayIdx === exercises.length - 1}
            activeIdx={activeIdx}
            dragTranslation={dragTranslation}
            onEdit={onEdit}
            onDrop={onDrop}
            onMeasureHeight={displayIdx === 0 ? (h) => { measuredHeight.current = h; } : undefined}
          />
        );
      })}
    </View>
  );
}

// ─── DraggableGroupContainer ──────────────────────────────────────────────────

const GROUP_LABEL_HEIGHT = 32;

function DraggableGroupContainer({
  mg,
  exercises,
  displayIdx,
  groupHeights,
  activeGroupIdx,
  groupDragTranslation,
  isFirst,
  onEdit,
  onGroupDrop,
}: {
  mg: MuscleGroup;
  exercises: Exercise[];
  displayIdx: number;
  groupHeights: number[];
  activeGroupIdx: SharedValue<number>;
  groupDragTranslation: SharedValue<number>;
  isFirst: boolean;
  onEdit: (ex: Exercise) => void;
  onGroupDrop: (from: number, to: number) => void;
}) {
  const totalGroups = groupHeights.length;

  const animStyle = useAnimatedStyle(() => {
    if (activeGroupIdx.value === -1) {
      return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, shadowOpacity: 0 };
    }

    const from = activeGroupIdx.value;
    const drag = groupDragTranslation.value;

    if (from === displayIdx) {
      return {
        transform: [{ translateY: drag }, { scale: 1.01 }],
        zIndex: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      };
    }

    // Compute cumulative start positions of each group
    let acc = 0;
    const starts: number[] = [];
    for (let i = 0; i < totalGroups; i++) {
      starts.push(acc);
      acc += groupHeights[i];
    }

    // Center of the dragged group in its current dragged position
    const draggedCenter = starts[from] + groupHeights[from] / 2 + drag;

    // Find which slot the dragged group's center is over
    let target = from;
    for (let i = 0; i < totalGroups; i++) {
      if (draggedCenter >= starts[i] && draggedCenter < starts[i] + groupHeights[i]) {
        target = i;
        break;
      }
    }
    if (draggedCenter < 0) target = 0;
    if (draggedCenter >= acc) target = totalGroups - 1;

    let shift = 0;
    if (from < target && displayIdx > from && displayIdx <= target) {
      shift = -groupHeights[from];
    } else if (from > target && displayIdx >= target && displayIdx < from) {
      shift = groupHeights[from];
    }

    return {
      transform: [
        { translateY: withSpring(shift, { damping: 22, stiffness: 320 }) },
        { scale: 1 },
      ],
      zIndex: 0,
      shadowOpacity: 0,
    };
  });

  const dragHandle = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      activeGroupIdx.value = displayIdx;
      groupDragTranslation.value = 0;
      runOnJS(hapticSelect)();
    })
    .onUpdate((e) => {
      if (activeGroupIdx.value === displayIdx) {
        groupDragTranslation.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (activeGroupIdx.value === displayIdx) {
        // Recompute target on end
        let acc = 0;
        const starts: number[] = [];
        for (let i = 0; i < totalGroups; i++) {
          starts.push(acc);
          acc += groupHeights[i];
        }
        const draggedCenter = starts[displayIdx] + groupHeights[displayIdx] / 2 + e.translationY;
        let target = displayIdx;
        for (let i = 0; i < totalGroups; i++) {
          if (draggedCenter >= starts[i] && draggedCenter < starts[i] + groupHeights[i]) {
            target = i;
            break;
          }
        }
        if (draggedCenter < 0) target = 0;
        if (draggedCenter >= acc) target = totalGroups - 1;

        activeGroupIdx.value = -1;
        groupDragTranslation.value = 0;
        runOnJS(onGroupDrop)(displayIdx, target);
      }
    })
    .onFinalize(() => {
      if (activeGroupIdx.value === displayIdx) {
        activeGroupIdx.value = -1;
        groupDragTranslation.value = 0;
      }
    });

  return (
    <Animated.View style={animStyle}>
      <View style={[ds.muscleLabelRow, isFirst && { marginTop: 4 }]}>
        <GestureDetector gesture={dragHandle}>
          <View style={ds.groupGripArea} hitSlop={8}>
            <GripVertical size={14} color={colors.textMuted} strokeWidth={1.5} />
          </View>
        </GestureDetector>
        <Text style={ds.muscleLabel}>{MUSCLE_LABEL[mg]}</Text>
      </View>
      <DraggableExerciseGroup
        mg={mg}
        exercises={exercises}
        onEdit={onEdit}
      />
    </Animated.View>
  );
}

// ─── DaySection ───────────────────────────────────────────────────────────────

type DaySectionProps = {
  day: Day;
  plan: DayPlan;
  exercises: Exercise[];
  onToggle: (enabled: boolean) => void;
  onFocusBlur: (focus: string) => void;
  onAdd: () => void;
  onEditExercise: (ex: Exercise) => void;
};

function DaySection({
  day,
  plan,
  exercises,
  onToggle,
  onFocusBlur,
  onAdd,
  onEditExercise,
}: DaySectionProps) {
  const [focusText, setFocusText] = useState(plan.focus);
  const enabled = !!plan.enabled;

  useEffect(() => {
    setFocusText(plan.focus);
  }, [plan.focus]);

  const grouped: { mg: MuscleGroup; items: Exercise[] }[] = [];
  const seen = new Map<MuscleGroup, Exercise[]>();
  for (const ex of exercises) {
    const mg = ex.muscle_group;
    if (!seen.has(mg)) {
      const arr: Exercise[] = [];
      seen.set(mg, arr);
      grouped.push({ mg, items: arr });
    }
    seen.get(mg)!.push(ex);
  }

  const [localGroupOrder, setLocalGroupOrder] = useState<number[]>(() => grouped.map((_, i) => i));
  const activeGroupIdx = useSharedValue(-1);
  const groupDragTranslation = useSharedValue(0);

  useEffect(() => {
    setLocalGroupOrder(grouped.map((_, i) => i));
    activeGroupIdx.value = -1;
    groupDragTranslation.value = 0;
  }, [exercises]);

  const groupHeights = grouped.map((g) => GROUP_LABEL_HEIGHT + g.items.length * ITEM_HEIGHT);

  const onGroupDrop = useCallback((from: number, to: number) => {
    if (from === to) return;
    hapticSuccess();

    setLocalGroupOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);

      // Flatten exercises in new group order and reassign sort_orders sequentially
      const flatExercises = next.flatMap((origGroupIdx) => grouped[origGroupIdx].items);
      const updates = flatExercises.map((ex, i) => ({ id: ex.id, sort_order: i }));
      reorderGroupsInDay(updates);

      return next;
    });
  }, [grouped]);

  const orderedGroups = (localGroupOrder.length === grouped.length
    ? localGroupOrder
    : grouped.map((_, i) => i)
  ).map((origIdx) => grouped[origIdx]).filter(Boolean) as { mg: MuscleGroup; items: Exercise[] }[];

  const orderedHeights = (localGroupOrder.length === grouped.length
    ? localGroupOrder
    : grouped.map((_, i) => i)
  ).map((origIdx) => groupHeights[origIdx]);

  return (
    <View style={ds.card}>
      <View style={ds.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[ds.dayName, !enabled && ds.dayNameDisabled]}>{DAY_LABEL[day]}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.card}
        />
      </View>

      <TextInput
        value={focusText}
        onChangeText={setFocusText}
        onBlur={() => onFocusBlur(focusText)}
        editable={enabled}
        placeholder={enabled ? 'e.g. Push day' : '—'}
        placeholderTextColor={colors.textMuted}
        style={[ds.focusInput, !enabled && ds.focusInputDisabled]}
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      {orderedGroups.length > 0 && (
        <View style={ds.exercisesBlock}>
          {orderedGroups.map(({ mg, items }, displayIdx) => (
            <DraggableGroupContainer
              key={mg}
              mg={mg}
              exercises={items}
              displayIdx={displayIdx}
              groupHeights={orderedHeights}
              activeGroupIdx={activeGroupIdx}
              groupDragTranslation={groupDragTranslation}
              isFirst={displayIdx === 0}
              onEdit={onEditExercise}
              onGroupDrop={onGroupDrop}
            />
          ))}
        </View>
      )}

      {enabled && (
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [ds.addBtn, pressed && { opacity: 0.7 }]}
        >
          <Plus size={13} color={colors.primary} strokeWidth={2.5} />
          <Text style={ds.addBtnText}>Add exercise to {DAY_LABEL[day]}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PlanScreen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<Record<Day, DayPlan> | null>(null);
  const [exercises, setExercises] = useState<Record<Day, Exercise[]>>(
    {} as Record<Day, Exercise[]>,
  );
  const [addSheet, setAddSheet] = useState<{ visible: boolean; day: Day }>({
    visible: false,
    day: 'monday',
  });
  const [editSheet, setEditSheet] = useState<{ visible: boolean; exercise: Exercise | null }>({
    visible: false,
    exercise: null,
  });

  const load = useCallback(async () => {
    const [p, exByDay] = await Promise.all([
      getDayPlans(),
      Promise.all(DAYS.map((d) => getExercisesByDay(d))),
    ]);
    setPlans(p);
    const exMap = {} as Record<Day, Exercise[]>;
    DAYS.forEach((d, i) => {
      exMap[d] = exByDay[i];
    });
    setExercises(exMap);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onToggle = async (day: Day, enabled: boolean) => {
    hapticSelect();
    const val = enabled ? 1 : 0;
    setPlans((prev) => (prev ? { ...prev, [day]: { ...prev[day], enabled: val } } : prev));
    await updateDayPlan(day, { enabled: val });
  };

  const onFocusBlur = (day: Day, focus: string) => {
    updateDayPlan(day, { focus: focus.trim() });
  };

  const enabledCount = plans ? DAYS.filter((d) => plans[d].enabled).length : 0;
  const totalExercises = Object.values(exercises).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Training plan</Text>
          <Text style={styles.subtitle}>
            {enabledCount} day{enabledCount === 1 ? '' : 's'} · {totalExercises} exercise
            {totalExercises === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {plans &&
          DAYS.map((day) => (
            <DaySection
              key={day}
              day={day}
              plan={plans[day]}
              exercises={exercises[day] ?? []}
              onToggle={(enabled) => onToggle(day, enabled)}
              onFocusBlur={(focus) => onFocusBlur(day, focus)}
              onAdd={() => setAddSheet({ visible: true, day })}
              onEditExercise={(ex) => setEditSheet({ visible: true, exercise: ex })}
            />
          ))}
      </ScrollView>

      <AddSheet
        visible={addSheet.visible}
        day={addSheet.day}
        onClose={() => setAddSheet((s) => ({ ...s, visible: false }))}
        onCreated={() => load()}
      />

      <EditSheet
        visible={editSheet.visible}
        exercise={editSheet.exercise}
        onClose={() => setEditSheet((s) => ({ ...s, visible: false }))}
        onSaved={() => load()}
        onDeleted={() => load()}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10,
  },
});

const ds = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  dayName: { fontSize: 16, fontWeight: '600', color: colors.text },
  dayNameDisabled: { color: colors.textSecondary },
  focusInput: {
    fontSize: 14,
    color: colors.text,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  focusInputDisabled: {
    color: colors.textMuted,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  exercisesBlock: {
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  muscleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 4,
    gap: 6,
  },
  groupGripArea: {
    padding: 2,
  },
  muscleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 14,
    gap: 10,
  },
  exerciseDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accentBar: { width: 3, height: 32, borderRadius: 2, flexShrink: 0 },
  exerciseName: { fontSize: 14, fontWeight: '500', color: colors.text },
  exerciseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addBtnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
});

const ss = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: 18, color: colors.text },

  fieldLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },

  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  deleteDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 20,
    marginBottom: 12,
  },
  deleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.red + '40',
    backgroundColor: colors.red + '12',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: colors.red },
  deleteBtnSub: { fontSize: 11, color: colors.red + 'AA', marginTop: 2 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  modeBtnTextActive: { color: '#FFFFFF', fontWeight: '600' },

  listContainer: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  libraryRowSelected: { backgroundColor: colors.primary + '18' },
  libraryRowName: { fontSize: 14, color: colors.text, fontWeight: '500' },
  libraryRowNameSelected: { color: colors.primary, fontWeight: '600' },
  libraryRowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 18,
  },

  selectedBanner: {
    backgroundColor: colors.primary + '18',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '40',
  },
  selectedBannerText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  selectedBannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Superset partner section
  partnerHeader: {
    marginTop: 16,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  partnerBadge: {
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '50',
  },
  partnerBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  partnerHint: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 8,
    textAlign: 'center',
  },
});
