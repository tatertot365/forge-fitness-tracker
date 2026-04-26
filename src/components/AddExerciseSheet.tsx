import { Minus, Plus, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
import { createExercise, findExercisesByName, getAllUniqueExercises } from '../db/queries';
import { colors, muscleAccent } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import {
  DAY_LABEL,
  MUSCLE_LABEL,
  type Day,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
} from '../types';
import { hapticSuccess } from '../utils/haptics';

type Props = {
  visible: boolean;
  day: Day;
  muscleGroup: MuscleGroup;
  onClose: () => void;
  onCreated: (newId: number) => void | Promise<void>;
};

type Mode = 'library' | 'new';

export function AddExerciseSheet({ visible, day, muscleGroup, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('library');
  const [search, setSearch] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);

  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [repRange, setRepRange] = useState('8–12');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<ExerciseType>('normal');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      getAllUniqueExercises().then(setAllExercises);
    }
  }, [visible]);

  const reset = () => {
    setMode('library');
    setSearch('');
    setSelected(null);
    setName('');
    setSets(3);
    setRepRange('8–12');
    setNotes('');
    setType('normal');
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const selectFromLibrary = (ex: Exercise) => {
    setSelected(ex);
    setName(ex.name);
    setType(ex.type === 'superset' ? 'normal' : (ex.type as ExerciseType));
    setSets(ex.sets ?? 3);
    setRepRange(ex.rep_range ?? '8–12');
    setNotes('');
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    setSearch('');
    if (m === 'new') {
      setName('');
      setSets(3);
      setRepRange('8–12');
      setNotes('');
      setType('normal');
    }
  };

  const filtered = search.trim()
    ? allExercises.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allExercises;

  const canSave = mode === 'library' ? selected !== null : name.trim().length > 0;

  const doCreate = async (trimmed: string) => {
    setBusy(true);
    try {
      const newId = await createExercise({
        day,
        muscle_group: muscleGroup,
        name: trimmed,
        sets,
        rep_range: repRange.trim() || '8–12',
        notes: notes.trim() ? notes.trim() : null,
        accent_color: muscleAccent[muscleGroup] ?? colors.primary,
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
    if (!trimmed || busy) return;

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

  const showConfig = mode === 'new' || (mode === 'library' && selected !== null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Add to {MUSCLE_LABEL[muscleGroup]}</Text>
              <Pressable onPress={close} hitSlop={10}>
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
                    style={[styles.input, { marginBottom: 8 }]}
                    placeholder="Search exercises…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                  />

                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>No exercises found</Text>
                  ) : (
                    <View style={styles.listContainer}>
                      {filtered.map((ex) => {
                        const isSelected = selected?.id === ex.id;
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
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.libraryRowName, isSelected && styles.libraryRowNameSelected]}>
                                {ex.name}
                              </Text>
                              <Text style={styles.libraryRowMeta}>
                                {DAY_LABEL[ex.day]} · {ex.sets} sets · {ex.rep_range}
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

              {/* Shared config fields (new mode, or after library selection) */}
              {showConfig && (
                <>
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
                        autoFocus={mode === 'new'}
                      />
                    </>
                  )}

                  {mode === 'library' && selected && (
                    <View style={styles.selectedBanner}>
                      <Text style={styles.selectedBannerText}>{selected.name}</Text>
                      <Text style={styles.selectedBannerSub}>Configure for {MUSCLE_LABEL[muscleGroup]}</Text>
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
  },
  libraryRowSelected: { backgroundColor: colors.primary + '18' },
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
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + '40',
  },
  selectedBannerText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  selectedBannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

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
