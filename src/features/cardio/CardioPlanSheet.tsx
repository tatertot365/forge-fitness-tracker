import { X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { type CardioPlan } from "../../db/queries";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import { makeSharedStyles } from "../home/sharedStyles";
import { ActivityChips } from "./ActivityChips";

/**
 * Edits the cardio plan: what the Home card shows, what Start times, and what
 * Log pre-fills -- so the plan is set here once instead of re-entered per log.
 */
export function CardioPlanSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: CardioPlan;
  onClose: () => void;
  onSave: (plan: CardioPlan) => Promise<void>;
}) {
  const styles = useStyles(makeStyles);
  const [activity, setActivity] = useState(current.activity);
  const [minutes, setMinutes] = useState("");
  const [details, setDetails] = useState(current.details);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setActivity(current.activity);
    setMinutes(current.minutes ? String(current.minutes) : "");
    setDetails(current.details);
  }, [visible, current]);

  const parsedMinutes = minutes.trim() === "" ? null : Number(minutes);
  const minutesOk =
    parsedMinutes == null || (Number.isFinite(parsedMinutes) && parsedMinutes > 0);

  const handleSave = async () => {
    if (busy || !minutesOk) return;
    setBusy(true);
    try {
      await onSave({
        activity,
        minutes: parsedMinutes ? Math.round(parsedMinutes) : null,
        details: details.trim(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cardio plan</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Activity</Text>
            <ActivityChips value={activity} onChange={setActivity} />

            <Text style={styles.fieldLabel}>Target minutes</Text>
            <TextInput
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              style={styles.fieldInput}
              placeholder="e.g. 30"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />

            <Text style={styles.fieldLabel}>Details</Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              style={styles.fieldInput}
              placeholder="Optional, e.g. 12° / 3 mph"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable
              onPress={handleSave}
              disabled={busy || !minutesOk}
              style={({ pressed }) => [
                styles.sheetSaveBtn,
                (busy || !minutesOk) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.sheetSaveBtnText}>Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    ...makeSharedStyles(s),
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
  });
