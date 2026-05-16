import { Minus, Pause, Pencil, Play, Plus, SkipForward, Timer, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { getCustomRestSeconds, setCustomRestSeconds } from '../db/queries';
import { colors } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import { hapticSelect, hapticSuccess } from '../utils/haptics';
import { cancelRestNotification, scheduleRestComplete } from '../utils/notifications';

export const FIXED_PRESETS = [60, 180, 300] as const;
const DEFAULT_CUSTOM_SECS = 90;
const MIN_CUSTOM_SECS = 15;
const MAX_CUSTOM_SECS = 30 * 60;
const DEFAULT_PRESET = 60;

// Module-level state so the timer survives navigation (component unmount /
// remount). Cleared on stop or when the timer fires. App-kill recovery is
// handled by the scheduled local notification, not this state.
type TimerState = {
  preset: number;
  endTime: number | null;
  pausedSecs: number | null;
  notifId: string | null;
};
let saved: TimerState | null = null;
// Cache the persisted custom seconds so re-mounts within the same session
// don't briefly flash the default value before the async DB load resolves.
let savedCustomSecs: number | null = null;

type Props = {
  defaultSeconds?: number;
  autoStartKey?: number | null;
};

export function RestTimer({ defaultSeconds = DEFAULT_PRESET, autoStartKey }: Props) {
  const [customSecs, setCustomSecsState] = useState<number>(savedCustomSecs ?? DEFAULT_CUSTOM_SECS);
  const [preset, setPreset] = useState<number>(saved?.preset ?? defaultSeconds);
  const [editOpen, setEditOpen] = useState(false);

  // endTime: epoch ms when countdown reaches zero (null = idle or paused)
  // pausedSecs: seconds left when paused (null = not paused)
  // displaySecs: what we show; updated on every tick from Date.now()
  const [endTime, setEndTime] = useState<number | null>(saved?.endTime ?? null);
  const [pausedSecs, setPausedSecs] = useState<number | null>(saved?.pausedSecs ?? null);
  const [displaySecs, setDisplaySecs] = useState<number | null>(() => {
    if (saved?.endTime != null) {
      return Math.max(0, Math.ceil((saved.endTime - Date.now()) / 1000));
    }
    return saved?.pausedSecs ?? null;
  });

  const notifId = useRef<string | null>(saved?.notifId ?? null);
  const fired = useRef(false);

  // Load the persisted custom value once on first mount of the session.
  useEffect(() => {
    if (savedCustomSecs != null) return;
    let cancelled = false;
    (async () => {
      const v = await getCustomRestSeconds();
      if (cancelled || v == null) return;
      savedCustomSecs = v;
      setCustomSecsState(v);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync module-level snapshot whenever the relevant pieces change.
  useEffect(() => {
    if (endTime == null && pausedSecs == null) {
      saved = null;
    } else {
      saved = { preset, endTime, pausedSecs, notifId: notifId.current };
    }
  }, [preset, endTime, pausedSecs]);

  const active = endTime != null || pausedSecs != null;
  const isPaused = endTime == null && pausedSecs != null;
  const remaining = isPaused ? pausedSecs : displaySecs;
  const done = active && !isPaused && remaining != null && remaining <= 0;

  // Tick from wall clock — accurate even after backgrounding. Once the timer
  // hits zero, stop the interval so a stale tick can't race a fresh restart
  // (e.g. user completes another set while "Done" is showing) and overwrite
  // the new countdown back to 0.
  useEffect(() => {
    if (endTime == null) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      const r = Math.ceil((endTime - Date.now()) / 1000);
      const clamped = Math.max(0, r);
      setDisplaySecs(clamped);
      if (clamped <= 0 && !fired.current) {
        fired.current = true;
        hapticSuccess();
      }
      if (clamped <= 0 && id != null) {
        clearInterval(id);
        id = null;
      }
    };
    tick();
    if (endTime - Date.now() > 0) {
      id = setInterval(tick, 500);
    }
    return () => {
      if (id != null) clearInterval(id);
    };
  }, [endTime]);

  const cancelNotif = async () => {
    if (notifId.current) {
      await cancelRestNotification(notifId.current);
      notifId.current = null;
      if (saved) saved.notifId = null;
    }
  };

  const scheduleNotif = async (seconds: number) => {
    await cancelNotif();
    notifId.current = await scheduleRestComplete(seconds);
    if (saved) saved.notifId = notifId.current;
  };

  // Auto-start when a set is completed. The per-instance ref blocks duplicate
  // fires for the same key within a single mount (incl. strict-mode double-
  // invocation). Each fresh mount starts with a null ref so the first non-null
  // autoStartKey always fires — the parent only sets restKey in response to a
  // user tap, and on remount restKey resets to null, so there is no spurious
  // re-fire to guard against. The in-progress countdown is restored from the
  // module-level `saved` snapshot, not from the autoStartKey prop.
  const lastSeenLocal = useRef<number | null>(null);
  useEffect(() => {
    if (autoStartKey == null) return;
    if (lastSeenLocal.current === autoStartKey) return;
    lastSeenLocal.current = autoStartKey;
    fired.current = false;
    const end = Date.now() + preset * 1000;
    setEndTime(end);
    setPausedSecs(null);
    setDisplaySecs(preset);
    scheduleNotif(preset);
  }, [autoStartKey]);

  const choosePreset = (p: number) => {
    hapticSelect();
    setPreset(p);
    if (active) {
      fired.current = false;
      const end = Date.now() + p * 1000;
      setEndTime(end);
      setPausedSecs(null);
      setDisplaySecs(p);
      scheduleNotif(p);
    }
  };

  const start = () => {
    hapticSelect();
    fired.current = false;
    const end = Date.now() + preset * 1000;
    setEndTime(end);
    setPausedSecs(null);
    setDisplaySecs(preset);
    scheduleNotif(preset);
  };

  const togglePause = () => {
    hapticSelect();
    if (isPaused) {
      const secs = pausedSecs ?? preset;
      const end = Date.now() + secs * 1000;
      setEndTime(end);
      setPausedSecs(null);
      scheduleNotif(secs);
    } else {
      const secs = displaySecs ?? 0;
      setPausedSecs(secs);
      setEndTime(null);
      cancelNotif();
    }
  };

  const stop = () => {
    hapticSelect();
    setEndTime(null);
    setPausedSecs(null);
    setDisplaySecs(null);
    fired.current = false;
    cancelNotif();
  };

  // Persist a new custom value. If the user has the custom slot currently
  // selected, keep `preset` in sync so the displayed selection matches. The
  // active countdown is intentionally NOT restarted — editing the dial-in
  // value is a configuration change, not a "start a new rest" action.
  const saveCustom = async (next: number) => {
    const clamped = Math.max(MIN_CUSTOM_SECS, Math.min(MAX_CUSTOM_SECS, Math.round(next)));
    savedCustomSecs = clamped;
    setCustomSecsState(clamped);
    if (preset === customSecs) {
      setPreset(clamped);
    }
    await setCustomRestSeconds(clamped);
  };

  const customIsActive = preset === customSecs;

  return (
    <>
      <View style={styles.bar}>
        <View style={styles.presetRow}>
          {FIXED_PRESETS.map((p) => {
            const isActive = preset === p;
            return (
              <Pressable
                key={p}
                onPress={() => choosePreset(p)}
                style={({ pressed }) => [
                  styles.preset,
                  isActive && styles.presetActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                  {p / 60}m
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            key="custom"
            onPress={() => choosePreset(customSecs)}
            style={({ pressed }) => [
              styles.preset,
              customIsActive && styles.presetActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.presetText, customIsActive && styles.presetTextActive]}>
              {formatPresetLabel(customSecs)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setEditOpen(true)}
            hitSlop={8}
            accessibilityLabel="Edit custom rest time"
            style={({ pressed }) => [styles.pencilBtn, pressed && { opacity: 0.5 }]}
          >
            <Pencil size={11} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.controls}>
          {active ? (
            <>
              <View style={styles.timeWrap}>
                <Timer
                  size={15}
                  color={done ? colors.green : colors.primary}
                  strokeWidth={2}
                />
                <Text style={[styles.time, { color: done ? colors.green : colors.text }]}>
                  {done ? 'Done' : formatTime(remaining ?? 0)}
                </Text>
              </View>
              {!done ? (
                <Pressable
                  onPress={togglePause}
                  hitSlop={8}
                  accessibilityLabel={isPaused ? "Resume timer" : "Pause timer"}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                >
                  {isPaused ? (
                    <Play size={16} color={colors.text} strokeWidth={2} />
                  ) : (
                    <Pause size={16} color={colors.text} strokeWidth={2} />
                  )}
                </Pressable>
              ) : null}
              <Pressable
                onPress={stop}
                hitSlop={8}
                accessibilityLabel={done ? "Dismiss timer" : "Skip rest"}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              >
                {done ? (
                  <X size={16} color={colors.textSecondary} strokeWidth={2} />
                ) : (
                  <SkipForward size={16} color={colors.textSecondary} strokeWidth={2} />
                )}
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={start}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
            >
              <Timer size={14} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.startBtnText}>Start rest</Text>
            </Pressable>
          )}
        </View>
      </View>

      <CustomRestSheet
        visible={editOpen}
        initialSeconds={customSecs}
        onClose={() => setEditOpen(false)}
        onSave={async (secs) => {
          await saveCustom(secs);
          setEditOpen(false);
        }}
      />
    </>
  );
}

function CustomRestSheet({
  visible,
  initialSeconds,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialSeconds: number;
  onClose: () => void;
  onSave: (seconds: number) => void | Promise<void>;
}) {
  const [secs, setSecs] = useState(initialSeconds);

  useEffect(() => {
    if (visible) setSecs(initialSeconds);
  }, [visible, initialSeconds]);

  const adjust = (delta: number) => {
    hapticSelect();
    setSecs((s) => Math.max(MIN_CUSTOM_SECS, Math.min(MAX_CUSTOM_SECS, s + delta)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <Pressable style={sheetStyles.dismiss} onPress={onClose} />
        <View style={sheetStyles.sheet}>
          <View style={sheetStyles.header}>
            <Text style={sheetStyles.title}>Custom rest</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={sheetStyles.display}>{formatTime(secs)}</Text>
          <Text style={sheetStyles.hint}>Set how long you want to rest between sets.</Text>

          <View style={sheetStyles.stepperRow}>
            <Pressable
              onPress={() => adjust(-60)}
              hitSlop={6}
              disabled={secs <= MIN_CUSTOM_SECS}
              style={({ pressed }) => [
                sheetStyles.stepperBtn,
                secs <= MIN_CUSTOM_SECS && { opacity: 0.4 },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Minus size={14} color={colors.text} strokeWidth={2} />
              <Text style={sheetStyles.stepperLabel}>1m</Text>
            </Pressable>
            <Pressable
              onPress={() => adjust(-15)}
              hitSlop={6}
              disabled={secs <= MIN_CUSTOM_SECS}
              style={({ pressed }) => [
                sheetStyles.stepperBtn,
                secs <= MIN_CUSTOM_SECS && { opacity: 0.4 },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Minus size={14} color={colors.text} strokeWidth={2} />
              <Text style={sheetStyles.stepperLabel}>15s</Text>
            </Pressable>
            <Pressable
              onPress={() => adjust(15)}
              hitSlop={6}
              disabled={secs >= MAX_CUSTOM_SECS}
              style={({ pressed }) => [
                sheetStyles.stepperBtn,
                secs >= MAX_CUSTOM_SECS && { opacity: 0.4 },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Plus size={14} color={colors.text} strokeWidth={2} />
              <Text style={sheetStyles.stepperLabel}>15s</Text>
            </Pressable>
            <Pressable
              onPress={() => adjust(60)}
              hitSlop={6}
              disabled={secs >= MAX_CUSTOM_SECS}
              style={({ pressed }) => [
                sheetStyles.stepperBtn,
                secs >= MAX_CUSTOM_SECS && { opacity: 0.4 },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Plus size={14} color={colors.text} strokeWidth={2} />
              <Text style={sheetStyles.stepperLabel}>1m</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => onSave(secs)}
            style={({ pressed }) => [sheetStyles.saveBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={sheetStyles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Tighter label for the preset pill — drops the leading zero minute when
// under one minute (e.g. "45s") and uses mm:ss above that.
function formatPresetLabel(s: number): string {
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60}m`;
  return formatTime(s);
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 3,
  },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetActive: {
    backgroundColor: colors.primary,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  pencilBtn: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    minWidth: 42,
    textAlign: 'right',
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

const sheetStyles = StyleSheet.create({
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  display: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
    marginBottom: 6,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  stepperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
