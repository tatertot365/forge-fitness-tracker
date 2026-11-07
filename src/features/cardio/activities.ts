// The cardio activities Forge offers, each mapped to the HealthKit workout
// activity type it's saved as (and recognised by, when adding Apple Watch
// workouts). Values are HKWorkoutActivityType raw values.

export type CardioActivity = {
  key: string;
  label: string;
  hkType: number;
  /** Treadmill/machine work: saved to Health as an indoor workout. */
  indoor: boolean;
};

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  { key: "incline_walk", label: "Incline walk", hkType: 52, indoor: true },
  { key: "walk", label: "Walk", hkType: 52, indoor: false },
  { key: "run", label: "Run", hkType: 37, indoor: false },
  { key: "bike", label: "Bike", hkType: 13, indoor: false },
  { key: "rower", label: "Rower", hkType: 35, indoor: true },
  { key: "elliptical", label: "Elliptical", hkType: 16, indoor: true },
  { key: "stairs", label: "Stair climber", hkType: 44, indoor: true },
  { key: "swim", label: "Swim", hkType: 46, indoor: false },
  { key: "hike", label: "Hike", hkType: 24, indoor: false },
  { key: "other", label: "Other", hkType: 3000, indoor: false },
];

export const DEFAULT_CARDIO_ACTIVITY = "incline_walk";

const byKey = new Map(CARDIO_ACTIVITIES.map((a) => [a.key, a]));

export function cardioActivity(key: string | null | undefined): CardioActivity {
  return byKey.get(key ?? "") ?? byKey.get("other")!;
}

/** Label for a logged session; logs from before activities existed say "Cardio". */
export function cardioLabel(key: string | null | undefined): string {
  return key ? cardioActivity(key).label : "Cardio";
}

/**
 * Forge activity for a Health workout type, for adding Apple Watch workouts.
 * Null for types that aren't cardio (strength, yoga, ...), which are ignored.
 * Walking maps to plain "Walk": Health can't tell us it was on an incline.
 */
const fromHk = new Map<number, string>([
  [52, "walk"],
  [37, "run"],
  [13, "bike"],
  [35, "rower"],
  [16, "elliptical"],
  [44, "stairs"],
  [68, "stairs"], // stairs
  [69, "stairs"], // step training
  [46, "swim"],
  [24, "hike"],
  [73, "other"], // mixed cardio
  [63, "other"], // HIIT
]);

export function activityForHkType(hkType: number): string | null {
  return fromHk.get(hkType) ?? null;
}
