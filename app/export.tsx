import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { ChevronLeft, Database, FileSpreadsheet } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { SectionLabel } from "../src/components/SectionLabel";
import {
  exportFoodLogCSV,
  exportFullBackupJSON,
  exportMeasurementsCSV,
  exportSessionsCSV,
} from "../src/db/queries";
import { colors } from "../src/theme/colors";
import { radius, typography } from "../src/theme/spacing";
import { useStyles } from "../src/theme/useStyles";

// Both export paths live here: per-category CSVs for spreadsheets, and a full
// JSON backup. They used to sit on separate screens (Home header vs Settings),
// which meant "get my data out" had two unrelated answers.

export default function ExportScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();

  const [sessions, setSessions] = useState(true);
  const [nutrition, setNutrition] = useState(true);
  const [measurements, setMeasurements] = useState(true);
  const [busyCsv, setBusyCsv] = useState(false);
  const [busyBackup, setBusyBackup] = useState(false);

  const noneSelected = !sessions && !nutrition && !measurements;

  const onExportCsv = async () => {
    if (noneSelected || busyCsv) return;
    setBusyCsv(true);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      const files: { name: string; content: string }[] = [];
      if (sessions) {
        files.push({
          name: `forge_sessions_${ts}.csv`,
          content: await exportSessionsCSV(),
        });
      }
      if (nutrition) {
        files.push({
          name: `forge_food_log_${ts}.csv`,
          content: await exportFoodLogCSV(),
        });
      }
      if (measurements) {
        files.push({
          name: `forge_measurements_${ts}.csv`,
          content: await exportMeasurementsCSV(),
        });
      }
      for (const f of files) {
        const uri = FileSystem.cacheDirectory + f.name;
        await FileSystem.writeAsStringAsync(uri, f.content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          dialogTitle: f.name,
          UTI: "public.comma-separated-values-text",
        });
      }
    } catch {
      Alert.alert("Export failed", "Could not export data. Please try again.");
    } finally {
      setBusyCsv(false);
    }
  };

  const onExportBackup = async () => {
    if (busyBackup) return;
    setBusyBackup(true);
    try {
      const json = await exportFullBackupJSON();
      const ts = new Date().toISOString().slice(0, 10);
      const name = `forge_backup_${ts}.json`;
      const uri = FileSystem.cacheDirectory + name;
      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: name,
        UTI: "public.json",
      });
    } catch {
      Alert.alert(
        "Backup failed",
        "Could not export your data. Please try again.",
      );
    } finally {
      setBusyBackup(false);
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
    <Pressable onPress={onToggle} style={styles.checkRow}>
      <Text style={styles.checkLabel}>{label}</Text>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Export data</Text>
        <View style={styles.backBtn} />
      </View>

      <SectionLabel>Spreadsheet</SectionLabel>
      <View style={styles.card}>
        <View style={styles.cardIntro}>
          <FileSpreadsheet size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.cardIntroText}>
            One CSV per category, for Numbers, Excel, or Sheets.
          </Text>
        </View>
        <CheckRow
          label="Exercise history"
          value={sessions}
          onToggle={() => setSessions((v) => !v)}
        />
        <CheckRow
          label="Nutrition history"
          value={nutrition}
          onToggle={() => setNutrition((v) => !v)}
        />
        <CheckRow
          label="Measurement history"
          value={measurements}
          onToggle={() => setMeasurements((v) => !v)}
        />
        <Pressable
          onPress={onExportCsv}
          disabled={busyCsv || noneSelected}
          style={({ pressed }) => [
            styles.actionBtn,
            (busyCsv || noneSelected) && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.actionBtnText}>
            {busyCsv ? "Exporting…" : "Export CSV"}
          </Text>
        </Pressable>
      </View>

      <SectionLabel>Full backup</SectionLabel>
      <View style={styles.card}>
        <View style={styles.cardIntro}>
          <Database size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.cardIntroText}>
            A single JSON file with every workout, meal, and measurement. Share
            it to iCloud Drive, Files, or email to keep a copy.
          </Text>
        </View>
        <Pressable
          onPress={onExportBackup}
          disabled={busyBackup}
          style={({ pressed }) => [
            styles.actionBtn,
            busyBackup && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.actionBtnText}>
            {busyBackup ? "Preparing backup…" : "Export backup"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 12,
      gap: 8,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...typography.screenTitle,
      fontSize: s(22),
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    cardIntro: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingTop: 14,
      paddingBottom: 4,
    },
    cardIntroText: {
      flex: 1,
      fontSize: s(12),
      color: colors.textSecondary,
      lineHeight: 17,
    },
    checkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    checkLabel: { fontSize: s(15), fontWeight: "500", color: colors.text },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: "#FFFFFF",
      fontSize: s(13),
      fontWeight: "700",
      lineHeight: 16,
    },
    actionBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: radius.card,
      alignItems: "center",
      marginTop: 16,
    },
    actionBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  });
