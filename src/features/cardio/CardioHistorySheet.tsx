import { ChevronRight, Heart, Plus, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCardioSessions } from "../../db/queries";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { type CardioSession } from "../../types";
import { fromISO, toISO, todayISO } from "../../utils/date";
import { formatDuration } from "../../utils/duration";
import { hapticSuccess } from "../../utils/haptics";
import { makeSharedStyles } from "../home/sharedStyles";
import { cardioLabel } from "./activities";
import { CardioLogSheet, type CardioLogTarget } from "./CardioLogSheet";
import {
  addCardioFromHealth,
  getHealthCardioSuggestions,
  type CardioSuggestion,
} from "./healthCardio";

function dayLabel(iso: string): string {
  if (iso === todayISO()) return "Today";
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function details(seconds: number | null, miles: number | null): string {
  const parts: string[] = [];
  if (seconds) {
    parts.push(seconds % 60 === 0 ? `${seconds / 60} min` : formatDuration(seconds));
  }
  if (miles) parts.push(`${miles} mi`);
  return parts.join(" · ") || "No details";
}

/**
 * Every logged cardio session, newest first, each tappable to edit or delete.
 * Above the list, cardio the Apple Watch recorded this week that isn't in
 * Forge yet, one tap to add.
 *
 * Owns its edit sheet: iOS can only stack a second modal when it's rendered
 * inside the first, so the edit sheet lives in this one's tree.
 */
export function CardioHistorySheet({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  /** Something was added, edited or deleted; refresh the week's totals. */
  onChanged: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [sessions, setSessions] = useState<CardioSession[] | null>(null);
  const [suggestions, setSuggestions] = useState<CardioSuggestion[]>([]);
  const [editing, setEditing] = useState<CardioLogTarget | null>(null);

  const load = useCallback(async () => {
    const [s, sug] = await Promise.all([
      getCardioSessions(60),
      getHealthCardioSuggestions(),
    ]);
    setSessions(s);
    setSuggestions(sug);
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const add = async (w: CardioSuggestion) => {
    await addCardioFromHealth(w);
    hapticSuccess();
    await load();
    onChanged();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: "80%" }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Cardio history</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {sessions == null ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.textSecondary} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {suggestions.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Found in Apple Health</Text>
                  <View style={styles.card}>
                    {suggestions.map((w, i) => (
                      <View
                        key={w.uuid}
                        style={[styles.row, i > 0 && styles.rowDivider]}
                      >
                        <Heart size={14} color={colors.red} strokeWidth={2} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{cardioLabel(w.activity)}</Text>
                          <Text style={styles.rowMeta}>
                            {dayLabel(toISO(w.start))}{" "}
                            ·{" "}
                            {details(
                              Math.round((w.end.getTime() - w.start.getTime()) / 1000),
                              w.distanceMi,
                            )}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => add(w)}
                          hitSlop={8}
                          accessibilityLabel={`Add ${cardioLabel(w.activity)} to Forge`}
                          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
                        >
                          <Plus size={13} color="#FFFFFF" strokeWidth={2.5} />
                          <Text style={styles.addText}>Add</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionLabel}>Logged</Text>
              {sessions.length === 0 ? (
                <Text style={styles.empty}>No cardio logged yet.</Text>
              ) : (
                <View style={styles.card}>
                  {sessions.map((c, i) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setEditing({ kind: "edit", session: c })}
                      style={({ pressed }) => [
                        styles.row,
                        i > 0 && styles.rowDivider,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{cardioLabel(c.activity)}</Text>
                        <Text style={styles.rowMeta}>
                          {dayLabel(c.date)} · {details(c.duration_seconds, c.distance_mi)}
                        </Text>
                      </View>
                      {c.source === "health" ? (
                        <Heart size={12} color={colors.textMuted} strokeWidth={2} />
                      ) : null}
                      <ChevronRight size={16} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      <CardioLogSheet
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
          onChanged();
        }}
      />
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    ...makeSharedStyles(s),
    sectionLabel: {
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
      marginTop: 14,
      marginBottom: 6,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowTitle: { fontSize: s(14), fontWeight: "500", color: colors.text },
    rowMeta: { fontSize: s(12), color: colors.textSecondary, marginTop: 2 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    addText: { color: "#FFFFFF", fontSize: s(12), fontWeight: "600" },
    empty: {
      fontSize: s(13),
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 24,
    },
  });
