import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { X } from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../../theme/colors";
import {
  exportFoodLogCSV,
  exportMeasurementsCSV,
  exportSessionsCSV,
} from "../../db/queries";
import { useStyles } from "../../theme/useStyles";
import {
  type Measurement,
} from "../../types";
import { makeSharedStyles } from "./sharedStyles";

// ── Export sheet ──────────────────────────────────────────────────────────────

export function ExportSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  const [sessions, setSessions] = useState(true);
  const [nutrition, setNutrition] = useState(true);
  const [measurements, setMeasurements] = useState(true);
  const [busy, setBusy] = useState(false);

  const noneSelected = !sessions && !nutrition && !measurements;

  const handleExport = async () => {
    if (noneSelected) return;
    setBusy(true);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      const files: { name: string; content: string }[] = [];
      if (sessions) {
        files.push({ name: `forge_sessions_${ts}.csv`, content: await exportSessionsCSV() });
      }
      if (nutrition) {
        files.push({ name: `forge_food_log_${ts}.csv`, content: await exportFoodLogCSV() });
      }
      if (measurements) {
        files.push({ name: `forge_measurements_${ts}.csv`, content: await exportMeasurementsCSV() });
      }
      for (const f of files) {
        const uri = FileSystem.cacheDirectory + f.name;
        await FileSystem.writeAsStringAsync(uri, f.content, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: f.name,
          UTI: 'public.comma-separated-values-text',
        });
      }
      onClose();
    } catch {
      Alert.alert('Export failed', 'Could not export data. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const CheckRow = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <Pressable onPress={onToggle} style={styles.exportCheckRow}>
      <Text style={styles.exportCheckLabel}>{label}</Text>
      <View style={[styles.exportCheckbox, value && styles.exportCheckboxChecked]}>
        {value && <Text style={styles.exportCheckmark}>✓</Text>}
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Export data</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <CheckRow label="Exercise history" value={sessions} onToggle={() => setSessions((v) => !v)} />
          <CheckRow label="Nutrition history" value={nutrition} onToggle={() => setNutrition((v) => !v)} />
          <CheckRow label="Measurement history" value={measurements} onToggle={() => setMeasurements((v) => !v)} />
          <Pressable
            onPress={handleExport}
            disabled={busy || noneSelected}
            style={({ pressed }) => [
              styles.sheetSaveBtn,
              { marginTop: 20 },
              (busy || noneSelected) && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.sheetSaveBtnText}>{busy ? 'Exporting…' : 'Export'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  ...makeSharedStyles(s),
    exportCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
    exportCheckLabel: { fontSize: s(15), fontWeight: "500", color: colors.text },
    exportCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
    exportCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
    exportCheckmark: { color: "#FFFFFF", fontSize: s(13), fontWeight: "700", lineHeight: 16 },
  });
