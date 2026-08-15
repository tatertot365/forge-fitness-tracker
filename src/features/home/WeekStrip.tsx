import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import {
  DAY_LABEL,
  DAYS,
  type Day,
  type Session,
  type DayPlan,
} from "../../types";

// ── Week strip ────────────────────────────────────────────────────────────────

export function WeekStrip({
  today,
  todayDate,
  thisWeek,
  dayPlans,
  weekSessions,
  weekLogCounts,
  weekTotalSetCounts,
  skippedDays,
  onPressDay,
  onLongPressDay,
}: {
  today: Day;
  todayDate: string;
  thisWeek: Record<Day, string>;
  dayPlans: Record<Day, DayPlan> | null;
  weekSessions: Record<Day, Session | null> | null;
  weekLogCounts: Record<Day, number> | null;
  weekTotalSetCounts: Record<Day, number> | null;
  skippedDays: Partial<Record<Day, true>>;
  onPressDay: (d: Day) => void;
  onLongPressDay: (d: Day) => void;
}) {
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const slotWidth = (width - 32) / 7;

  return (
    <View style={styles.strip}>
      {DAYS.map((d) => {
        const isTraining = !!dayPlans?.[d]?.enabled;
        const finalized = !!weekSessions?.[d]?.completed_at;
        const isSkipped = !!skippedDays[d];
        const isPast = thisWeek[d] < todayDate;
        const isToday = d === today;
        const completedSetsForDay = weekLogCounts?.[d] ?? 0;
        const totalSetsForDay = weekTotalSetCounts?.[d] ?? 0;
        const hasLogs = completedSetsForDay > 0;
        const allSetsComplete =
          finalized &&
          totalSetsForDay > 0 &&
          completedSetsForDay >= totalSetsForDay;
        const completed = allSetsComplete;
        const isPartial = isTraining && !completed && !isSkipped && (hasLogs || finalized);
        const isMissed =
          isTraining &&
          isPast &&
          !isToday &&
          !completed &&
          !isSkipped &&
          !hasLogs &&
          !finalized;
        const canSkip =
          isTraining && !completed && !isSkipped && (isPast || isToday);

        let dotBg: string;
        let dotBorder: string;
        if (!isTraining) {
          dotBg = "transparent";
          dotBorder = colors.border;
        } else if (completed) {
          dotBg = colors.green;
          dotBorder = colors.green;
        } else if (isSkipped) {
          dotBg = colors.gray;
          dotBorder = colors.gray;
        } else if (isPartial) {
          dotBg = colors.warning;
          dotBorder = colors.warning;
        } else if (isMissed) {
          dotBg = colors.red;
          dotBorder = colors.red;
        } else if (isToday) {
          dotBg = colors.primary;
          dotBorder = colors.primary;
        } else {
          dotBg = "transparent";
          dotBorder = colors.borderStrong;
        }

        const abbr = DAY_LABEL[d].slice(0, 2);

        return (
          <Pressable
            key={d}
            onPress={() => (isTraining ? onPressDay(d) : undefined)}
            onLongPress={() => (canSkip ? onLongPressDay(d) : undefined)}
            delayLongPress={400}
            style={[styles.stripSlot, { width: slotWidth }]}
          >
            <View
              style={[
                styles.stripDot,
                { backgroundColor: dotBg, borderColor: dotBorder },
                isToday && styles.stripDotToday,
              ]}
            />
            <Text
              style={[
                styles.stripDayLabel,
                isToday && { color: colors.primary, fontWeight: "700" },
                !isTraining && { color: colors.textMuted },
              ]}
            >
              {abbr}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    strip: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 14,
  },
    stripSlot: {
    alignItems: "center",
    gap: 6,
  },
    stripDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
    stripDotToday: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
    stripDayLabel: {
    fontSize: s(11),
    fontWeight: "500",
    color: colors.textSecondary,
  },
  });
