import { Trash2 } from "lucide-react-native";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors } from "../../theme/colors";
import { makeEntryRowStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import {
  type FoodEntry,
} from "../../types";

export function SwipeableFoodRow({
  entry,
  isLast,
  onDelete,
  onEdit,
}: {
  entry: FoodEntry;
  isLast: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const styles = useStyles(makeStyles);
  const ref = useRef<SwipeableMethods>(null);
  const renderRight = () => (
    <View style={styles.swipeActions}>
      <Pressable
        onPress={() => {
          ref.current?.close();
          onDelete();
        }}
        style={({ pressed }) => [
          styles.swipeAction,
          { backgroundColor: colors.red },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Trash2 size={18} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.swipeLabel}>Delete</Text>
      </Pressable>
    </View>
  );
  return (
    <ReanimatedSwipeable
      ref={ref}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.entryRow,
          !isLast && styles.entryRowDivider,
          pressed && { backgroundColor: "rgba(0,0,0,0.02)" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.entryName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.entryMeta}>
            P {Math.round(entry.protein_g)}g · F {Math.round(entry.fat_g)}g · C{" "}
            {Math.round(entry.carbs_g)}g
          </Text>
        </View>
        <Text style={styles.entryCal}>
          {Math.round(entry.calories).toLocaleString()}
          <Text style={styles.entryCalUnit}> cal</Text>
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeEntryRowStyles(s),
    swipeAction: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
    swipeActions: {
    width: 76,
    flexDirection: "row",
  },
    swipeLabel: {
    color: "#FFFFFF",
    fontSize: s(11),
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  });
