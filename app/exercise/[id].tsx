import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Pencil,
  Plus,
  TrendingUp,
  Trophy,
  Wand2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
  EditExerciseSheet,
  PlateSheet,
  StretchPanel,
  estimateOneRepMax,
  warmupRamp,
  type Row,
  type WarmupRow,
} from "../../src/features/exercise";
import {
  bestSet,
  deleteSetLog,
  getExercise,
  getExerciseSessionHistory,
  getExercisesByDay,
  getLastCompletedSetsForExercise,
  getOrCreateSession,
  getSetLogsForSessionExercise,
  upsertSetLog,
  type ExerciseSessionHistory,
} from "../../src/db/queries";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import { useStyles } from "../../src/theme/useStyles";
import {
  type Exercise,
  type SetLog,
} from "../../src/types";
import { dayOfWeek, todayISO } from "../../src/utils/date";
import { hapticTap } from "../../src/utils/haptics";

export default function ExerciseDetailScreen() {
  const styles = useStyles(makeStyles);
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
  const [plateTarget, setPlateTarget] = useState<number | null>(null);

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

  // Estimated 1RM comparison. Using e1RM rather than raw weight makes sets at
  // different rep counts comparable: 185x8 beating 225x1 is a real improvement
  // that a weight-only check would miss.
  //
  // `history` excludes the current session for `beatThis` purposes but does
  // include it here, so the best prior is taken from sessions strictly before
  // the one on screen.
  const isBodyweight = exercise?.type === "bodyweight";

  const priorBestE1rm = React.useMemo(() => {
    if (isBodyweight) return null;
    let best: number | null = null;
    for (const h of history) {
      if (h.session_id === sessionId) continue;
      if (h.best_weight_lb == null) continue;
      const e = estimateOneRepMax(h.best_weight_lb, h.best_reps);
      if (e != null && (best == null || e > best)) best = e;
    }
    return best;
  }, [history, sessionId, isBodyweight]);

  const currentBestE1rm = React.useMemo(() => {
    if (isBodyweight) return null;
    let best: number | null = null;
    for (const r of rows) {
      if (!r.completed) continue;
      const w = Number(r.weight);
      const reps = Number(r.reps);
      const e = estimateOneRepMax(w, reps);
      if (e != null && (best == null || e > best)) best = e;
    }
    return best;
  }, [rows, isBodyweight]);

  const isPR =
    currentBestE1rm != null &&
    (priorBestE1rm == null || currentBestE1rm > priorBestE1rm);

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

  // Each pending edit captures its sessionId+exercise+row at schedule time, so
  // a navigation to a superset partner (which swaps the screen's state without
  // unmounting) can't re-target a write to the wrong exercise or lose it.
  type Pending = { write: () => void; timer: ReturnType<typeof setTimeout> };
  const pendingWrites = useRef<Map<string, Pending>>(new Map());

  const flushAllPending = () => {
    const map = pendingWrites.current;
    map.forEach(({ write, timer }) => {
      clearTimeout(timer);
      write();
    });
    map.clear();
  };

  const schedulePersistRow = (idx: number) => {
    const sid = ctxRef.current.sessionId;
    const ex = ctxRef.current.exercise;
    const r = rowsRef.current[idx];
    if (!sid || !ex || !r) return;
    const rowSnap = { ...r };
    const isDrop = ex.type === "drop";
    const exId = ex.id;
    const write = () => {
      upsertSetLog(sid, exId, rowSnap.setNumber, rowToPatch(rowSnap, isDrop));
    };
    const key = `r:${exId}:${idx}`;
    const map = pendingWrites.current;
    const existing = map.get(key);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      map.delete(key);
      write();
    }, 400);
    map.set(key, { write, timer });
  };

  const schedulePersistWarmup = (idx: number) => {
    const sid = ctxRef.current.sessionId;
    const ex = ctxRef.current.exercise;
    const r = warmupRowsRef.current[idx];
    if (!sid || !ex || !r) return;
    const rowSnap = { ...r };
    const exId = ex.id;
    const toNum = (s: string) => (s.trim() === "" ? null : Number(s));
    const write = () => {
      upsertSetLog(sid, exId, rowSnap.setNumber, {
        weight_lb: toNum(rowSnap.weight),
        reps: toNum(rowSnap.reps),
        completed: 0,
      });
    };
    const key = `w:${exId}:${idx}`;
    const map = pendingWrites.current;
    const existing = map.get(key);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      map.delete(key);
      write();
    }, 400);
    map.set(key, { write, timer });
  };

  // When the route's exerciseId changes (e.g. tapping a superset partner),
  // expo-router keeps this component mounted but reloads it for the new id.
  // Flush pending writes for the OLD exercise before load() overwrites state.
  const prevExerciseIdRef = useRef(exerciseId);
  useEffect(() => {
    if (prevExerciseIdRef.current !== exerciseId) {
      flushAllPending();
      prevExerciseIdRef.current = exerciseId;
    }
  }, [exerciseId]);

  // On unmount, immediately flush every pending row so navigating away mid-edit
  // never loses the in-flight value.
  useEffect(() => {
    return () => {
      flushAllPending();
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

  // Fill warmup weights from the first working set's weight. Uses whatever is
  // in the row now -- typed this session or carried over from last -- because
  // that is the load the ramp should build toward.
  const autoFillWarmup = async () => {
    const working = Number(rows[0]?.weight);
    if (!Number.isFinite(working) || working <= 0) {
      Alert.alert(
        "No working weight yet",
        "Enter the weight for your first set and the warmup will ramp up to it.",
      );
      return;
    }
    const count = warmupRows.length > 0 ? warmupRows.length : 3;
    const ramp = warmupRamp(working, count);
    if (ramp.length === 0) return;

    hapticTap();
    // The ramp can be shorter than the row count when weights collapse after
    // rounding, so rebuild the rows to match rather than leaving stale ones.
    const next: WarmupRow[] = ramp.map((w, i) => ({
      setNumber: -(i + 1),
      weight: String(w),
      reps: warmupRows[i]?.reps ?? "",
    }));
    setWarmupRows(next);

    if (!sessionId || !exercise) return;
    // Drop any rows the shorter ramp no longer covers, then persist the rest.
    for (let i = ramp.length; i < warmupRows.length; i++) {
      await deleteSetLog(sessionId, exercise.id, warmupRows[i].setNumber);
    }
    const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
    for (const r of next) {
      await upsertSetLog(sessionId, exercise.id, r.setNumber, {
        weight_lb: toNum(r.weight),
        reps: toNum(r.reps),
        completed: 0,
      });
    }
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
          accessibilityLabel="Back"
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
              ? exercise.type === "stretch"
                ? `${exercise.sets} ${exercise.sets === 1 ? "round" : "rounds"} · ${exercise.hold_seconds ?? 30}s hold · Stretch`
                : `${exercise.sets} sets · ${exercise.rep_range}${
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
            accessibilityLabel="Edit exercise"
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
          {exercise?.type !== "stretch" ? (
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
                  {currentBestE1rm != null || priorBestE1rm != null ? (
                    <View style={styles.oneRmRow}>
                      <Text style={styles.oneRmText}>
                        Est. 1RM{" "}
                        <Text style={styles.oneRmValue}>
                          {currentBestE1rm ?? priorBestE1rm} lb
                        </Text>
                      </Text>
                      {isPR ? (
                        <View style={styles.prBadge}>
                          <Trophy size={9} color={colors.amber} strokeWidth={2.5} />
                          <Text style={styles.prBadgeText}>PR</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
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
          ) : null}

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

          {exercise?.type === "stretch" && exercise ? (
            <StretchPanel
              key={exercise.id}
              rows={rows}
              holdSeconds={exercise.hold_seconds ?? 30}
              onRoundComplete={(roundIdx) => toggleComplete(roundIdx)}
            />
          ) : null}

          {exercise?.type !== "stretch" ? (
            <>
          <SectionLabel
            trailing={
              <Pressable
                onPress={autoFillWarmup}
                hitSlop={8}
                accessibilityLabel="Auto-fill warmup weights"
                style={({ pressed }) => [
                  styles.autoFillBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Wand2 size={12} color={colors.primary} strokeWidth={2} />
                <Text style={styles.autoFillText}>Auto-fill</Text>
              </Pressable>
            }
          >
            Warmup
          </SectionLabel>

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
                    <Pressable
                      onPress={() => {
                        const w = Number(r.weight);
                        if (Number.isFinite(w) && w > 0) {
                          hapticTap();
                          setPlateTarget(w);
                        }
                      }}
                      hitSlop={8}
                      accessibilityLabel={`Plate loading for warmup set ${idx + 1}`}
                      style={({ pressed }) => [
                        { width: 32 },
                        pressed && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={[styles.setNum, { color: colors.primary }]}>
                        W{idx + 1}
                      </Text>
                    </Pressable>
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
                      accessibilityLabel="Remove warmup set"
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
                    <Pressable
                      onPress={() => {
                        const w = Number(r.weight);
                        if (Number.isFinite(w) && w > 0) {
                          hapticTap();
                          setPlateTarget(w);
                        }
                      }}
                      hitSlop={8}
                      accessibilityLabel={`Plate loading for set ${r.setNumber}`}
                      style={({ pressed }) => [
                        { width: 32 },
                        pressed && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={styles.setNum}>{r.setNumber}</Text>
                    </Pressable>
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
            </>
          ) : null}

          <Pressable
            onPress={() => {
              // Flush any pending in-flight edits (debounced or unblurred)
              // before navigating back. The unmount cleanup also flushes, but
              // doing it here keeps the action explicit.
              flushAllPending();
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

      <PlateSheet
        visible={plateTarget !== null}
        targetLb={plateTarget}
        onClose={() => setPlateTarget(null)}
      />

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
          onDeleted={() => {
            setEditOpen(false);
            router.back();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}


const makeStyles = (s: (n: number) => number) => StyleSheet.create({
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
  title: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
  subtitle: {
    ...typography.caption,
    fontSize: s(12),
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
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  beatValue: { ...typography.metricValue, fontSize: s(22), color: colors.text, marginTop: 2 },
  autoFillBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  autoFillText: { fontSize: s(12), fontWeight: "600", color: colors.primary },
  oneRmRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  oneRmText: { fontSize: s(12), color: colors.textSecondary },
  oneRmValue: { fontWeight: "700", color: colors.text },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.amber + "1F",
  },
  prBadgeText: { fontSize: s(10), fontWeight: "700", color: colors.amber, letterSpacing: 0.3 },
  beatCta: {
    fontSize: s(11),
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },

  notes: {
    ...typography.caption,
    fontSize: s(12),
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
    fontSize: s(11),
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
    fontSize: s(14),
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  input: {
    fontSize: s(15),
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
    fontSize: s(13),
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
  saveBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },

  bwBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  bwBadgeText: {
    fontSize: s(13),
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },

  dropRow: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  dropLabel: {
    fontSize: s(13),
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
    fontSize: s(11),
    color: colors.primary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  partnerPillName: { color: colors.primary, fontSize: s(13), fontWeight: "600" },

});

