import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
} from "react-native-reanimated";
import { reorderExercisesInGroup } from "../../db/queries";
import {
  type Exercise,
  type MuscleGroup,
} from "../../types";
import { hapticSuccess } from "../../utils/haptics";
import { ITEM_HEIGHT } from "./constants";
import { DraggableRow } from "./DraggableRow";

// ─── DraggableExerciseGroup ───────────────────────────────────────────────────

export function DraggableExerciseGroup({
  mg,
  exercises,
  onEdit,
}: {
  mg: MuscleGroup;
  exercises: Exercise[];
  onEdit: (ex: Exercise) => void;
}) {
  const [localOrder, setLocalOrder] = useState<number[]>(() =>
    exercises.map((_, i) => i),
  );
  const activeIdx = useSharedValue(-1);
  const dragTranslation = useSharedValue(0);
  const measuredHeight = useRef(ITEM_HEIGHT);

  useEffect(() => {
    setLocalOrder(exercises.map((_, i) => i));
    activeIdx.value = -1;
    dragTranslation.value = 0;
  }, [exercises]);

  const onDrop = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      hapticSuccess();

      setLocalOrder((prev) => {
        const next = [...prev];
        const [removed] = next.splice(from, 1);
        next.splice(to, 0, removed);

        // Reassign sort_orders: new position i gets the sort_order that was at position i
        const originalSortOrders = exercises.map((e) => e.sort_order);
        const updates = next.map((origIdx, newPos) => ({
          id: exercises[origIdx].id,
          sort_order: originalSortOrders[newPos],
        }));
        reorderExercisesInGroup(updates);

        return next;
      });
    },
    [exercises],
  );

  return (
    <View>
      {(localOrder.length === exercises.length
        ? localOrder
        : exercises.map((_, i) => i)
      ).map((origIdx, displayIdx) => {
        const ex = exercises[origIdx];
        if (!ex) return null;
        return (
          <DraggableRow
            key={ex.id}
            exercise={ex}
            mg={mg}
            displayIdx={displayIdx}
            totalCount={exercises.length}
            isLastInGroup={displayIdx === exercises.length - 1}
            activeIdx={activeIdx}
            dragTranslation={dragTranslation}
            onEdit={onEdit}
            onDrop={onDrop}
            onMeasureHeight={
              displayIdx === 0
                ? (h) => {
                    measuredHeight.current = h;
                  }
                : undefined
            }
          />
        );
      })}
    </View>
  );
}
