import { GripVertical, Trash2 } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import {
  MUSCLE_LABEL,
  type Exercise,
  type MuscleGroup,
} from "../../types";
import { hapticSelect } from "../../utils/haptics";
import { makeDs } from "./planStyles";
import { DraggableExerciseGroup } from "./DraggableExerciseGroup";

// ─── DraggableGroupContainer ──────────────────────────────────────────────────

export function DraggableGroupContainer({
  mg,
  exercises,
  displayIdx,
  groupHeights,
  activeGroupIdx,
  groupDragTranslation,
  isFirst,
  onEdit,
  onGroupDrop,
  onDeleteGroup,
}: {
  mg: MuscleGroup;
  exercises: Exercise[];
  displayIdx: number;
  groupHeights: number[];
  activeGroupIdx: SharedValue<number>;
  groupDragTranslation: SharedValue<number>;
  isFirst: boolean;
  onEdit: (ex: Exercise) => void;
  onGroupDrop: (from: number, to: number) => void;
  onDeleteGroup: (mg: MuscleGroup) => void;
}) {
  const ds = useStyles(makeDs);
  const totalGroups = groupHeights.length;

  const animStyle = useAnimatedStyle(() => {
    if (activeGroupIdx.value === -1) {
      return {
        transform: [{ translateY: 0 }, { scale: 1 }],
        zIndex: 0,
        shadowOpacity: 0,
      };
    }

    const from = activeGroupIdx.value;
    const drag = groupDragTranslation.value;

    if (from === displayIdx) {
      return {
        transform: [{ translateY: drag }, { scale: 1.01 }],
        zIndex: 20,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      };
    }

    // Compute cumulative start positions of each group
    let acc = 0;
    const starts: number[] = [];
    for (let i = 0; i < totalGroups; i++) {
      starts.push(acc);
      acc += groupHeights[i];
    }

    // Center of the dragged group in its current dragged position
    const draggedCenter = starts[from] + groupHeights[from] / 2 + drag;

    // Find which slot the dragged group's center is over
    let target = from;
    for (let i = 0; i < totalGroups; i++) {
      if (
        draggedCenter >= starts[i] &&
        draggedCenter < starts[i] + groupHeights[i]
      ) {
        target = i;
        break;
      }
    }
    if (draggedCenter < 0) target = 0;
    if (draggedCenter >= acc) target = totalGroups - 1;

    let shift = 0;
    if (from < target && displayIdx > from && displayIdx <= target) {
      shift = -groupHeights[from];
    } else if (from > target && displayIdx >= target && displayIdx < from) {
      shift = groupHeights[from];
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

  const dragHandle = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      activeGroupIdx.value = displayIdx;
      groupDragTranslation.value = 0;
      runOnJS(hapticSelect)();
    })
    .onUpdate((e) => {
      if (activeGroupIdx.value === displayIdx) {
        groupDragTranslation.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (activeGroupIdx.value === displayIdx) {
        // Recompute target on end
        let acc = 0;
        const starts: number[] = [];
        for (let i = 0; i < totalGroups; i++) {
          starts.push(acc);
          acc += groupHeights[i];
        }
        const draggedCenter =
          starts[displayIdx] + groupHeights[displayIdx] / 2 + e.translationY;
        let target = displayIdx;
        for (let i = 0; i < totalGroups; i++) {
          if (
            draggedCenter >= starts[i] &&
            draggedCenter < starts[i] + groupHeights[i]
          ) {
            target = i;
            break;
          }
        }
        if (draggedCenter < 0) target = 0;
        if (draggedCenter >= acc) target = totalGroups - 1;

        activeGroupIdx.value = -1;
        groupDragTranslation.value = 0;
        runOnJS(onGroupDrop)(displayIdx, target);
      }
    })
    .onFinalize(() => {
      if (activeGroupIdx.value === displayIdx) {
        activeGroupIdx.value = -1;
        groupDragTranslation.value = 0;
      }
    });

  return (
    <Animated.View style={animStyle}>
      <View style={[ds.muscleLabelRow, isFirst && { marginTop: 4 }]}>
        <GestureDetector gesture={dragHandle}>
          <View style={ds.groupGripArea} hitSlop={8}>
            <GripVertical
              size={14}
              color={colors.textMuted}
              strokeWidth={1.5}
            />
          </View>
        </GestureDetector>
        <Text style={[ds.muscleLabel, { flex: 1 }]}>{MUSCLE_LABEL[mg]}</Text>
        <Pressable
          onPress={() => onDeleteGroup(mg)}
          hitSlop={10}
          accessibilityLabel={`Delete ${MUSCLE_LABEL[mg]} group`}
          style={({ pressed }) => [
            ds.groupDeleteBtn,
            pressed && { opacity: 0.5 },
          ]}
        >
          <Trash2 size={13} color={colors.textMuted} strokeWidth={1.75} />
        </Pressable>
      </View>
      <DraggableExerciseGroup mg={mg} exercises={exercises} onEdit={onEdit} />
    </Animated.View>
  );
}
