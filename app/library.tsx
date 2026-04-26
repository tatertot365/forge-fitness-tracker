import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Minus, Plus, Search, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { SectionLabel } from '../src/components/SectionLabel';
import {
  createExercise,
  deleteExercise,
  deleteExercisesByName,
  getAllExercises,
  getDayPlans,
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
import { hapticSuccess, hapticTap } from '../src/utils/haptics';

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'shoulders', 'triceps',
  'back-width', 'back-thickness', 'biceps', 'grip',
  'quads', 'hamstrings-glutes', 'calves', 'core',
];

export default function LibraryScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [dayPlans, setDayPlans] = useState<Record<Day, DayPlan> | null>(null);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Exercise | null>(null);

  const load = useCallback(async () => {
    const [ex, plans] = await Promise.all([getAllExercises(), getDayPlans()]);
    setExercises(ex);
    setDayPlans(plans);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const searchTrimmed = search.trim().toLowerCase();
  const filtered = searchTrimmed
    ? exercises.filter((e) => e.name.toLowerCase().includes(searchTrimmed))
    : exercises;

  const grouped = DAYS.map((day) => {
    const dayEx = filtered.filter((e) => e.day === day);
    const groups = [...new Set(dayEx.map((e) => e.muscle_group))] as MuscleGroup[];
    return {
      day,
      focus: dayPlans?.[day]?.focus ?? DAY_LABEL[day],
      muscles: groups.map((g) => ({
        group: g,
        exercises: dayEx.filter((e) => e.muscle_group === g),
      })),
    };
  }).filter((d) => d.muscles.length > 0);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Exercise library</Text>
          <Text style={styles.subtitle}>
            {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Plus size={22} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Search size={14} color={colors.textMuted} strokeWidth={2} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholder="Search exercises…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {grouped.length === 0 ? (
          <Text style={styles.emptyText}>
            {searchTrimmed
              ? 'No exercises match your search.'
              : 'No exercises yet — tap + to add one.'}
          </Text>
        ) : (
          grouped.map(({ day, focus, muscles }) => (
            <View key={day}>
              <SectionLabel>{`${DAY_LABEL[day]} — ${focus.toLowerCase()}`}</SectionLabel>
              {muscles.map(({ group, exercises: exs }) => (
                <View key={group} style={styles.muscleBlock}>
                  <Text style={styles.muscleLabel}>{MUSCLE_LABEL[group]}</Text>
                  <Card padded={false}>
                    {exs.map((ex, idx) => (
                      <View
                        key={ex.id}
                        style={idx < exs.length - 1 && styles.rowDivider}
                      >
                        <Pressable
                          onPress={() => setEditTarget(ex)}
                          style={({ pressed }) => [
                            styles.exRow,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <View
                            style={[
                              styles.accent,
                              { backgroundColor: muscleAccent[ex.muscle_group] ?? colors.primary },
                            ]}
                          />
                          <View style={styles.exInfo}>
                            <Text style={styles.exName} numberOfLines={1}>
                              {ex.name}
                            </Text>
                            <Text style={styles.exMeta}>
                              {ex.sets} sets
                              {ex.warmup_sets > 0 ? ` · ${ex.warmup_sets}W` : ''}
                              {' · '}{ex.rep_range}
                              {ex.type !== 'normal' ? ` · ${ex.type}` : ''}
                            </Text>
                          </View>
                          <Text style={styles.exChevron}>›</Text>
                        </Pressable>
                      </View>
                    ))}
                  </Card>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <LibraryAddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={async () => {
          setAddOpen(false);
          hapticSuccess();
          await load();
        }}
      />

      {editTarget ? (
        <LibraryEditSheet
          key={editTarget.id}
          visible
          exercise={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await load();
          }}
          onDeleted={async () => {
            setEditTarget(null);
            await load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── Add sheet ─────────────────────────────────────────────────────────────────

function LibraryAddSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [warmupSets, setWarmupSets] = useState(0);
  const [repRange, setRepRange] = useState('8–12');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<ExerciseType>('normal');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setSelectedDay(null);
    setSelectedGroup(null);
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

  const canSave =
    selectedDay !== null &&
    selectedGroup !== null &&
    name.trim().length > 0;

  const onSave = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      await createExercise({
        day: selectedDay!,
        muscle_group: selectedGroup!,
        name: name.trim(),
        sets,
        warmup_sets: warmupSets,
        rep_range: repRange.trim() || '8–12',
        notes: notes.trim() || null,
        accent_color: muscleAccent[selectedGroup!] ?? colors.primary,
        type,
      });
      reset();
      await onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={sheet.backdrop}>
        <Pressable style={sheet.dismiss} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={sheet.container}>
            <View style={sheet.handle} />
            <View style={sheet.header}>
              <Text style={sheet.title}>Add exercise</Text>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={sheet.cancelText}>Cancel</Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 28 }}
            >
              <Text style={sheet.fieldLabel}>Day</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheet.pillRow}>
                {DAYS.map((d) => {
                  const active = selectedDay === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setSelectedDay(d)}
                      style={[sheet.pill, active && sheet.pillActive]}
                    >
                      <Text style={[sheet.pillText, active && sheet.pillTextActive]}>
                        {DAY_LABEL[d].slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={sheet.fieldLabel}>Muscle group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheet.pillRow}>
                {ALL_MUSCLE_GROUPS.map((g) => {
                  const active = selectedGroup === g;
                  const accent = muscleAccent[g] ?? colors.primary;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setSelectedGroup(g)}
                      style={[
                        sheet.pill,
                        active && { backgroundColor: accent, borderColor: accent },
                      ]}
                    >
                      <Text style={[sheet.pillText, active && sheet.pillTextActive]}>
                        {MUSCLE_LABEL[g]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={sheet.fieldLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={sheet.input}
                placeholder="e.g. Incline dumbbell press"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={sheet.fieldLabel}>Sets</Text>
              <View style={sheet.stepperRow}>
                <Pressable
                  onPress={() => setSets((s) => Math.max(1, s - 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={sheet.stepperValue}>{sets}</Text>
                <Pressable
                  onPress={() => setSets((s) => Math.min(10, s + 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
              </View>

              <Text style={sheet.fieldLabel}>Warmup sets</Text>
              <View style={sheet.stepperRow}>
                <Pressable
                  onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={sheet.stepperValue}>{warmupSets}</Text>
                <Pressable
                  onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
              </View>

              <Text style={sheet.fieldLabel}>Rep range</Text>
              <TextInput
                value={repRange}
                onChangeText={setRepRange}
                style={sheet.input}
                placeholder="e.g. 8–12"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={sheet.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                style={[sheet.input, { minHeight: 56 }]}
                placeholder="Optional cue or instruction"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={sheet.fieldLabel}>Type</Text>
              <View style={sheet.segmented}>
                {(['normal', 'drop', 'superset', 'bodyweight'] as ExerciseType[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={({ pressed }) => [
                      sheet.segment,
                      type === t && sheet.segmentActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[sheet.segmentText, type === t && sheet.segmentTextActive]}>
                      {t === 'normal' ? 'Normal' : t === 'drop' ? 'Drop' : t === 'superset' ? 'Superset' : 'BW'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={onSave}
                disabled={busy || !canSave}
                style={({ pressed }) => [
                  sheet.saveBtn,
                  (!canSave || busy) && { opacity: 0.4 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={sheet.saveBtnText}>Add exercise</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Edit sheet ────────────────────────────────────────────────────────────────

function LibraryEditSheet({
  visible,
  exercise,
  onClose,
  onSaved,
  onDeleted,
}: {
  visible: boolean;
  exercise: Exercise;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets);
  const [warmupSets, setWarmupSets] = useState(exercise.warmup_sets);
  const [repRange, setRepRange] = useState(exercise.rep_range);
  const [notes, setNotes] = useState(exercise.notes ?? '');
  const [type, setType] = useState<ExerciseType>(exercise.type);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await updateExercise(exercise.id, {
        name: trimmed,
        sets,
        warmup_sets: warmupSets,
        rep_range: repRange.trim() || exercise.rep_range,
        notes: notes.trim() || null,
        type,
      });
      hapticSuccess();
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  const onDeleteOne = () => {
    Alert.alert(
      `Delete from ${DAY_LABEL[exercise.day]}`,
      `Remove "${exercise.name}" from ${DAY_LABEL[exercise.day]} only? All logged sets for this instance will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteExercise(exercise.id);
              hapticSuccess();
              await onDeleted();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete from all days',
      `Permanently remove every instance of "${exercise.name}" across all days? All logged sets will be deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteExercisesByName(exercise.name);
              hapticSuccess();
              await onDeleted();
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
      <View style={sheet.backdrop}>
        <Pressable style={sheet.dismiss} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={sheet.container}>
            <View style={sheet.handle} />
            <View style={sheet.header}>
              <Text style={sheet.title}>Edit exercise</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={sheet.cancelText}>Cancel</Text>
              </Pressable>
            </View>

            <View style={sheet.editMeta}>
              <View
                style={[
                  sheet.editAccent,
                  { backgroundColor: muscleAccent[exercise.muscle_group] ?? colors.primary },
                ]}
              />
              <Text style={sheet.editMetaText}>
                {DAY_LABEL[exercise.day]} · {MUSCLE_LABEL[exercise.muscle_group]}
              </Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 28 }}
            >
              <Text style={sheet.fieldLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={sheet.input}
                placeholder="Exercise name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={sheet.fieldLabel}>Sets</Text>
              <View style={sheet.stepperRow}>
                <Pressable
                  onPress={() => setSets((s) => Math.max(1, s - 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={sheet.stepperValue}>{sets}</Text>
                <Pressable
                  onPress={() => setSets((s) => Math.min(10, s + 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
              </View>

              <Text style={sheet.fieldLabel}>Warmup sets</Text>
              <View style={sheet.stepperRow}>
                <Pressable
                  onPress={() => setWarmupSets((s) => Math.max(0, s - 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Minus size={16} color={colors.text} />
                </Pressable>
                <Text style={sheet.stepperValue}>{warmupSets}</Text>
                <Pressable
                  onPress={() => setWarmupSets((s) => Math.min(5, s + 1))}
                  style={({ pressed }) => [sheet.stepperBtn, pressed && { opacity: 0.6 }]}
                >
                  <Plus size={16} color={colors.text} />
                </Pressable>
              </View>

              <Text style={sheet.fieldLabel}>Rep range</Text>
              <TextInput
                value={repRange}
                onChangeText={setRepRange}
                style={sheet.input}
                placeholder="e.g. 8–12"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={sheet.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                style={[sheet.input, { minHeight: 56 }]}
                placeholder="Optional cue or instruction"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={sheet.fieldLabel}>Type</Text>
              <View style={sheet.segmented}>
                {(['normal', 'drop', 'superset', 'bodyweight'] as ExerciseType[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={({ pressed }) => [
                      sheet.segment,
                      type === t && sheet.segmentActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[sheet.segmentText, type === t && sheet.segmentTextActive]}>
                      {t === 'normal' ? 'Normal' : t === 'drop' ? 'Drop' : t === 'superset' ? 'Superset' : 'BW'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={onSave}
                disabled={busy || !name.trim()}
                style={({ pressed }) => [
                  sheet.saveBtn,
                  (busy || !name.trim()) && { opacity: 0.4 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={sheet.saveBtnText}>Save changes</Text>
              </Pressable>

              <View style={sheet.deleteGroup}>
                <Pressable
                  onPress={onDeleteOne}
                  disabled={busy}
                  style={({ pressed }) => [sheet.deleteRow, pressed && { opacity: 0.7 }]}
                >
                  <Trash2 size={14} color={colors.red} strokeWidth={2} />
                  <Text style={sheet.deleteRowText}>Delete from {DAY_LABEL[exercise.day]}</Text>
                </Pressable>
                <Pressable
                  onPress={onDeleteAll}
                  disabled={busy}
                  style={({ pressed }) => [sheet.deleteRow, pressed && { opacity: 0.7 }]}
                >
                  <Trash2 size={14} color={colors.red} strokeWidth={2} />
                  <Text style={sheet.deleteRowText}>Delete from all days</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },

  muscleBlock: { marginBottom: 10 },
  muscleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    marginLeft: 4,
  },

  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 14,
  },
  accent: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginHorizontal: 12,
  },
  exInfo: { flex: 1, gap: 3 },
  exName: { ...typography.exerciseName, color: colors.text },
  exMeta: { ...typography.caption, color: colors.textSecondary },
  exChevron: {
    fontSize: 18,
    color: colors.textMuted,
    marginLeft: 8,
    marginRight: 2,
  },
});

const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismiss: { flex: 1 },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  cancelText: { fontSize: 14, color: colors.primary, fontWeight: '600' },

  editMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  editAccent: { width: 3, height: 16, borderRadius: 2 },
  editMetaText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

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

  pillRow: {
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '600' },

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

  deleteGroup: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  deleteRowText: { color: colors.red, fontSize: 14, fontWeight: '600' },
});
