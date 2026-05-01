import { Pause, Play, SkipForward, Timer, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { hapticSelect, hapticSuccess } from '../utils/haptics';
import { cancelRestNotification, scheduleRestComplete } from '../utils/notifications';

export const REST_PRESETS = [60, 120, 180, 300] as const;
export type RestPreset = (typeof REST_PRESETS)[number];
const DEFAULT_PRESET: RestPreset = 60;

// Module-level state so the timer survives navigation (component unmount /
// remount). Cleared on stop or when the timer fires. App-kill recovery is
// handled by the scheduled local notification, not this state.
type TimerState = {
  preset: RestPreset;
  endTime: number | null;
  pausedSecs: number | null;
  notifId: string | null;
};
let saved: TimerState | null = null;
let lastAutoStartKeySeen: number | null = null;

type Props = {
  defaultSeconds?: RestPreset;
  onPresetChange?: (seconds: RestPreset) => void;
  autoStartKey?: number | null;
};

export function RestTimer({ defaultSeconds = DEFAULT_PRESET, onPresetChange, autoStartKey }: Props) {
  const [preset, setPreset] = useState<RestPreset>(saved?.preset ?? defaultSeconds);

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

  // Tick from wall clock — accurate even after backgrounding
  useEffect(() => {
    if (endTime == null) return;
    const tick = () => {
      const r = Math.ceil((endTime - Date.now()) / 1000);
      const clamped = Math.max(0, r);
      setDisplaySecs(clamped);
      if (clamped <= 0 && !fired.current) {
        fired.current = true;
        hapticSuccess();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
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

  // Auto-start when a set is completed. Module-level guard so a remount with
  // the same key (e.g. navigating away and back) doesn't reseed an already-
  // running timer.
  useEffect(() => {
    if (autoStartKey == null) return;
    if (lastAutoStartKeySeen === autoStartKey) return;
    lastAutoStartKeySeen = autoStartKey;
    fired.current = false;
    const end = Date.now() + preset * 1000;
    setEndTime(end);
    setPausedSecs(null);
    setDisplaySecs(preset);
    scheduleNotif(preset);
  }, [autoStartKey]);

  const choosePreset = (p: RestPreset) => {
    hapticSelect();
    setPreset(p);
    onPresetChange?.(p);
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

  return (
    <View style={styles.bar}>
      <View style={styles.presetRow}>
        {REST_PRESETS.map((p) => {
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
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
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
