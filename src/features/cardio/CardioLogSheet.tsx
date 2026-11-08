import DateTimePicker from "@react-native-community/datetimepicker";
import { Heart, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  addCardioSession,
  deleteCardioSession,
  updateCardioSession,
} from "../../db/queries";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import { type CardioSession } from "../../types";
import { fromISO, toISO, todayISO } from "../../utils/date";
import { formatDuration, parseDuration } from "../../utils/duration";
import { hapticSuccess, hapticTap } from "../../utils/haptics";
import { makeSharedStyles } from "../home/sharedStyles";
import { ActivityChips } from "./ActivityChips";
import { DEFAULT_CARDIO_ACTIVITY } from "./activities";
import { removeCardioFromHealth, syncCardioToHealth } from "./healthCardio";

export type CardioLogTarget =
  | {
      kind: "new";
      activity: string | null;
      /** From the live timer: exact time, and when it started. */
      durationSeconds?: number;
      startedAt?: string;
    }
  | { kind: "edit"; session: CardioSession };

/**
 * Cardio minutes as typed. A bare number is minutes ("30"), since that's how
 * cardio is talked about; "32:41" is minutes:seconds, as the timer fills it.
 */
function parseCardioDuration(text: string): number | null {
  const t = text.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60);
  return parseDuration(t);
}

function durationText(seconds: number | null | undefined): string {
  if (!seconds) return "";
  return seconds % 60 === 0 ? String(seconds / 60) : formatDuration(seconds);
}

export function CardioLogSheet({
  target,
  onClose,
  onSaved,
}: {
  /** Null hides the sheet. */
  target: CardioLogTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useStyles(makeStyles);
  const editing = target?.kind === "edit" ? target.session : null;
  const fromHealth = editing?.source === "health";

  const [activity, setActivity] = useState(DEFAULT_CARDIO_ACTIVITY);
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [busy, setBusy] = useState(false);

  // Re-seed every time the sheet opens on a new target.
  useEffect(() => {
    if (!target) return;
    if (target.kind === "edit") {
      const s = target.session;
      setActivity(s.activity ?? DEFAULT_CARDIO_ACTIVITY);
      setDate(s.date);
      setDuration(durationText(s.duration_seconds));
      setDistance(s.distance_mi != null ? String(s.distance_mi) : "");
    } else {
      setActivity(target.activity ?? DEFAULT_CARDIO_ACTIVITY);
      setDate(todayISO());
      setDuration(durationText(target.durationSeconds));
      setDistance("");
    }
  }, [target]);

  const seconds = parseCardioDuration(duration);
  const miles = distance.trim() === "" ? null : Number(distance);
  const distanceOk = miles == null || (Number.isFinite(miles) && miles >= 0);
  const canSave = seconds != null && seconds > 0 && distanceOk && !busy;

  const save = async () => {
    if (!target || !canSave) return;
    setBusy(true);
    try {
      let id: number;
      if (target.kind === "edit") {
        id = target.session.id;
        await updateCardioSession(id, {
          date,
          activity,
          duration_seconds: seconds,
          distance_mi: miles,
        });
      } else {
        id = await addCardioSession({
          date,
          activity,
          duration_seconds: seconds,
          distance_mi: miles,
          // Only meaningful while the date is the day it was timed.
          started_at: date === todayISO() ? target.startedAt ?? null : null,
        });
      }
      // Not awaited: Health is a mirror and must never hold up the log.
      syncCardioToHealth(id);
      hapticSuccess();
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert(
      "Delete this session?",
      fromHealth
        ? "It's removed from Forge. The workout stays in Apple Health."
        : "It's removed from Forge, and from Apple Health if Forge saved it there.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeCardioFromHealth(editing);
            await deleteCardioSession(editing.id);
            hapticTap();
            onSaved();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={!!target}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editing ? "Edit cardio" : "Log cardio"}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {fromHealth ? (
                <View style={styles.healthNote}>
                  <Heart size={12} color={colors.red} strokeWidth={2} />
                  <Text style={styles.healthNoteText}>
                    Added from Apple Health. Edits here stay in Forge.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Activity</Text>
              <ActivityChips value={activity} onChange={setActivity} />

              <View style={styles.dateRow}>
                <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>
                  Date
                </Text>
                <DateTimePicker
                  value={fromISO(date)}
                  mode="date"
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  maximumDate={new Date()}
                  themeVariant="dark"
                  accentColor={colors.primary}
                  onChange={(_, d) => {
                    if (d) setDate(toISO(d));
                  }}
                />
              </View>

              <View style={styles.pairRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Minutes</Text>
                  <TextInput
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="numbers-and-punctuation"
                    style={styles.fieldInput}
                    placeholder="30"
                    placeholderTextColor={colors.textMuted}
                    selectTextOnFocus
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Distance (mi)</Text>
                  <TextInput
                    value={distance}
                    onChangeText={setDistance}
                    keyboardType="decimal-pad"
                    style={styles.fieldInput}
                    placeholder="Optional"
                    placeholderTextColor={colors.textMuted}
                    selectTextOnFocus
                  />
                </View>
              </View>

              <Pressable
                onPress={save}
                disabled={!canSave}
                style={({ pressed }) => [
                  styles.sheetSaveBtn,
                  !canSave && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.sheetSaveBtnText}>
                  {editing ? "Save" : "Log session"}
                </Text>
              </Pressable>

              {editing ? (
                <Pressable
                  onPress={confirmDelete}
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.deleteText}>Delete session</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    ...makeSharedStyles(s),
    // Matches CardioPlanSheet's fields.
    fieldLabel: {
      fontSize: s(11),
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontWeight: "600",
      marginTop: 14,
      marginBottom: 6,
    },
    fieldInput: {
      fontSize: s(15),
      color: colors.text,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    pairRow: { flexDirection: "row", gap: 10 },
    healthNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
    },
    healthNoteText: { fontSize: s(12), color: colors.textSecondary },
    deleteBtn: { alignItems: "center", paddingVertical: 14 },
    deleteText: { fontSize: s(14), fontWeight: "600", color: colors.red },
  });
