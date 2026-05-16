import { Minus, Plus, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { createExercise, findExercisesByName, getLibraryExercises } from '../db/queries';
import { colors, muscleAccent } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import {
  MUSCLE_LABEL,
  type Day,
  type ExerciseType,
  type LibraryExercise,
  type MuscleGroup,
} from '../types';
import { hapticSuccess } from '../utils/haptics';

type Props = {
  visible: boolean;
  day: Day;
  /**
   * Pre-selects the muscle filter chip so the list narrows to a section the
   * user was browsing — they can still tap "All" to broaden. Optional.
   */
  initialMuscleGroup?: MuscleGroup | null;
  onClose: () => void;
  onCreated: (newId: number) => void | Promise<void>;
};

type Mode = 'library' | 'new';

const ALL_MUSCLE_GROUPS: MuscleGroup[] = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

export function AddExerciseSheet({
  visible,
  day,
  initialMuscleGroup,
  onClose,
  onCreated,
}: Props) {
  const [mode, setMode] = useState<Mode>('library');
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | null>(
    initialMuscleGroup ?? null,
  );
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);

  // For "new" mode the user picks muscle group explicitly. For "library" mode
  // we read it off the selection. Tracking both as `pickedGroup` keeps the
  // save path uniform.
  const [pickedGroup, setPickedGroup] = useState<MuscleGroup | null>(null);
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [warmupSets, setWarmupSets] = useState(0);
  const [repRange, setRepRange] = useState('8–12');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<ExerciseType>('normal');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      getLibraryExercises().then(setLibrary);
      setFilterGroup(initialMuscleGroup ?? null);
    }
  }, [visible, initialMuscleGroup]);

  const reset = () => {
    setMode('library');
    setSearch('');
    setFilterGroup(initialMuscleGroup ?? null);
    setSelected(null);
    setPickedGroup(null);
    setName('');
    setSets(3);
    setWarmupSets(0);
    setRepRange('8–12');
    setNotes('');
    setType('normal');
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const selectFromLibrary = (ex: LibraryExercise) => {
    setSelected(ex);
    setPickedGroup(ex.muscle_group);
    setType('normal');
    setSets(3);
    setWarmupSets(0);
    setRepRange('8–12');
    setNotes(ex.notes ?? '');
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    setPickedGroup(m === 'new' ? (initialMuscleGroup ?? null) : null);
    setSearch('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.filter((e) => {
      if (filterGroup && e.muscle_group !== filterGroup) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [library, filterGroup, search]);

  const canSave =
    pickedGroup !== null &&
    (mode === 'library' ? selected !== null : name.trim().length > 0);

  const doCreate = async (trimmed: string) => {
    if (!pickedGroup) return;
    setBusy(true);
    try {
      const newId = await createExercise({
        day,
        muscle_group: pickedGroup,
        name: trimmed,
        sets,
        warmup_sets: warmupSets,
        rep_range: repRange.trim() || '8–12',
        notes: notes.trim() ? notes.trim() : null,
        type,
      });
      hapticSuccess();
      reset();
      await onCreated(newId);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    const trimmed = (mode === 'library' ? selected?.name ?? '' : name).trim();
    if (!trimmed || busy || !pickedGroup) return;

    if (mode === 'new') {
      setBusy(true);
      const existing = await findExercisesByName(trimmed);
      setBusy(false);
      if (existing.length > 0) {
        Alert.alert(
          'Name already in use',
          `"${trimmed}" already exists in the library. Adding it will use the existing entry. Add anyway?`,
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

  const showConfig = mode === 'new' || (mode === 'library' && selected !== null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Add exercise</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              {(['library', 'new'] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                    {m === 'library' ? 'From library' : 'New exercise'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {/* Library mode */}
              {mode === 'library' && (
                <>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    style={[styles.input, { marginBottom: 10 }]}
                    placeholder="Search exercises…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Chip
                      label="All"
                      active={filterGroup === null}
                      onPress={() => setFilterGroup(null)}
                    />
                    {ALL_MUSCLE_GROUPS.map((mg) => (
                      <Chip
                        key={mg}
                        label={MUSCLE_LABEL[mg]}
                        accent={muscleAccent[mg] ?? colors.primary}
                        active={filterGroup === mg}
                        onPress={() =>
                          setFilterGroup((cur) => (cur === mg ? null : mg))
                        }
                      />
                    ))}
                  </ScrollView>

                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>No exercises found</Text>
                  ) : (
                    <View style={styles.listContainer}>
                      {filtered.map((ex) => {
                        const isSelected = selected?.id === ex.id;
                        const accent = muscleAccent[ex.muscle_group] ?? colors.primary;
                        return (
                          <Pressable
                            key={ex.id}
                            onPress={() => selectFromLibrary(ex)}
                            style={({ pressed }) => [
                              styles.libraryRow,
                              isSelected && styles.libraryRowSelected,
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <View style={[styles.accentBar, { backgroundColor: accent }]} />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.libraryRowName,
                                  isSelected && styles.libraryRowNameSelected,
                                ]}
                              >
                                {ex.name}
                              </Text>
                              <Text style={styles.libraryRowMeta}>
                                {MUSCLE_LABEL[ex.muscle_group]}
                              </Text>
                            </View>
                            {isSelected && (
                              <View style={styles.checkBadge}>
                                <Text style={styles.checkText}>✓</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* New mode — explicit muscle group picker */}
              {mode === 'new' && (
                <>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    placeholder="e.g. Lateral raise"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoFocus
                  />
                  <Text style={styles.fieldLabel}>Muscle group</Text>
                  <View style={styles.pillRow}>
                    {ALL_MUSCLE_GROUPS.map((mg) => {
                      const active = pickedGroup === mg;
                      const accent = muscleAccent[mg] ?? colors.primary;
                      return (
                        <Pressable
                          key={mg}
                          onPress={() => setPickedGroup(active ? null : mg)}
                          style={({ pressed }) => [
                            styles.pill,
                            active && {
                              backgroundColor: accent + '28',
                              borderColor: accent,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              active && { color: accent, fontWeight: '600' },
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

              {/* Shared config fields */}
              {showConfig && (
                <>
                  {mode === 'library' && selected && pickedGroup && (
                    <View style={styles.selectedBanner}>
                      <Text style={styles.selectedBannerText}>{selected.name}</Text>
                      <Text style={styles.selectedBannerSub}>
                        Adding to {MUSCLE_LABEL[pickedGroup]}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Sets</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setSets((s) => Math.max(1, s - 1))}
                      style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Minus size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{sets}</Text>
                    <Pressable
                      onPress={() => setSets((s) => Math.min(10, s + 1))}
                      style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Plus size={16} color={colors.text} />
                    </Pressable>
                  </View>

                  <Text style={styles.fieldLabel}>Warmup sets</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                      style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Minus size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{warmupSets}</Text>
                    <Pressable
                      onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                      style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Plus size={16} color={colors.text} />
                    </Pressable>
                  </View>

                  <Text style={styles.fieldLabel}>Rep range</Text>
                  <TextInput
                    value={repRange}
                    onChangeText={setRepRange}
                    style={styles.input}
                    placeholder="e.g. 8–12"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    style={[styles.input, { minHeight: 56 }]}
                    placeholder="Optional cue or instruction"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />

                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.segmented}>
                    {(['normal', 'drop', 'superset', 'bodyweight'] as ExerciseType[]).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setType(t)}
                        style={({ pressed }) => [
                          styles.segment,
                          type === t && styles.segmentActive,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>
                          {t === 'normal' ? 'Normal' : t === 'drop' ? 'Drop' : t === 'superset' ? 'Superset' : 'Bodyweight'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Pressable
                onPress={onSave}
                disabled={busy || !canSave}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (busy || !canSave) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {mode === 'library' && selected ? `Add "${selected.name}"` : 'Add exercise'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
  accent,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}) {
  const tint = accent ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: tint + '28', borderColor: tint },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, active && { color: tint, fontWeight: '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
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

  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
    paddingRight: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

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
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  libraryRowSelected: { backgroundColor: colors.primary + '18' },
  accentBar: {
    width: 3,
    height: 28,
    borderRadius: radius.accent,
  },
  libraryRowName: { fontSize: 15, color: colors.text, fontWeight: '500' },
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
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },

  selectedBanner: {
    backgroundColor: colors.primary + '18',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '40',
  },
  selectedBannerText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  selectedBannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

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
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
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
  segmentText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },

  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
