import { CopyPlus, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  copyFoodEntriesToDate,
  getFoodEntriesForDate,
  getNutritionGoalForDate,
} from "../../db/queries";
import { formatHeaderDate } from "./helpers";
import { todayISO } from "../../utils/date";
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
  onCopied,
}: {
  date: string | null;
  onClose: () => void;
  /** Called after entries are copied onto today, so the log can reload. */
  onCopied?: () => void;
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

  const [copying, setCopying] = useState(false);
  const today = todayISO();
  const isToday = date === today;

  const onCopy = () => {
    if (!date || entries.length === 0 || copying) return;
    const n = entries.length;
    Alert.alert(
      "Copy to today?",
      `Adds ${n} ${n === 1 ? "entry" : "entries"} from ${formatHeaderDate(
        date,
      )} to today's log. Anything already logged today stays.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Copy",
          onPress: async () => {
            setCopying(true);
            try {
              await copyFoodEntriesToDate(date, today);
              onCopied?.();
              onClose();
            } catch {
              Alert.alert("Copy failed", "Could not copy those entries.");
            } finally {
              setCopying(false);
            }
          },
        },
      ],
    );
  };

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
          {/* Hidden when viewing today: copying a day onto itself would just
              duplicate every entry. */}
          {entries.length > 0 && !isToday ? (
            <Pressable
              onPress={onCopy}
              disabled={copying}
              style={({ pressed }) => [
                styles.copyBtn,
                copying && { opacity: 0.5 },
                pressed && !copying && { opacity: 0.85 },
              ]}
            >
              <CopyPlus size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.copyBtnText}>
                {copying ? "Copying…" : "Copy to today"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSheetStyles(s),
  ...makeEntryRowStyles(s),
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  copyBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  });
