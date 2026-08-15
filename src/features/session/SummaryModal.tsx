import { CheckCircle2, Flame, Heart, Timer } from "lucide-react-native";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { type HealthMetrics } from "../../health";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";

export type SessionSummary = {
  completed: number;
  total: number;
  volume: number;
  hk: HealthMetrics;
};

type Props = {
  summary: SessionSummary | null;
  onClose: () => void;
};

/**
 * End-of-session recap: sets completed, total volume, and Apple Health
 * metrics. Shared by the Today session screen and the per-day session screen.
 */
export function SummaryModal({ summary, onClose }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <Modal
      visible={!!summary}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconWrap}>
            <CheckCircle2 size={40} color={colors.green} strokeWidth={1.5} />
          </View>
          <Text style={styles.modalTitle}>Session complete</Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Sets completed</Text>
              <Text style={styles.metricValue}>
                {summary?.completed ?? 0}/{summary?.total ?? 0}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Volume</Text>
              <Text style={styles.metricValue}>
                {Math.round(summary?.volume ?? 0).toLocaleString()}
                <Text style={styles.metricUnit}> lb</Text>
              </Text>
            </View>
          </View>

          <View style={styles.hkHeader}>
            <Heart size={13} color={colors.red} strokeWidth={2} />
            <Text style={styles.hkHeaderText}>From Apple Health</Text>
          </View>

          <View style={styles.hkRow}>
            <HkCell
              icon={
                <Timer size={16} color={colors.primary} strokeWidth={1.75} />
              }
              label="Duration"
              value={
                summary?.hk.durationMinutes != null
                  ? `${summary.hk.durationMinutes} min`
                  : "—"
              }
            />
            <HkCell
              icon={<Heart size={16} color={colors.red} strokeWidth={1.75} />}
              label="Avg HR"
              value={
                summary?.hk.avgHr != null ? `${summary.hk.avgHr} bpm` : "—"
              }
            />
            <HkCell
              icon={<Flame size={16} color={colors.amber} strokeWidth={1.75} />}
              label="Active"
              value={
                summary?.hk.calories != null
                  ? `${summary.hk.calories} kcal`
                  : "—"
              }
            />
          </View>

          {summary?.hk.durationMinutes == null &&
          summary?.hk.avgHr == null &&
          summary?.hk.calories == null ? (
            <Text style={styles.hkHint}>Enable Health access in Settings</Text>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.modalBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.modalBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function HkCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.hkCell}>
      {icon}
      <Text style={styles.hkCellValue}>{value}</Text>
      <Text style={styles.hkCellLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  modalIconWrap: { marginBottom: 8 },
  modalTitle: {
    fontSize: s(20),
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    alignSelf: "stretch",
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metricLabel: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricValue: {
    ...typography.metricValue,
    fontSize: s(22),
    color: colors.text,
    marginTop: 4,
  },
  metricUnit: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    fontWeight: "400",
  },

  hkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
    marginTop: 2,
  },
  hkHeaderText: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  hkRow: {
    flexDirection: "row",
    gap: 12,
    alignSelf: "stretch",
  },
  hkCell: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  hkCellValue: {
    fontSize: s(15),
    fontWeight: "600",
    color: colors.text,
    marginTop: 2,
  },
  hkCellLabel: {
    fontSize: s(10),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  hkHint: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textMuted,
    marginTop: 8,
  },

  modalBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: radius.card,
    alignSelf: "stretch",
    alignItems: "center",
  },
  modalBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
});
