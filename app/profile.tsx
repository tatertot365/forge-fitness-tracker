import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Mail,
  Ruler,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
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
  getNutritionGoalForDate,
  resetAllData,
  setBodyGoals,
  setNutritionGoal,
  type BodyGoals,
} from "../src/db/queries";
import { GoalSheet } from "../src/features/food";
import {
  BodyGoalsSheet,
  HeightInputAccessory,
  ProfileSection,
  useHeightField,
  useMeasurements,
} from "../src/features/measure";
import { colors } from "../src/theme/colors";
import { radius, typography } from "../src/theme/spacing";
import { useStyles } from "../src/theme/useStyles";
import { type NutritionGoal } from "../src/types";
import { todayISO } from "../src/utils/date";
import { hapticSuccess } from "../src/utils/haptics";

const PRIVACY_URL = "https://forge.tatertot365.com/privacy-policy.html";
const SUPPORT_EMAIL = "tate.gillespie@gmail.com";

// Single home for setup: who you are, what you're aiming at, your data, and
// the app itself. These used to be spread across the Home header, the Body tab
// and the Food tab, with two unrelated export paths.

export default function ProfileScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();

  const { bodyGoals, setBodyGoalsState, profile, saveProfile, reload } =
    useMeasurements();
  const { heightInput, setHeightInput, commitHeight } = useHeightField(
    profile,
    saveProfile,
  );

  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [bodyGoalsVisible, setBodyGoalsVisible] = useState(false);
  const [nutritionGoal, setNutritionGoalState] = useState<NutritionGoal | null>(
    null,
  );

  const today = todayISO();

  const loadGoal = useCallback(async () => {
    setNutritionGoalState(await getNutritionGoalForDate(today));
  }, [today]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const appName = (Constants.expoConfig?.name as string | undefined) ?? "Forge";
  const version =
    (Constants.expoConfig?.version as string | undefined) ?? "1.1.0";
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

  const onSaveNutritionGoal = async (
    cal: number,
    prot: number,
    fat: number,
    carbs: number,
  ) => {
    await setNutritionGoal(today, {
      calorie_goal: cal,
      protein_goal: prot,
      fat_goal: fat,
      carbs_goal: carbs,
    });
    hapticSuccess();
    setGoalSheetVisible(false);
    loadGoal();
  };

  const onSaveBodyGoals = async (goals: Partial<BodyGoals>) => {
    await setBodyGoals(goals);
    setBodyGoalsState((g) => ({ ...g, ...goals }));
    hapticSuccess();
    setBodyGoalsVisible(false);
    reload();
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

  const goalSummary = nutritionGoal
    ? `${Math.round(nutritionGoal.calorie_goal)} kcal · ${Math.round(
        nutritionGoal.protein_goal,
      )}g protein`
    : "Not set yet";

  const bodyGoalSummary = [
    bodyGoals.goal_weight_lb != null ? `${bodyGoals.goal_weight_lb} lb` : null,
    bodyGoals.goal_body_fat_pct != null
      ? `${bodyGoals.goal_body_fat_pct}% body fat`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Screen>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.backBtn} />
        </View>

        <SectionLabel>You</SectionLabel>
        <View style={styles.plainCard}>
          <ProfileSection
            profile={profile}
            onSave={saveProfile}
            heightInput={heightInput}
            setHeightInput={setHeightInput}
            commitHeight={commitHeight}
            embedded
          />
        </View>

        <SectionLabel>Goals</SectionLabel>
        <View style={styles.card}>
          <RowButton
            icon={<Target size={16} color={colors.primary} strokeWidth={2} />}
            label="Nutrition goals"
            sub={goalSummary}
            trailing={
              <ChevronRight
                size={16}
                color={colors.textSecondary}
                strokeWidth={2}
              />
            }
            onPress={() => setGoalSheetVisible(true)}
          />
          <Divider />
          <RowButton
            icon={<Ruler size={16} color={colors.primary} strokeWidth={2} />}
            label="Body goals"
            sub={bodyGoalSummary || "Not set yet"}
            trailing={
              <ChevronRight
                size={16}
                color={colors.textSecondary}
                strokeWidth={2}
              />
            }
            onPress={() => setBodyGoalsVisible(true)}
          />
        </View>

        <SectionLabel>Data</SectionLabel>
        <View style={styles.card}>
          <RowButton
            icon={<Download size={16} color={colors.primary} strokeWidth={2} />}
            label="Export data"
            sub="CSV for spreadsheets, or a full JSON backup."
            trailing={
              <ChevronRight
                size={16}
                color={colors.textSecondary}
                strokeWidth={2}
              />
            }
            onPress={() => router.push("/export" as any)}
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
            icon={
              <ShieldCheck size={16} color={colors.primary} strokeWidth={2} />
            }
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
            All data is stored on this device. Forge does not collect or
            transmit your data.
          </Text>
        </View>
      </Screen>

      {/* Must stay OUTSIDE <Screen>: it is a ScrollView, and an
          InputAccessoryView nested in scrolling content never attaches to the
          keyboard — it silently renders nothing. */}
      <HeightInputAccessory onDone={commitHeight} />

      <GoalSheet
        visible={goalSheetVisible}
        current={nutritionGoal}
        onClose={() => setGoalSheetVisible(false)}
        onSave={onSaveNutritionGoal}
      />

      <BodyGoalsSheet
        visible={bodyGoalsVisible}
        current={bodyGoals}
        onClose={() => setBodyGoalsVisible(false)}
        onSave={onSaveBodyGoals}
      />
    </>
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
    },
    // ProfileSection brings its own card chrome, so this wrapper only supplies
    // the bottom margin the other sections get from `card`.
    plainCard: { marginBottom: 8 },
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
