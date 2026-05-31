import { Check, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  getMuscleGroupsTrainedInSession,
  getStretchesByMuscleGroups,
  logCooldownStretch,
} from '../db/queries';
import { colors, muscleAccent } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import { useStyles } from '../theme/useStyles';
import { MUSCLE_LABEL, type MuscleGroup, type Stretch } from '../types';
import { hapticSelect, hapticTap } from '../utils/haptics';
import { HoldTimer } from './HoldTimer';

type Props = {
  visible: boolean;
  sessionId: number | null;
  /** Muscle groups to scope stretch suggestions by; usually derived from the session. */
  muscleGroupsHint?: MuscleGroup[];
  onClose: () => void;
};

type Side = 'single' | 'left' | 'right';

export function CooldownSheet({
  visible,
  sessionId,
  muscleGroupsHint,
  onClose,
}: Props) {
  const styles = useStyles(makeStyles);
  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [idx, setIdx] = useState(0);
  const [side, setSide] = useState<Side>('single');
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  // Reload when the sheet opens or the source data changes. We pull the
  // muscle groups trained in this session and look up matching stretches.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const trained: MuscleGroup[] = muscleGroupsHint?.length
        ? muscleGroupsHint
        : sessionId != null
          ? await getMuscleGroupsTrainedInSession(sessionId)
          : [];
      const list = trained.length
        ? await getStretchesByMuscleGroups(trained)
        : [];
      if (cancelled) return;
      setGroups(trained);
      setStretches(list);
      setIdx(0);
      setSide(list[0]?.per_side ? 'left' : 'single');
      setCompletedIds(new Set());
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, sessionId, muscleGroupsHint]);

  const current = stretches[idx];
  const total = stretches.length;
  const accent =
    current != null
      ? muscleAccent[current.muscle_group] ?? colors.primary
      : colors.primary;

  const advance = useCallback(
    (markCompleted: boolean) => {
      if (!current) return;
      const next = new Set(completedIds);
      if (markCompleted) next.add(current.id);
      setCompletedIds(next);

      // Per-side: do left then right before moving on.
      if (current.per_side && side === 'left') {
        setSide('right');
        return;
      }

      const nextIdx = idx + 1;
      if (nextIdx >= total) {
        onClose();
        return;
      }
      setIdx(nextIdx);
      setSide(stretches[nextIdx].per_side ? 'left' : 'single');
    },
    [current, completedIds, idx, total, side, stretches, onClose],
  );

  const handleComplete = useCallback(() => {
    if (!current || sessionId == null) {
      advance(true);
      return;
    }
    // Log per side so the weekly mobility minutes reflect both holds.
    logCooldownStretch(sessionId, current.id, current.hold_seconds);
    advance(true);
  }, [current, sessionId, advance]);

  const handleSkip = useCallback(() => {
    advance(false);
  }, [advance]);

  const jumpTo = (i: number) => {
    if (i === idx) return;
    hapticSelect();
    setIdx(i);
    setSide(stretches[i].per_side ? 'left' : 'single');
  };

  const skipAll = () => {
    hapticTap();
    onClose();
  };

  const subtitle = useMemo(() => {
    if (groups.length === 0) return '';
    const labels = groups.map((g) => MUSCLE_LABEL[g]);
    return labels.join(', ');
  }, [groups]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={skipAll}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Cool down</Text>
              {total > 0 ? (
                <Text style={styles.subtitle}>
                  {idx + 1} of {total} · {subtitle}
                </Text>
              ) : (
                <Text style={styles.subtitle}>Nothing to stretch today</Text>
              )}
            </View>
            <Pressable
              onPress={skipAll}
              hitSlop={10}
              accessibilityLabel="Skip cooldown"
              style={({ pressed }) => [
                styles.skipAllBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.skipAllText}>Skip</Text>
              <X size={14} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          {current ? (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stretchCard}>
                <View
                  style={[styles.accentBar, { backgroundColor: accent }]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.muscleTag}>
                    {MUSCLE_LABEL[current.muscle_group]}
                  </Text>
                  <Text style={styles.stretchName}>{current.name}</Text>
                  {current.notes ? (
                    <Text style={styles.stretchNotes}>{current.notes}</Text>
                  ) : null}
                </View>
              </View>

              <View style={{ marginVertical: 18 }}>
                <HoldTimer
                  key={`${current.id}-${side}`}
                  durationSeconds={current.hold_seconds}
                  autoStart
                  onComplete={handleComplete}
                  onSkip={handleSkip}
                  label={side === 'single' ? undefined : `${cap(side)} side`}
                />
              </View>

              <Text style={styles.upNextLabel}>Up next</Text>
              <View style={styles.pillRow}>
                {stretches.map((st, i) => {
                  const isDone = completedIds.has(st.id);
                  const isCurrent = i === idx;
                  return (
                    <Pressable
                      key={st.id}
                      onPress={() => jumpTo(i)}
                      style={({ pressed }) => [
                        styles.pill,
                        isCurrent && styles.pillCurrent,
                        isDone && styles.pillDone,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {isDone ? (
                        <Check size={11} color={colors.green} strokeWidth={2.5} />
                      ) : null}
                      <Text
                        style={[
                          styles.pillText,
                          isCurrent && styles.pillTextCurrent,
                          isDone && styles.pillTextDone,
                        ]}
                        numberOfLines={1}
                      >
                        {st.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Pressable
              onPress={skipAll}
              style={({ pressed }) => [
                styles.doneBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.doneBtnText}>Continue</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    title: { ...typography.screenTitle, fontSize: s(20), color: colors.text },
    subtitle: {
      ...typography.caption,
      fontSize: s(12),
      color: colors.textSecondary,
      marginTop: 2,
    },
    skipAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    skipAllText: {
      fontSize: s(12),
      fontWeight: '600',
      color: colors.textSecondary,
    },

    stretchCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
      padding: 14,
      gap: 12,
    },
    accentBar: {
      width: 3,
      borderRadius: radius.accent,
    },
    muscleTag: {
      ...typography.caption,
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
    },
    stretchName: {
      fontSize: s(17),
      fontWeight: '700',
      color: colors.text,
      marginTop: 4,
    },
    stretchNotes: {
      fontSize: s(13),
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },

    upNextLabel: {
      ...typography.caption,
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
      marginTop: 4,
      marginBottom: 8,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      maxWidth: '100%',
    },
    pillCurrent: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    pillDone: {
      borderColor: colors.green,
      backgroundColor: colors.green + '14',
    },
    pillText: {
      fontSize: s(12),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    pillTextCurrent: { color: colors.primary, fontWeight: '600' },
    pillTextDone: { color: colors.green, fontWeight: '600' },

    doneBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: radius.card,
      alignItems: 'center',
    },
    doneBtnText: { color: '#FFFFFF', fontSize: s(15), fontWeight: '600' },
  });
