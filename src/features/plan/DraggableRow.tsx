import { GripVertical } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { colors, muscleAccent } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import {
  type Exercise,
  type MuscleGroup,
} from "../../types";
import { hapticSelect } from "../../utils/haptics";
import { makeDs } from "./planStyles";
import { ITEM_HEIGHT } from "./constants";

// ─── DraggableRow ─────────────────────────────────────────────────────────────

export function DraggableRow({
  exercise,
  mg,
  displayIdx,
  totalCount,
  isLastInGroup,
  activeIdx,
  dragTranslation,
  onEdit,
  onDrop,
  onMeasureHeight,
}: {
  exercise: Exercise;
  mg: MuscleGroup;
  displayIdx: number;
  totalCount: number;
  isLastInGroup: boolean;
  activeIdx: SharedValue<number>;
  dragTranslation: SharedValue<number>;
  onEdit: (ex: Exercise) => void;
  onDrop: (from: number, to: number) => void;
  onMeasureHeight?: (h: number) => void;
}) {
  const ds = useStyles(makeDs);
  const animStyle = useAnimatedStyle(() => {
    const n = totalCount;
    const H = ITEM_HEIGHT;

    if (activeIdx.value === -1) {
      return {
        transform: [{ translateY: 0 }, { scale: 1 }],
        zIndex: 0,
        shadowOpacity: 0,
      };
    }

    if (activeIdx.value === displayIdx) {
      return {
        transform: [{ translateY: dragTranslation.value }, { scale: 1.02 }],
        zIndex: 20,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      };
    }

    const from = activeIdx.value;
    const target = Math.max(
      0,
      Math.min(n - 1, Math.round((from * H + dragTranslation.value) / H)),
    );

    let shift = 0;
    if (from < target && displayIdx > from && displayIdx <= target) {
      shift = -H;
    } else if (from > target && displayIdx >= target && displayIdx < from) {
      shift = H;
    }

    return {
      transform: [
        { translateY: withSpring(shift, { damping: 22, stiffness: 320 }) },
        { scale: 1 },
      ],
      zIndex: 0,
      shadowOpacity: 0,
    };
  });

  const gesture = Gesture.Exclusive(
    Gesture.Pan()
      .activateAfterLongPress(300)
      .onStart(() => {
        activeIdx.value = displayIdx;
        dragTranslation.value = 0;
        runOnJS(hapticSelect)();
      })
      .onUpdate((e) => {
        if (activeIdx.value === displayIdx) {
          dragTranslation.value = e.translationY;
        }
      })
      .onEnd((e) => {
        if (activeIdx.value === displayIdx) {
          const target = Math.max(
            0,
            Math.min(
              totalCount - 1,
              Math.round(
                (displayIdx * ITEM_HEIGHT + e.translationY) / ITEM_HEIGHT,
              ),
            ),
          );
          activeIdx.value = -1;
          dragTranslation.value = 0;
          runOnJS(onDrop)(displayIdx, target);
        }
      })
      .onFinalize(() => {
        if (activeIdx.value === displayIdx) {
          activeIdx.value = -1;
          dragTranslation.value = 0;
        }
      }),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        onEdit(exercise);
      }),
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={
          onMeasureHeight
            ? (e) => onMeasureHeight(e.nativeEvent.layout.height)
            : undefined
        }
        style={[
          ds.exerciseRow,
          !isLastInGroup && ds.exerciseDivider,
          { backgroundColor: colors.card },
          animStyle,
        ]}
      >
        <View
          style={[
            ds.accentBar,
            { backgroundColor: muscleAccent[mg] ?? colors.primary },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={ds.exerciseName} numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text style={ds.exerciseMeta}>
            {exercise.sets} sets · {exercise.rep_range}
            {exercise.warmup_sets ? ` · ${exercise.warmup_sets}W` : ""}
            {exercise.type === "superset" ? " · SS" : ""}
          </Text>
        </View>
        <GripVertical size={16} color={colors.textMuted} strokeWidth={1.5} />
      </Animated.View>
    </GestureDetector>
  );
}
