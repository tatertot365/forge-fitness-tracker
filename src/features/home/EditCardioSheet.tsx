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
import { colors } from "../../theme/colors";
import { type CardioInfo } from "../../db/queries";
import { useStyles } from "../../theme/useStyles";
import { makeSharedStyles } from "./sharedStyles";

// ── Edit cardio sheet ─────────────────────────────────────────────────────────

export function EditCardioSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: CardioInfo;
  onClose: () => void;
  onSave: (info: CardioInfo) => Promise<void>;
}) {
  const styles = useStyles(makeStyles);
  const [name, setName] = useState(current.name);
  const [description, setDescription] = useState(current.description);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(current.name);
      setDescription(current.description);
    }
  }, [visible, current.name, current.description]);

  const handleSave = async () => {
    const trimName = name.trim();
    if (!trimName || busy) return;
    setBusy(true);
    try {
      await onSave({ name: trimName, description: description.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
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
              <Text style={styles.sheetTitle}>Edit Cardio</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Exercise name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.fieldInput}
              placeholder="e.g. Incline treadmill walk"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoFocus
            />

            <Text style={styles.fieldLabel}>Details</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={styles.fieldInput}
              placeholder="e.g. 12° / 3 mph / 20–30 min"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable
              onPress={handleSave}
              disabled={busy || !name.trim()}
              style={({ pressed }) => [
                styles.sheetSaveBtn,
                (busy || !name.trim()) && { opacity: 0.5 },
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
