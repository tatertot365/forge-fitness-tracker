import { Trophy, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type ExerciseSessionHistory } from '../db/queries';
import { colors } from '../theme/colors';
import { radius, typography } from '../theme/spacing';

type Props = {
  visible: boolean;
  exerciseName: string;
  history: ExerciseSessionHistory[];
  isBodyweight?: boolean;
  onClose: () => void;
};

export function HistorySheet({ visible, exerciseName, history, isBodyweight = false, onClose }: Props) {
  const bestEverScore = history.reduce(
    (m, h) => Math.max(m, isBodyweight ? h.best_reps : (h.best_weight_lb ?? 0) * h.best_reps),
    0,
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>History</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {history.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No completed sessions yet</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {history.map((h, idx) => {
                const score = isBodyweight ? h.best_reps : (h.best_weight_lb ?? 0) * h.best_reps;
                const isBest = score === bestEverScore;
                const bestSetLabel = isBodyweight
                  ? `${h.best_reps} reps`
                  : `${h.best_weight_lb} × ${h.best_reps}`;
                const volumeLabel = isBodyweight
                  ? `${h.volume} total reps`
                  : `${Math.round(h.volume).toLocaleString()} lb volume`;
                return (
                  <View
                    key={h.session_id}
                    style={[styles.row, idx < history.length - 1 && styles.rowDivider]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.date}>{formatDate(h.date)}</Text>
                      <Text style={styles.meta}>
                        {h.sets_count} set{h.sets_count === 1 ? '' : 's'} · {volumeLabel}
                      </Text>
                    </View>
                    <View style={styles.rightCol}>
                      <View style={styles.bestRow}>
                        {isBest ? (
                          <Trophy size={12} color={colors.amber} strokeWidth={2} />
                        ) : null}
                        <Text style={[styles.best, isBest && { color: colors.amber }]}>
                          {bestSetLabel}
                        </Text>
                      </View>
                      <Text style={styles.bestLabel}>best set</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },

  list: {
    marginTop: 4,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  date: {
    ...typography.exerciseName,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  best: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  bestLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
