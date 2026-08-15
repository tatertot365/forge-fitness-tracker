import { X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getFoodEntriesForDate, getNutritionGoalForDate } from "../../db/queries";
import { formatHeaderDate } from "./helpers";
import { colors } from "../../theme/colors";
import { makeSheetStyles, makeEntryRowStyles } from "../../theme/sheets";
import { useStyles } from "../../theme/useStyles";
import {
  type FoodEntry,
  type NutritionGoal,
} from "../../types";

export function DayHistorySheet({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);

  React.useEffect(() => {
    if (!date) {
      setEntries([]);
      setGoal(null);
      return;
    }
    (async () => {
      const [e, g] = await Promise.all([
        getFoodEntriesForDate(date),
        getNutritionGoalForDate(date),
      ]);
      setEntries(e);
      setGoal(g);
    })();
  }, [date]);

  const totalCals = entries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = entries.reduce((s, e) => s + e.protein_g, 0);
  const totalFat = entries.reduce((s, e) => s + e.fat_g, 0);
  const totalCarbs = entries.reduce((s, e) => s + e.carbs_g, 0);

  return (
    <Modal
      visible={!!date}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: "75%" }]}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {date ? formatHeaderDate(date) : ""}
              </Text>
              {goal ? (
                <Text style={styles.sheetSubtitle}>
                  {Math.round(totalCals).toLocaleString()} /{" "}
                  {Math.round(goal.calorie_goal).toLocaleString()} cal
                  {" · "}P {Math.round(totalProtein)} /{" "}
                  {Math.round(goal.protein_goal)}g{" · "}F{" "}
                  {Math.round(totalFat)} / {Math.round(goal.fat_goal)}g{" · "}C{" "}
                  {Math.round(totalCarbs)} / {Math.round(goal.carbs_goal)}g
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          >
            {entries.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged this day.</Text>
            ) : (
              entries.map((e, i) => (
                <View
                  key={e.id}
                  style={[
                    styles.entryRow,
                    i < entries.length - 1 && styles.entryRowDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.entryMeta}>
                      P {Math.round(e.protein_g)}g · F {Math.round(e.fat_g)}g ·
                      C {Math.round(e.carbs_g)}g
                    </Text>
                  </View>
                  <Text style={styles.entryCal}>
                    {Math.round(e.calories).toLocaleString()}
                    <Text style={styles.entryCalUnit}> cal</Text>
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSheetStyles(s),
  ...makeEntryRowStyles(s),
  });
