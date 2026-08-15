import DateTimePicker from "@react-native-community/datetimepicker";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import { type UserProfile } from "../../utils/tdee";
import { makeStyles } from "./measureStyles";
import { AGE_RANGE, HEIGHT_INPUT_ID } from "./types";

// ─── Profile section ───────────────────────────────────────────────────
//
// Collapsible height / date-of-birth / sex form. Owns its own draft state
// for the height field and the picker visibility; committed values are
// pushed up through onSave, which persists them.

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDob(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfileSection({
  profile,
  onSave,
  heightInput,
  setHeightInput,
  commitHeight,
  embedded = false,
}: {
  profile: UserProfile;
  onSave: (patch: Partial<UserProfile>) => Promise<void>;
  heightInput: string;
  setHeightInput: (v: string) => void;
  commitHeight: () => void;
  /**
   * Hides the built-in "Profile" header and keeps the form open. Set this when
   * the host screen already labels the section — otherwise the collapsible
   * header stacks under a second heading saying the same thing.
   */
  embedded?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [collapsedOpen, setCollapsedOpen] = useState(false);
  // In embedded mode the form is always open — there's no header to toggle it,
  // so deriving this rather than seeding state avoids it getting stuck closed.
  const profileExpanded = embedded || collapsedOpen;

  // Mirror the persisted date of birth into the local draft field.
  useEffect(() => {
    setDobDate(profile.dob ? new Date(profile.dob) : null);
  }, [profile.dob]);

  const profileComplete =
    profile.height_in != null && profile.dob != null && profile.sex != null;

  const pickSex = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Male", "Female", "Cancel"], cancelButtonIndex: 2 },
      async (idx) => {
        if (idx === 0) await onSave({ sex: "male" });
        else if (idx === 1) await onSave({ sex: "female" });
      },
    );
  };

  return (
    <>
    {!embedded && (
    <Pressable
      onPress={() => setCollapsedOpen((v) => !v)}
      style={styles.profileHeader}
    >
      <Text style={styles.profileHeaderText}>Profile</Text>
      <View style={styles.profileHeaderRight}>
        {!profileComplete && (
          <Text style={styles.profileIncomplete}>Incomplete</Text>
        )}
        {profileExpanded ? (
          <ChevronUp
            size={14}
            color={colors.textSecondary}
            strokeWidth={2}
          />
        ) : (
          <ChevronDown
            size={14}
            color={colors.textSecondary}
            strokeWidth={2}
          />
        )}
      </View>
    </Pressable>
    )}
    {profileExpanded && (
      <View style={styles.formCard}>
        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Height (inches)</Text>
          <TextInput
            value={heightInput}
            onChangeText={setHeightInput}
            onBlur={commitHeight}
            onSubmitEditing={() => {
              commitHeight();
              Keyboard.dismiss();
            }}
            returnKeyType="done"
            inputAccessoryViewID={
              Platform.OS === "ios" ? HEIGHT_INPUT_ID : undefined
            }
            keyboardType="decimal-pad"
            style={styles.input}
            placeholder="e.g. 70 (5′10″)"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Date of birth</Text>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowDobPicker(true);
            }}
            style={({ pressed }) => [
              styles.input,
              styles.pickerRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={dobDate ? styles.pickerText : styles.pickerPlaceholder}
            >
              {dobDate ? formatDob(dobDate) : "Select date…"}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </Pressable>
          {showDobPicker && (
            <>
              <DateTimePicker
                value={dobDate ?? new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                textColor="#FFFFFF"
                onChange={async (event, date) => {
                  // Android fires once with type=set/dismissed and the
                  // picker dismisses itself — close it here too.
                  if (Platform.OS === "android") {
                    setShowDobPicker(false);
                    if (event.type !== "set" || !date) return;
                  } else if (!date) {
                    return;
                  }
                  const age = Math.floor(
                    (Date.now() - date.getTime()) /
                      (365.25 * 24 * 3600 * 1000),
                  );
                  if (age < AGE_RANGE.min || age > AGE_RANGE.max) {
                    Alert.alert(AGE_RANGE.label);
                    return;
                  }
                  setDobDate(date);
                  const iso = toISODate(date);
                  await onSave({ dob: iso });
                }}
                style={{ marginTop: 4 }}
              />
              {Platform.OS === "ios" && (
                <Pressable
                  onPress={() => setShowDobPicker(false)}
                  style={({ pressed }) => [
                    styles.dobDoneBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.dobDoneBtnText}>Done</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
        <View style={[styles.formRow, { marginBottom: 0 }]}>
          <Text style={styles.formLabel}>Sex</Text>
          <Pressable
            onPress={pickSex}
            style={({ pressed }) => [
              styles.input,
              styles.pickerRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={
                profile.sex ? styles.pickerText : styles.pickerPlaceholder
              }
            >
              {profile.sex === "male"
                ? "Male"
                : profile.sex === "female"
                  ? "Female"
                  : "Select…"}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </Pressable>
        </View>
      </View>
    )}
    </>
  );
}

// Rendered outside <Screen> so the accessory bar can attach to the keyboard.
// iOS only: pairs with the height field via HEIGHT_INPUT_ID.
export function HeightInputAccessory({ onDone }: { onDone: () => void }) {
  const styles = useStyles(makeStyles);
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={HEIGHT_INPUT_ID}>
      <View style={styles.accessoryBar}>
        <Pressable
          onPress={() => {
            onDone();
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [
            styles.accessoryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.accessoryBtnText}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
