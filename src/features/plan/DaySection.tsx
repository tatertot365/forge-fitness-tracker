import { Copy, Plus, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
} from "react-native-reanimated";
import { reorderGroupsInDay } from "../../db/queries";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import {
  DAY_LABEL,
  type Day,
  type DayPlan,
  type Exercise,
  type MuscleGroup,
} from "../../types";
import { hapticSuccess } from "../../utils/haptics";
import { makeDs } from "./planStyles";
import { ITEM_HEIGHT, GROUP_LABEL_HEIGHT } from "./constants";
import { DraggableGroupContainer } from "./DraggableGroupContainer";

// ─── DaySection ───────────────────────────────────────────────────────────────

type DaySectionProps = {
  day: Day;
  plan: DayPlan;
  exercises: Exercise[];
  onToggle: (enabled: boolean) => void;
  onFocusBlur: (focus: string) => void;
  onAdd: () => void;
  onCopy: () => void;
  onDeleteGroup: (mg: MuscleGroup) => void;
  onClearDay: () => void;
  onEditExercise: (ex: Exercise) => void;
};

export function DaySection({
  day,
  plan,
  exercises,
  onToggle,
  onFocusBlur,
  onAdd,
  onCopy,
  onDeleteGroup,
  onClearDay,
  onEditExercise,
}: DaySectionProps) {
  const ds = useStyles(makeDs);
  const [focusText, setFocusText] = useState(plan.name);
  const enabled = !!plan.enabled;

  useEffect(() => {
    setFocusText(plan.name);
  }, [plan.name]);

  const grouped: { mg: MuscleGroup; items: Exercise[] }[] = [];
  const seen = new Map<MuscleGroup, Exercise[]>();
  for (const ex of exercises) {
    const mg = ex.muscle_group;
    if (!seen.has(mg)) {
      const arr: Exercise[] = [];
      seen.set(mg, arr);
      grouped.push({ mg, items: arr });
    }
    seen.get(mg)!.push(ex);
  }

  const [localGroupOrder, setLocalGroupOrder] = useState<number[]>(() =>
    grouped.map((_, i) => i),
  );
  const activeGroupIdx = useSharedValue(-1);
  const groupDragTranslation = useSharedValue(0);

  useEffect(() => {
    setLocalGroupOrder(grouped.map((_, i) => i));
    activeGroupIdx.value = -1;
    groupDragTranslation.value = 0;
  }, [exercises]);

  const groupHeights = grouped.map(
    (g) => GROUP_LABEL_HEIGHT + g.items.length * ITEM_HEIGHT,
  );

  const onGroupDrop = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      hapticSuccess();

      setLocalGroupOrder((prev) => {
        const next = [...prev];
        const [removed] = next.splice(from, 1);
        next.splice(to, 0, removed);

        // Flatten exercises in new group order and reassign sort_orders sequentially
        const flatExercises = next.flatMap(
          (origGroupIdx) => grouped[origGroupIdx].items,
        );
        const updates = flatExercises.map((ex, i) => ({
          id: ex.id,
          sort_order: i,
        }));
        reorderGroupsInDay(updates);

        return next;
      });
    },
    [grouped],
  );

  const orderedGroups = (
    localGroupOrder.length === grouped.length
      ? localGroupOrder
      : grouped.map((_, i) => i)
  )
    .map((origIdx) => grouped[origIdx])
    .filter(Boolean) as { mg: MuscleGroup; items: Exercise[] }[];

  const orderedHeights = (
    localGroupOrder.length === grouped.length
      ? localGroupOrder
      : grouped.map((_, i) => i)
  ).map((origIdx) => groupHeights[origIdx]);

  return (
    <View style={ds.card}>
      <View style={ds.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[ds.dayName, !enabled && ds.dayNameDisabled]}>
            {DAY_LABEL[day]}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.card}
        />
      </View>

      <TextInput
        value={focusText}
        onChangeText={setFocusText}
        onBlur={() => onFocusBlur(focusText)}
        editable={enabled}
        placeholder={enabled ? "e.g. Push day" : "—"}
        placeholderTextColor={colors.textMuted}
        style={[ds.focusInput, !enabled && ds.focusInputDisabled]}
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      {orderedGroups.length > 0 && (
        <View style={ds.exercisesBlock}>
          {orderedGroups.map(({ mg, items }, displayIdx) => (
            <DraggableGroupContainer
              key={mg}
              mg={mg}
              exercises={items}
              displayIdx={displayIdx}
              groupHeights={orderedHeights}
              activeGroupIdx={activeGroupIdx}
              groupDragTranslation={groupDragTranslation}
              isFirst={displayIdx === 0}
              onEdit={onEditExercise}
              onGroupDrop={onGroupDrop}
              onDeleteGroup={onDeleteGroup}
            />
          ))}
        </View>
      )}

      {enabled && (
        <View style={ds.dayActions}>
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              ds.addBtn,
              { flex: 1 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Plus size={13} color={colors.primary} strokeWidth={2.5} />
            <Text style={ds.addBtnText}>Add exercise</Text>
          </Pressable>
          {exercises.length > 0 && (
            <>
              <Pressable
                onPress={onCopy}
                style={({ pressed }) => [ds.copyBtn, pressed && { opacity: 0.7 }]}
              >
                <Copy size={13} color={colors.textSecondary} strokeWidth={2} />
                <Text style={ds.copyBtnText}>Copy to…</Text>
              </Pressable>
              <Pressable
                onPress={onClearDay}
                style={({ pressed }) => [ds.copyBtn, pressed && { opacity: 0.7 }]}
              >
                <Trash2 size={13} color={colors.red} strokeWidth={2} />
                <Text style={[ds.copyBtnText, { color: colors.red }]}>
                  Clear day
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}
