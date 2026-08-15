import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { type UserProfile } from "../../utils/tdee";
import { parseField } from "./helpers";
import { HEIGHT_RANGE } from "./types";

// ─── Height field state ────────────────────────────────────────────────
//
// Owned by the route rather than by ProfileSection, because the keyboard
// accessory that commits this field has to mount outside the screen's
// ScrollView -- an InputAccessoryView nested inside scrolling content never
// attaches to the keyboard. The route renders both consumers and passes this
// state down to each.

export function useHeightField(
  profile: UserProfile,
  onSave: (patch: Partial<UserProfile>) => Promise<void>,
) {
  const [heightInput, setHeightInput] = useState("");

  useEffect(() => {
    setHeightInput(profile.height_in != null ? String(profile.height_in) : "");
  }, [profile.height_in]);

  const commitHeight = useCallback(async () => {
    const v = parseField(heightInput);
    if (v == null) return;
    if (v < HEIGHT_RANGE.min || v > HEIGHT_RANGE.max) {
      Alert.alert(HEIGHT_RANGE.label);
      setHeightInput(profile.height_in != null ? String(profile.height_in) : "");
      return;
    }
    await onSave({ height_in: v });
  }, [heightInput, profile.height_in, onSave]);

  return { heightInput, setHeightInput, commitHeight };
}
