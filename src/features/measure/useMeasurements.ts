import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  backfillBodyGoalStarts,
  getBodyGoals,
  getMeasurementHistory,
  getUserProfile,
  latestMeasurement,
  measurementOneWeekAgo,
  setUserProfile,
  startingMeasurement,
  type BodyGoals,
} from "../../db/queries";
import { type Measurement } from "../../types";
import { type UserProfile } from "../../utils/tdee";

type StartingMeasurement = {
  weight_lb: number | null;
  body_fat_pct: number | null;
};

// ─── Measurements data ─────────────────────────────────────────────────
//
// Loads every measurement-derived record the screen renders, and reloads on
// focus so edits made elsewhere (or a finished session) show up on return.
// Callers mutate through the returned helpers, then call reload().

export function useMeasurements() {
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [prior, setPrior] = useState<Measurement | null>(null);
  const [starting, setStarting] = useState<StartingMeasurement>({
    weight_lb: null,
    body_fat_pct: null,
  });
  const [history, setHistory] = useState<Measurement[]>([]);
  const [bodyGoals, setBodyGoalsState] = useState<BodyGoals>({
    goal_weight_lb: null,
    goal_body_fat_pct: null,
    goal_weight_start_lb: null,
    goal_body_fat_start_pct: null,
    show_ratio_card: false,
  });
  const [profile, setProfile] = useState<UserProfile>({
    height_in: null,
    dob: null,
    sex: null,
  });

  const reload = useCallback(async () => {
    await backfillBodyGoalStarts();
    const [l, p, h, prof, bg, st] = await Promise.all([
      latestMeasurement(),
      measurementOneWeekAgo(),
      getMeasurementHistory(),
      getUserProfile(),
      getBodyGoals(),
      startingMeasurement(),
    ]);
    setLatest(l);
    setPrior(p);
    setHistory(h);
    setProfile(prof);
    setBodyGoalsState(bg);
    setStarting(st);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Persist a profile patch and mirror it locally so the form stays responsive
  // without waiting for a full reload.
  const saveProfile = useCallback(async (patch: Partial<UserProfile>) => {
    await setUserProfile(patch);
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  return {
    latest,
    prior,
    starting,
    history,
    bodyGoals,
    setBodyGoalsState,
    profile,
    saveProfile,
    reload,
  };
}
