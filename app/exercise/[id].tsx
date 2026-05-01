import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Copy,
  Minus,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../src/components/Card";
import { HistorySheet } from "../../src/components/HistorySheet";
import { HistorySparkline } from "../../src/components/HistorySparkline";
import { RestTimer } from "../../src/components/RestTimer";
import { SectionLabel } from "../../src/components/SectionLabel";
import { SetCheckButton } from "../../src/components/SetCheckButton";
import {
  bestSet,
  deleteExercise,
  deleteSetLog,
  duplicateExercise,
  getExercise,
  getExerciseSessionHistory,
  getExercisesByDay,
  getLastCompletedSetsForExercise,
  getOrCreateSession,
  getSetLogsForSessionExercise,
  linkSuperset,
  unlinkSuperset,
  updateExercise,
  upsertSetLog,
  type ExerciseSessionHistory,
} from "../../src/db/queries";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import {
  MUSCLE_LABEL,
  type Exercise,
  type ExerciseType,
  type SetLog,
} from "../../src/types";
import { dayOfWeek, todayISO } from "../../src/utils/date";
import { hapticTap, hapticSuccess } from "../../src/utils/haptics";

type Row = {
  setNumber: number;
  weight: string;
  reps: string;
  dropWeight: string;
  dropReps: string;
  completed: boolean;
};

