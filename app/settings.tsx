import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import {
  ChevronLeft,
  Download,
  ExternalLink,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../src/components/Screen";
import { SectionLabel } from "../src/components/SectionLabel";
import {
  exportFullBackupJSON,
  resetAllData,
} from "../src/db/queries";
import { colors } from "../src/theme/colors";
import { radius, typography } from "../src/theme/spacing";
import { useStyles } from "../src/theme/useStyles";

const PRIVACY_URL = "https://forge.tatertot365.com/privacy-policy.html";
const SUPPORT_EMAIL = "tate.gillespie@gmail.com";

export default function SettingsScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const appName = (Constants.expoConfig?.name as string | undefined) ?? "Forge";
  const version =
    (Constants.expoConfig?.version as string | undefined) ?? "1.0.0";
  const build =
    (Constants.expoConfig?.ios?.buildNumber as string | undefined) ?? "1";

  const onOpenURL = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn't open link", url);
    }
  };

  const onEmail = async () => {
    const subject = encodeURIComponent(`Forge support — v${version} (${build})`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("No email app found", SUPPORT_EMAIL);
    }
  };

  const onExportBackup = async () => {
    if (exporting) return;
    setExporting(true);
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
      setExporting(false);
    }
  };

  const onResetAll = () => {
    Alert.alert(
      "Erase all data?",
      "This permanently deletes every workout, food entry, measurement, and goal on this device. Export a backup first if you want to keep your history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase everything",
          style: "destructive",
          onPress: async () => {
            try {
              await resetAllData();
              Alert.alert(
                "Data erased",
                "All local data has been removed. Reopen the app to start fresh.",
              );
            } catch {
              Alert.alert(
                "Reset failed",
                "Something went wrong while erasing data.",
              );
            }
          },
        },
      ],
    );
  };

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
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <SectionLabel>Data</SectionLabel>
      <View style={styles.card}>
        <RowButton
          icon={<Download size={16} color={colors.primary} strokeWidth={2} />}
          label={exporting ? "Preparing backup…" : "Export full backup"}
          sub="JSON file with every workout, meal, and measurement. Share it to iCloud Drive, Files, or email to keep a copy."
          onPress={onExportBackup}
          disabled={exporting}
        />
        <Divider />
        <RowButton
          icon={<Trash2 size={16} color={colors.red} strokeWidth={2} />}
          label="Erase all data"
          sub="Permanently delete everything on this device."
          danger
          onPress={onResetAll}
        />
      </View>

      <SectionLabel>About</SectionLabel>
      <View style={styles.card}>
        <RowButton
          icon={<ShieldCheck size={16} color={colors.primary} strokeWidth={2} />}
          label="Privacy policy"
          trailing={
            <ExternalLink
              size={14}
              color={colors.textSecondary}
              strokeWidth={2}
            />
          }
          onPress={() => onOpenURL(PRIVACY_URL)}
        />
        <Divider />
        <RowButton
          icon={<Mail size={16} color={colors.primary} strokeWidth={2} />}
          label="Contact support"
          sub={SUPPORT_EMAIL}
          trailing={
            <ExternalLink
              size={14}
              color={colors.textSecondary}
              strokeWidth={2}
            />
          }
          onPress={onEmail}
        />
      </View>

      <View style={styles.versionBox}>
        <Text style={styles.versionApp}>{appName}</Text>
        <Text style={styles.versionLine}>
          Version {version} ({build})
        </Text>
        <Text style={styles.versionFoot}>
          All data is stored on this device. Forge does not collect or transmit
          your data.
        </Text>
      </View>
    </Screen>
  );
}

function RowButton({
  icon,
  label,
  sub,
  trailing,
  danger,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && { opacity: 0.6 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.red }]}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

function Divider() {
  const styles = useStyles(makeStyles);
  return <View style={styles.divider} />;
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
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
  title: { ...typography.screenTitle, fontSize: s(22), color: colors.text, flex: 1, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIcon: { width: 22, alignItems: "center" },
  rowLabel: { fontSize: s(14), fontWeight: "500", color: colors.text },
  rowSub: {
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 14 + 22 + 12,
  },
  versionBox: {
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 24,
  },
  versionApp: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  versionLine: { fontSize: s(12), color: colors.textSecondary },
  versionFoot: {
    fontSize: s(11),
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
