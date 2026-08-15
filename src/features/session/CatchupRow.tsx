import { AlertTriangle, Clock, SkipForward } from "lucide-react-native";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors, muscleAccent } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { DAY_LABEL, MUSCLE_LABEL, type CatchupItem } from "../../types";
import { hapticTap } from "../../utils/haptics";

// A catch-up item this old is surfaced as "at risk" rather than "Nd ago".
const AT_RISK_DAYS = 3;

export function isAtRisk(item: CatchupItem): boolean {
  return item.days_ago >= AT_RISK_DAYS;
}

/**
 * One missed exercise from earlier in the week. Shared by the Home screen's
 * catch-up queue and the Today screen's catch-up dropdown.
 */
export function CatchupRow({
  item,
  onPress,
}: {
  item: CatchupItem;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const atRisk = isAtRisk(item);
  const Icon = atRisk ? AlertTriangle : Clock;
  const iconColor = atRisk ? colors.warning : colors.gray;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.catchRow, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.catchAccent,
          {
            backgroundColor: muscleAccent[item.muscle_group] ?? colors.primary,
          },
        ]}
      />
      <View style={{ flex: 1, paddingVertical: 12, paddingRight: 16, gap: 2 }}>
        <Text style={styles.catchName}>{item.exercise_name}</Text>
        <Text style={styles.catchMeta}>
          {DAY_LABEL[item.day]} · {item.sets_missed} set
          {item.sets_missed === 1 ? "" : "s"} ·{" "}
          {MUSCLE_LABEL[item.muscle_group]}
        </Text>
      </View>
      <View style={styles.catchTrailing}>
        <Icon size={16} color={iconColor} strokeWidth={2} />
        <Text style={[styles.catchTrailingText, { color: iconColor }]}>
          {atRisk ? "at risk" : `${item.days_ago}d ago`}
        </Text>
      </View>
    </Pressable>
  );
}

/** CatchupRow with a swipe-left-to-skip action. */
export function SwipeableCatchupRow({
  item,
  onPress,
  onSkip,
}: {
  item: CatchupItem;
  onPress: () => void;
  onSkip: () => void;
}) {
  const styles = useStyles(makeStyles);
  const ref = useRef<SwipeableMethods>(null);

  const handleSkip = () => {
    hapticTap();
    ref.current?.close();
    onSkip();
  };

  const renderRight = () => (
    <Pressable
      onPress={handleSkip}
      style={({ pressed }) => [styles.skipAction, pressed && { opacity: 0.85 }]}
    >
      <SkipForward size={18} color="#FFFFFF" strokeWidth={2} />
      <Text style={styles.skipLabel}>Skip</Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <CatchupRow item={item} onPress={onPress} />
    </ReanimatedSwipeable>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  catchRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  catchAccent: {
    width: 3,
    marginVertical: 10,
    marginLeft: 10,
    borderRadius: radius.accent,
    marginRight: 12,
  },
  catchName: { ...typography.exerciseName, fontSize: s(14), color: colors.text },
  catchMeta: { ...typography.caption, fontSize: s(12), color: colors.textSecondary },
  catchTrailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 14,
    gap: 2,
  },
  catchTrailingText: { fontSize: s(11), fontWeight: "600" },
  skipAction: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.gray,
    borderRadius: radius.card,
    marginLeft: 6,
  },
  skipLabel: {
    color: "#FFFFFF",
    fontSize: s(11),
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