type WarmupRow = {
  setNumber: number; // negative: -1 = W1, -2 = W2, etc.
  weight: string;
  reps: string;
};

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    sessionId?: string;
    date?: string;
  }>();
  const exerciseId = Number(params.id);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [partner, setPartner] = useState<Exercise | null>(null);
  const [dayExercises, setDayExercises] = useState<Exercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [warmupRows, setWarmupRows] = useState<WarmupRow[]>([]);
  const [beatThis, setBeatThis] = useState<string | null>(null);
  const [history, setHistory] = useState<ExerciseSessionHistory[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restKey, setRestKey] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!exerciseId || Number.isNaN(exerciseId)) return;
    const ex = await getExercise(exerciseId);
    if (!ex) return;

    const sid = params.sessionId
      ? Number(params.sessionId)
      : params.date
        ? await getOrCreateSession(ex.day, params.date)
        : await getOrCreateSession(dayOfWeek(), todayISO());

    const [currentLogs, lastLogs, siblings, maybePartner, hist] =
      await Promise.all([
        getSetLogsForSessionExercise(sid, exerciseId),
        getLastCompletedSetsForExercise(exerciseId, sid),
        getExercisesByDay(ex.day),
        ex.superset_partner_id
          ? getExercise(ex.superset_partner_id)
          : Promise.resolve(null),
        getExerciseSessionHistory(exerciseId, 10),
      ]);

    const lastBySetNumber = new Map<number, SetLog>();
    for (const l of lastLogs) lastBySetNumber.set(l.set_number, l);

    const isBW = ex.type === "bodyweight";
    const best = bestSet(lastLogs, isBW);
    setBeatThis(
      isBW
        ? best && best.reps != null
          ? `${best.reps} reps`
          : null
        : best && best.weight_lb != null && best.reps != null
          ? `${best.weight_lb} lb × ${best.reps}`
          : null,
    );

    // Split warmup (negative set_number) from working logs
    const warmupLogs = currentLogs
      .filter((l) => l.set_number < 0)
      .sort((a, b) => b.set_number - a.set_number); // -1 first (W1), -2 second (W2)…
    const workingLogs = currentLogs.filter((l) => l.set_number > 0);

    if (warmupLogs.length > 0) {
      setWarmupRows(
        warmupLogs.map((l) => ({
          setNumber: l.set_number,
          weight: l.weight_lb != null ? String(l.weight_lb) : "",
          reps: l.reps != null ? String(l.reps) : "",
        })),
      );
    } else if (ex.warmup_sets > 0) {
      // Auto-seed rows from the exercise default — not saved to DB until the user types
      setWarmupRows(
        Array.from({ length: ex.warmup_sets }, (_, i) => ({
          setNumber: -(i + 1),
          weight: "",
          reps: "",
        })),
      );
    } else {
      setWarmupRows([]);
    }

    const currentBySet = new Map<number, SetLog>();
    for (const l of workingLogs) currentBySet.set(l.set_number, l);

    const nextRows: Row[] = [];
    for (let i = 1; i <= ex.sets; i++) {
      const current = currentBySet.get(i);
      const prior = lastBySetNumber.get(i);
      nextRows.push({
        setNumber: i,
        weight:
          current?.weight_lb != null
            ? String(current.weight_lb)
            : prior?.weight_lb != null
              ? String(prior.weight_lb)
              : "",
        reps: current?.reps != null ? String(current.reps) : "",
        dropWeight:
          current?.drop_weight_lb != null
            ? String(current.drop_weight_lb)
            : prior?.drop_weight_lb != null
              ? String(prior.drop_weight_lb)
              : "",
        dropReps: current?.drop_reps != null ? String(current.drop_reps) : "",
        completed: !!current?.completed,
      });
    }

    setExercise(ex);
    setPartner(maybePartner ?? null);
    setDayExercises(siblings);
    setSessionId(sid);
    setRows(nextRows);
    setHistory(hist);
  }, [exerciseId, params.sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const rowToPatch = (r: Row, isDrop: boolean) => {
    const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
    const weight = toNum(r.weight);
    const reps = toNum(r.reps);
    const dropWeight = toNum(r.dropWeight);
    const dropReps = toNum(r.dropReps);
    return {
      weight_lb: Number.isFinite(weight as number) ? weight : null,
      reps: Number.isFinite(reps as number) ? reps : null,
      drop_weight_lb:
        isDrop && Number.isFinite(dropWeight as number) ? dropWeight : null,
      drop_reps:
        isDrop && Number.isFinite(dropReps as number) ? dropReps : null,
      completed: (r.completed ? 1 : 0) as 0 | 1,
    };
  };

  const persist = async (idx: number) => {
    if (!sessionId || !exercise) return;
    const r = rows[idx];
    await upsertSetLog(
      sessionId,
      exercise.id,
      r.setNumber,
      rowToPatch(r, exercise.type === "drop"),
    );
  };

  // Debounced persist: saves typed values without waiting for blur, so a tab
  // switch / phone call / app kill mid-input doesn't lose the entry.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const warmupRowsRef = useRef(warmupRows);
  warmupRowsRef.current = warmupRows;
  const ctxRef = useRef({ sessionId, exercise });
  ctxRef.current = { sessionId, exercise };

  const persistTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const flushRowNow = (idx: number) => {
    const { sessionId: sid, exercise: ex } = ctxRef.current;
    if (!sid || !ex) return;
    const r = rowsRef.current[idx];
    if (!r) return;
    upsertSetLog(sid, ex.id, r.setNumber, rowToPatch(r, ex.type === "drop"));
  };

  const flushWarmupNow = (idx: number) => {
    const { sessionId: sid, exercise: ex } = ctxRef.current;
    if (!sid || !ex) return;
    const r = warmupRowsRef.current[idx];
    if (!r) return;
    const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
    upsertSetLog(sid, ex.id, r.setNumber, {
      weight_lb: toNum(r.weight),
      reps: toNum(r.reps),
      completed: 0,
    });
  };

  const schedulePersistRow = (idx: number) => {
    const key = `r:${idx}`;
    const timers = persistTimers.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        flushRowNow(idx);
      }, 400),
    );
  };

  const schedulePersistWarmup = (idx: number) => {
    const key = `w:${idx}`;
    const timers = persistTimers.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        flushWarmupNow(idx);
      }, 400),
    );
  };

  // On unmount, immediately flush every pending row so navigating away mid-edit
  // never loses the in-flight value.
  useEffect(() => {
    const timers = persistTimers.current;
    return () => {
      timers.forEach((t, key) => {
        clearTimeout(t);
        const [kind, idxStr] = key.split(":");
        const idx = Number(idxStr);
        if (kind === "r") flushRowNow(idx);
        else if (kind === "w") flushWarmupNow(idx);
      });
      timers.clear();
    };
  }, []);

  const updateWarmupRow = (idx: number, patch: Partial<WarmupRow>) => {
    setWarmupRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const persistWarmup = async (idx: number) => {
    if (!sessionId || !exercise) return;
    const r = warmupRows[idx];
    const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
    await upsertSetLog(sessionId, exercise.id, r.setNumber, {
      weight_lb: toNum(r.weight),
      reps: toNum(r.reps),
      completed: 0,
    });
  };

  const addWarmupRow = () => {
    const minNum =
      warmupRows.length > 0
        ? Math.min(...warmupRows.map((r) => r.setNumber))
        : 0;
    setWarmupRows((prev) => [
      ...prev,
      { setNumber: minNum - 1, weight: "", reps: "" },
    ]);
  };

  const removeWarmupRow = async (idx: number) => {
    const r = warmupRows[idx];
    if (sessionId && exercise) {
      await deleteSetLog(sessionId, exercise.id, r.setNumber);
    }
    setWarmupRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleComplete = async (idx: number) => {
    const next = !rows[idx].completed;
    updateRow(idx, { completed: next });
    const isLastWorkingSet = idx === rows.length - 1;
    if (next && !isLastWorkingSet) {
      hapticTap();
      setRestKey((k) => (k ?? 0) + 1);
    } else if (next) {
      hapticTap();
    }
    if (!sessionId || !exercise) return;
    const r = { ...rows[idx], completed: next };
    await upsertSetLog(
      sessionId,
      exercise.id,
      r.setNumber,
      rowToPatch(r, exercise.type === "drop"),
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {exercise?.name ?? "Exercise"}
          </Text>
          <Text style={styles.subtitle}>
            {exercise
              ? `${exercise.sets} sets · ${exercise.rep_range}${
                  exercise.type === "drop" ? " · Drop set" : ""
                }${exercise.type === "superset" ? " · Superset" : ""}${
                  exercise.type === "bodyweight" ? " · Bodyweight" : ""
                }`
              : ""}
          </Text>
        </View>
        {exercise ? (
          <Pressable
            onPress={() => setEditOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Pencil size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setHistoryOpen(true)}
            style={({ pressed }) => pressed && { opacity: 0.85 }}
          >
            <Card style={styles.beatCard}>
              <View style={styles.beatIconWrap}>
                <TrendingUp size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.beatLabel}>Beat this</Text>
                <Text style={styles.beatValue}>
                  {beatThis ?? "No previous data"}
                </Text>
                {history.length > 0 ? (
                  <Text style={styles.beatCta}>Tap to see history →</Text>
                ) : null}
              </View>
              <HistorySparkline
                data={history
                  .slice(0, 8)
                  .map((h) => ({
                    date: h.date,
                    score:
                      exercise?.type === "bodyweight"
                        ? h.best_reps
                        : (h.best_weight_lb ?? 0) * h.best_reps,
                  }))
                  .reverse()}
              />
            </Card>
          </Pressable>

          {exercise?.type === "superset" && partner ? (
            <Pressable
              onPress={() => router.replace(`/exercise/${partner.id}`)}
              style={({ pressed }) => [
                styles.partnerPill,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.partnerPillLabel}>Superset with</Text>
              <Text style={styles.partnerPillName} numberOfLines={1}>
                {partner.name} →
              </Text>
            </Pressable>
          ) : null}

          {exercise?.notes ? (
            <Text style={styles.notes}>{exercise.notes}</Text>
          ) : null}

          <SectionLabel>Warmup</SectionLabel>

          <View style={styles.tableHeader}>
            <Text style={[styles.headCell, { width: 32 }]}>Set</Text>
            {exercise?.type !== "bodyweight" ? (
              <Text style={[styles.headCell, { flex: 1 }]}>Weight (lb)</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={[styles.headCell, { flex: 1 }]}>Reps</Text>
            <View style={{ width: 32 }} />
          </View>

          <Card padded={false}>
            {warmupRows.map((r, idx) => {
              const isLast = idx === warmupRows.length - 1;
              return (
                <View key={r.setNumber} style={!isLast && styles.rowDivider}>
                  <View style={styles.tableRow}>
                    <Text
                      style={[
                        styles.setNum,
                        { width: 32, color: colors.primary },
                      ]}
                    >
                      W{idx + 1}
                    </Text>
                    {exercise?.type === "bodyweight" ? (
                      <View style={[styles.bwBadge, { flex: 1 }]}>
                        <Text style={styles.bwBadgeText}>Bodyweight</Text>
                      </View>
                    ) : (
                      <TextInput
                        value={r.weight}
                        onChangeText={(t: string) => {
                          updateWarmupRow(idx, { weight: t });
                          schedulePersistWarmup(idx);
                        }}
                        onBlur={() => persistWarmup(idx)}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        style={[styles.input, { flex: 1 }]}
                        placeholder="—"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="next"
                      />
                    )}
                    <TextInput
                      value={r.reps}
                      onChangeText={(t: string) => {
                        updateWarmupRow(idx, { reps: t });
                        schedulePersistWarmup(idx);
                      }}
                      onBlur={() => persistWarmup(idx)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      style={[styles.input, { flex: 1 }]}
                      placeholder="—"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={() => removeWarmupRow(idx)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        { width: 32, alignItems: "center" },
                        pressed && { opacity: 0.5 },
                      ]}
                    >
                      <X size={14} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Pressable
              onPress={addWarmupRow}
              style={({ pressed }) => [
                styles.addWarmupRow,
                warmupRows.length > 0 && styles.addWarmupRowBorder,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Plus size={13} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.addWarmupText}>Add warmup set</Text>
            </Pressable>
          </Card>

          <SectionLabel>Sets</SectionLabel>

          <View style={styles.tableHeader}>
            <Text style={[styles.headCell, { width: 32 }]}>Set</Text>
            {exercise?.type !== "bodyweight" ? (
              <Text style={[styles.headCell, { flex: 1 }]}>Weight (lb)</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={[styles.headCell, { flex: 1 }]}>Reps</Text>
            <Text style={[styles.headCell, { width: 32, textAlign: "center" }]}>
              ✓
            </Text>
          </View>

          <Card padded={false}>
            {rows.map((r, idx) => {
              const isDrop = exercise?.type === "drop";
              const isLast = idx === rows.length - 1;
              return (
                <View key={r.setNumber} style={!isLast && styles.rowDivider}>
                  <View style={styles.tableRow}>
                    <Text style={[styles.setNum, { width: 32 }]}>
                      {r.setNumber}
                    </Text>
                    {exercise?.type === "bodyweight" ? (
                      <View style={[styles.bwBadge, { flex: 1 }]}>
                        <Text style={styles.bwBadgeText}>Bodyweight</Text>
                      </View>
                    ) : (
                      <TextInput
                        value={r.weight}
                        onChangeText={(t: string) => {
                          updateRow(idx, { weight: t });
                          schedulePersistRow(idx);
                        }}
                        onBlur={() => persist(idx)}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        style={[styles.input, { flex: 1 }]}
                        placeholder="—"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="next"
                      />
                    )}
                    <TextInput
                      value={r.reps}
                      onChangeText={(t: string) => {
                        updateRow(idx, { reps: t });
                        schedulePersistRow(idx);
                      }}
                      onBlur={() => persist(idx)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      style={[styles.input, { flex: 1 }]}
                      placeholder="—"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType={isDrop ? "next" : "done"}
                    />
                    <View style={{ width: 32, alignItems: "center" }}>
                      <SetCheckButton
                        completed={r.completed}
                        onToggle={() => toggleComplete(idx)}
                      />
                    </View>
                  </View>
                  {isDrop ? (
                    <View style={[styles.tableRow, styles.dropRow]}>
                      <Text style={[styles.dropLabel, { width: 32 }]}>↓</Text>
                      <TextInput
                        value={r.dropWeight}
                        onChangeText={(t: string) => {
                          updateRow(idx, { dropWeight: t });
                          schedulePersistRow(idx);
                        }}
                        onBlur={() => persist(idx)}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        style={[styles.input, { flex: 1 }]}
                        placeholder="drop wt"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="next"
                      />
                      <TextInput
                        value={r.dropReps}
                        onChangeText={(t: string) => {
                          updateRow(idx, { dropReps: t });
                          schedulePersistRow(idx);
                        }}
                        onBlur={() => persist(idx)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        style={[styles.input, { flex: 1 }]}
                        placeholder="reps"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="done"
                      />
                      <View style={{ width: 32 }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>

          <View style={styles.restWrap}>
            <RestTimer autoStartKey={restKey} />
          </View>

          <Pressable
            onPress={() => {
              // Flush any pending in-flight edits (debounced or unblurred)
              // before navigating back. The unmount cleanup also flushes, but
              // doing it here keeps the action explicit.
              const timers = persistTimers.current;
              timers.forEach((t, key) => {
                clearTimeout(t);
                const [kind, idxStr] = key.split(":");
                const idx = Number(idxStr);
                if (kind === "r") flushRowNow(idx);
                else if (kind === "w") flushWarmupNow(idx);
              });
              timers.clear();
              router.back();
            }}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {exercise ? (
        <HistorySheet
          visible={historyOpen}
          exerciseName={exercise.name}
          history={history}
          isBodyweight={exercise.type === "bodyweight"}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}

      {exercise ? (
        <EditExerciseSheet
          key={exercise.id}
          visible={editOpen}
          exercise={exercise}
          dayExercises={dayExercises}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await load();
          }}
          onDuplicated={async (newId) => {
            setEditOpen(false);
            if (newId) router.replace(`/exercise/${newId}`);
          }}
          onDeleted={() => {
            setEditOpen(false);
            router.back();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function EditExerciseSheet({
  visible,
  exercise,
  dayExercises,
  onClose,
  onSaved,
  onDuplicated,
  onDeleted,
}: {
  visible: boolean;
  exercise: Exercise;
  dayExercises: Exercise[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onDuplicated: (newId: number | null) => void | Promise<void>;
  onDeleted: () => void;
}) {
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

  const onDuplicate = async () => {
    setBusy(true);
    try {
      const newId = await duplicateExercise(exercise.id);
      await onDuplicated(newId);
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
              <Pressable onPress={onClose} hitSlop={10}>
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
              <View style={styles.segmented}>
                {(
                  ["normal", "drop", "superset", "bodyweight"] as ExerciseType[]
                ).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={({ pressed }) => [
                      styles.segment,
                      type === t && styles.segmentActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        type === t && styles.segmentTextActive,
                      ]}
                    >
                      {t === "normal"
                        ? "Normal"
                        : t === "drop"
                          ? "Drop"
                          : t === "superset"
                            ? "Superset"
                            : "Bodyweight"}
                    </Text>
                  </Pressable>
                ))}
              </View>

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
                onPress={onDuplicate}
                disabled={busy}
                style={({ pressed }) => [
                  styles.duplicateBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Copy size={14} color={colors.primary} strokeWidth={2} />
                <Text style={styles.duplicateBtnText}>
                  Duplicate as new entry
                </Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },

  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  bodyContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },

  beatCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  beatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  beatValue: { ...typography.metricValue, color: colors.text, marginTop: 2 },
  beatCta: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },

  notes: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 12,
    marginHorizontal: 4,
  },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 12,
  },
  headCell: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  setNum: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  input: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },

  addWarmupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  addWarmupRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addWarmupText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },

  restWrap: {
    marginTop: 14,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

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
  sheetTitle: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  fieldLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
  },
  fieldInput: {
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
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    minWidth: 24,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  sheetHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 4,
  },
  duplicateBtn: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  duplicateBtnText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  deleteBtn: {
    marginTop: 2,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  deleteBtnText: { color: colors.red, fontSize: 14, fontWeight: "600" },

  bwBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  bwBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },

  dropRow: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  dropLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
  },

  partnerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + "15",
    alignSelf: "flex-start",
  },
  partnerPillLabel: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  partnerPillName: { color: colors.primary, fontSize: 13, fontWeight: "600" },

  segmented: {
    flexDirection: "row",
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
    alignItems: "center",
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
  segmentTextActive: { color: "#FFFFFF", fontWeight: "600" },

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
  partnerOptionText: { fontSize: 14, color: colors.text, flex: 1 },
  partnerOptionTextActive: { color: colors.primary, fontWeight: "600" },
  partnerOptionDay: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
});
