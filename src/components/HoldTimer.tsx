import { Pause, Play, SkipForward } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { colors } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import { useStyles } from '../theme/useStyles';
import { hapticSelect, hapticSuccess } from '../utils/haptics';

type Props = {
  /** Total hold duration in seconds. Changing this resets the timer. */
  durationSeconds: number;
  /** Auto-start the countdown on mount / when key prop changes. */
  autoStart?: boolean;
  /** Fires once when the countdown reaches zero. Also fires the success haptic. */
  onComplete: () => void;
  /** Fires when the user taps Skip. Receives seconds remaining at skip time. */
  onSkip: (secondsRemaining: number) => void;
  /** Optional label inside the ring (e.g. "Left side"). */
  label?: string;
};

const RING_SIZE = 152;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export function HoldTimer({
  durationSeconds,
  autoStart = true,
  onComplete,
  onSkip,
  label,
}: Props) {
  const styles = useStyles(makeStyles);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [pausedSecs, setPausedSecs] = useState<number | null>(null);
  const [displaySecs, setDisplaySecs] = useState<number>(durationSeconds);
  const fired = useRef(false);

  // Reset on duration change (e.g. moving to next stretch in the sheet).
  useEffect(() => {
    fired.current = false;
    setDisplaySecs(durationSeconds);
    if (autoStart) {
      setEndTime(Date.now() + durationSeconds * 1000);
      setPausedSecs(null);
    } else {
      setEndTime(null);
      setPausedSecs(durationSeconds);
    }
  }, [durationSeconds, autoStart]);

  // Tick from wall clock so backgrounding doesn't drift the countdown.
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
        onComplete();
      }
      if (clamped <= 0 && id != null) {
        clearInterval(id);
        id = null;
      }
    };
    tick();
    if (endTime - Date.now() > 0) {
      id = setInterval(tick, 250);
    }
    return () => {
      if (id != null) clearInterval(id);
    };
  }, [endTime, onComplete]);

  const isRunning = endTime != null && displaySecs > 0;
  const isPaused = endTime == null && pausedSecs != null;

  const togglePause = () => {
    hapticSelect();
    if (isRunning) {
      setPausedSecs(displaySecs);
      setEndTime(null);
    } else {
      const secs = pausedSecs ?? durationSeconds;
      setEndTime(Date.now() + secs * 1000);
      setPausedSecs(null);
    }
  };

  const handleSkip = () => {
    hapticSelect();
    onSkip(displaySecs);
  };

  const progress =
    durationSeconds > 0
      ? Math.max(0, Math.min(1, 1 - displaySecs / durationSeconds))
      : 0;
  const filled = progress * RING_CIRC;

  return (
    <View style={styles.wrap}>
      <View style={{ width: RING_SIZE, height: RING_SIZE }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.border}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.primary}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${filled} ${RING_CIRC}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
          <Text style={styles.ringValue}>{displaySecs}</Text>
          <Text style={styles.ringUnit}>seconds</Text>
          {label ? <Text style={styles.ringLabel}>{label}</Text> : null}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={togglePause}
          accessibilityLabel={isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
          style={({ pressed }) => [styles.controlBtn, pressed && { opacity: 0.7 }]}
        >
          {isRunning ? (
            <Pause size={18} color={colors.text} strokeWidth={2} />
          ) : (
            <Play size={18} color={colors.text} strokeWidth={2} />
          )}
          <Text style={styles.controlBtnText}>
            {isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSkip}
          accessibilityLabel="Skip"
          style={({ pressed }) => [
            styles.controlBtn,
            styles.skipBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <SkipForward size={18} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.controlBtnText, { color: colors.textSecondary }]}>
            Skip
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      gap: 18,
    },
    ringCenter: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringValue: {
      fontSize: s(40),
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    ringUnit: {
      ...typography.caption,
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 2,
    },
    ringLabel: {
      fontSize: s(12),
      color: colors.primary,
      fontWeight: '600',
      marginTop: 6,
    },
    controls: {
      flexDirection: 'row',
      gap: 10,
      alignSelf: 'stretch',
    },
    controlBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.card,
      backgroundColor: colors.primary,
    },
    controlBtnText: {
      color: '#FFFFFF',
      fontSize: s(14),
      fontWeight: '600',
    },
    skipBtn: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
