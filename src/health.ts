// Thin wrapper around @kingstinct/react-native-healthkit. Returns nulls on
// any failure so session completion is never blocked.

let HK: any = null;
try {
  HK = require('@kingstinct/react-native-healthkit');
} catch {
  HK = null;
}

const READ_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierStepCount',
] as const;

let authPromise: Promise<boolean> | null = null;

export function isHealthKitAvailable(): boolean {
  if (!HK) return false;
  try {
    return !!HK.isHealthDataAvailable?.();
  } catch {
    return false;
  }
}

export function initHealthKit(): Promise<boolean> {
  if (!HK) return Promise.resolve(false);
  if (authPromise) return authPromise;
  authPromise = (async () => {
    try {
      const ok = await HK.requestAuthorization({
        toRead: READ_TYPES,
      });
      return !!ok;
    } catch {
      return false;
    }
  })();
  return authPromise;
}

export function requestHealthKitAccess(): Promise<boolean> {
  authPromise = null;
  return initHealthKit();
}

// ─── Writing ──────────────────────────────────────────────────────────

const MEASUREMENT_WRITE_TYPES = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierWaistCircumference',
  'HKQuantityTypeIdentifierHeight',
] as const;

const WORKOUT_WRITE_TYPES = ['HKWorkoutTypeIdentifier'] as const;

type WriteType =
  | (typeof MEASUREMENT_WRITE_TYPES)[number]
  | (typeof WORKOUT_WRITE_TYPES)[number];

// AuthorizationStatus.sharingAuthorized. Unlike reads, iOS does report whether
// the user allowed writes, so this is a real answer rather than a guess.
const SHARING_AUTHORIZED = 2;

function canWrite(type: WriteType): boolean {
  try {
    return HK.authorizationStatusFor(type) === SHARING_AUTHORIZED;
  } catch {
    return false;
  }
}

/**
 * Shows the iOS permission sheet for `toShare` (only types the user hasn't
 * answered yet). Read types always ride along, so a write request never leaves
 * reads for a second sheet later.
 */
async function requestWriteAccess(toShare: readonly WriteType[]): Promise<boolean> {
  if (!HK) return false;
  try {
    await HK.requestAuthorization({ toShare, toRead: READ_TYPES });
    return true;
  } catch {
    return false;
  }
}

/** True if at least one measurement type is now allowed. */
export async function requestMeasurementWriteAccess(): Promise<boolean> {
  if (!(await requestWriteAccess(MEASUREMENT_WRITE_TYPES))) return false;
  return MEASUREMENT_WRITE_TYPES.some(canWrite);
}

/** True if saving workouts is now allowed. */
export async function requestWorkoutWriteAccess(): Promise<boolean> {
  if (!(await requestWriteAccess(WORKOUT_WRITE_TYPES))) return false;
  return WORKOUT_WRITE_TYPES.every(canWrite);
}

/**
 * Everything Forge reads and writes, in one sheet -- for the Home "Connect"
 * card, so connecting is a single decision. Reports which write categories the
 * user allowed.
 */
export async function requestAllHealthAccess(): Promise<{
  measurements: boolean;
  workouts: boolean;
}> {
  const asked = await requestWriteAccess([
    ...MEASUREMENT_WRITE_TYPES,
    ...WORKOUT_WRITE_TYPES,
  ]);
  return {
    measurements: asked && MEASUREMENT_WRITE_TYPES.some(canWrite),
    workouts: asked && WORKOUT_WRITE_TYPES.every(canWrite),
  };
}

// The constant's real string value. The library's generated metadata type
// spells it `HKSyncIdentifier`, which HealthKit ignores -- every save would
// then add a duplicate instead of replacing the earlier one.
const SYNC_ID_KEY = 'HKMetadataKeySyncIdentifier';
const SYNC_VERSION_KEY = 'HKMetadataKeySyncVersion';

/**
 * Saves one value. `syncId` makes the write an upsert: HealthKit replaces any
 * earlier Forge sample with the same id and a lower version, so re-saving a
 * day's weight edits it in Health instead of adding a second reading.
 * Silently skips types the user hasn't allowed; never throws.
 */
async function saveQuantity(
  type: WriteType,
  unit: string,
  value: number,
  at: Date,
  syncId: string,
): Promise<void> {
  if (!canWrite(type)) return;
  try {
    await HK.saveQuantitySample(type, unit, value, at, at, {
      [SYNC_ID_KEY]: syncId,
      // Milliseconds are always increasing, so a later save always wins.
      [SYNC_VERSION_KEY]: Date.now(),
      HKWasUserEntered: true,
    });
  } catch {
    /* Health is a mirror; a failed write must never block the app. */
  }
}

export type MeasurementForHealth = {
  date: string;
  weight_lb: number | null;
  body_fat_pct: number | null;
  waist_in: number | null;
};

/**
 * Writes one day's measurements, plus lean body mass and BMI where they can
 * be derived. Pass the full merged row for the day (not just the fields the
 * user just typed) so derived values use everything known for that date.
 * Shoulders, arms, chest and quads have no HealthKit type and are skipped.
 */
export async function writeMeasurementToHealth(
  m: MeasurementForHealth,
  heightIn: number | null,
  at: Date,
): Promise<void> {
  if (!HK) return;
  const id = (field: string) => `forge.measurement.${m.date}.${field}`;

  if (m.weight_lb != null) {
    await saveQuantity('HKQuantityTypeIdentifierBodyMass', 'lb', m.weight_lb, at, id('weight'));
  }
  if (m.body_fat_pct != null) {
    // HealthKit percentages are fractions: 18% is stored as 0.18.
    await saveQuantity(
      'HKQuantityTypeIdentifierBodyFatPercentage',
      '%',
      m.body_fat_pct / 100,
      at,
      id('body_fat'),
    );
  }
  if (m.waist_in != null) {
    await saveQuantity('HKQuantityTypeIdentifierWaistCircumference', 'in', m.waist_in, at, id('waist'));
  }
  if (m.weight_lb != null && m.body_fat_pct != null) {
    const lean = m.weight_lb * (1 - m.body_fat_pct / 100);
    await saveQuantity('HKQuantityTypeIdentifierLeanBodyMass', 'lb', lean, at, id('lean_mass'));
  }
  if (m.weight_lb != null && heightIn != null && heightIn > 0) {
    const bmi = (703 * m.weight_lb) / (heightIn * heightIn);
    await saveQuantity(
      'HKQuantityTypeIdentifierBodyMassIndex',
      'count',
      Math.round(bmi * 10) / 10,
      at,
      id('bmi'),
    );
  }
}

/** Writes height, keyed by date so a same-day correction replaces itself. */
export async function writeHeightToHealth(
  heightIn: number,
  date: string,
  at: Date,
): Promise<void> {
  if (!HK) return;
  await saveQuantity('HKQuantityTypeIdentifierHeight', 'in', heightIn, at, `forge.height.${date}`);
}

// ─── Workouts ─────────────────────────────────────────────────────────

// WorkoutActivityType.traditionalStrengthTraining.
const TRADITIONAL_STRENGTH_TRAINING = 50;

// Stamped on every workout Forge saves. A second way to recognise our own
// workouts besides the bundle id, which is unavailable if Constants can't
// read the app config.
const FORGE_SESSION_KEY = 'ForgeSessionId';

const FORGE_BUNDLE_ID: string | undefined = (() => {
  try {
    return require('expo-constants').default?.expoConfig?.ios?.bundleIdentifier;
  } catch {
    return undefined;
  }
})();

// Cardio's counterpart to FORGE_SESSION_KEY.
const FORGE_CARDIO_KEY = 'ForgeCardioId';
// The cardio log's sync id, repeated as ordinary metadata so a delete can
// find the workout by it. HealthKit keeps the real sync id out of the
// metadata a predicate can match, and the workout's uuid changes with every
// edit -- deleting by a uuid read before an edit finished syncing missed.
const FORGE_CARDIO_REF_KEY = 'ForgeCardioRef';

function isForgeWorkout(workout: any): boolean {
  const bundle = workout?.sourceRevision?.source?.bundleIdentifier;
  if (FORGE_BUNDLE_ID && bundle === FORGE_BUNDLE_ID) return true;
  return (
    workout?.metadata?.[FORGE_SESSION_KEY] != null ||
    workout?.metadata?.[FORGE_CARDIO_KEY] != null
  );
}

/**
 * Workouts from other apps (Apple Watch, Fitness, ...) overlapping a window.
 * Returns [] when reading isn't allowed -- iOS reports a denied read as "no
 * data", so the caller can't tell the difference.
 */
async function otherWorkoutsBetween(start: Date, end: Date): Promise<any[]> {
  try {
    const workouts = await HK.queryWorkoutSamples({
      limit: 20,
      filter: { date: { startDate: start, endDate: end } },
    });
    return (workouts ?? []).filter((w: any) => !isForgeWorkout(w));
  } catch {
    return [];
  }
}

export type StrengthWorkoutForHealth = {
  /** Stable per day's session, so finishing it again replaces the workout. */
  syncId: string;
  sessionId: number;
  name: string;
  start: Date;
  end: Date;
  setsCompleted: number;
  volumeLb: number;
};

export type WorkoutWriteResult = 'saved' | 'skipped-duplicate' | 'not-allowed' | 'failed';

/**
 * Saves a strength-training workout -- unless another app already recorded a
 * workout overlapping the same time. That's normally the user's Apple Watch,
 * whose workout has real heart rate and calories; a second Forge workout on top
 * of it would double-count in the Fitness app.
 *
 * Sets and volume go into metadata. Health keeps them but doesn't display them
 * as sets; they're there for any app that wants to read them.
 */
export async function writeStrengthWorkoutToHealth(
  w: StrengthWorkoutForHealth,
): Promise<WorkoutWriteResult> {
  if (!HK) return 'not-allowed';
  if (!canWrite('HKWorkoutTypeIdentifier')) return 'not-allowed';
  if ((await otherWorkoutsBetween(w.start, w.end)).length > 0) {
    return 'skipped-duplicate';
  }
  try {
    await HK.saveWorkoutSample(
      TRADITIONAL_STRENGTH_TRAINING,
      [],
      w.start,
      w.end,
      undefined,
      {
        [SYNC_ID_KEY]: w.syncId,
        [SYNC_VERSION_KEY]: Date.now(),
        HKIndoorWorkout: true,
        [FORGE_SESSION_KEY]: w.sessionId,
        // Health lists every metadata key on the workout, so an unnamed day
        // plan leaves the field out rather than showing a blank row.
        ...(w.name ? { ForgeWorkoutName: w.name } : {}),
        ForgeSetsCompleted: w.setsCompleted,
        ForgeVolumeLb: Math.round(w.volumeLb),
      },
    );
    return 'saved';
  } catch {
    return 'failed';
  }
}

// ─── Cardio ───────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.344;

export type CardioWorkoutForHealth = {
  /** Stable per cardio log, so editing it replaces the workout. */
  syncId: string;
  cardioId: number;
  /** HKWorkoutActivityType raw value. */
  hkType: number;
  indoor: boolean;
  start: Date;
  end: Date;
  distanceMi: number | null;
};

/**
 * Saves a cardio session as a Health workout of the matching type, unless
 * another app (normally the Watch) already recorded a workout at that time.
 * Returns the saved workout's uuid, so deleting the log can remove it again.
 */
export async function writeCardioWorkoutToHealth(
  w: CardioWorkoutForHealth,
): Promise<{ result: WorkoutWriteResult; uuid: string | null }> {
  if (!HK) return { result: 'not-allowed', uuid: null };
  if (!canWrite('HKWorkoutTypeIdentifier')) return { result: 'not-allowed', uuid: null };
  if ((await otherWorkoutsBetween(w.start, w.end)).length > 0) {
    return { result: 'skipped-duplicate', uuid: null };
  }
  try {
    const workout = await HK.saveWorkoutSample(
      w.hkType,
      [],
      w.start,
      w.end,
      w.distanceMi ? { distance: w.distanceMi * METERS_PER_MILE } : undefined,
      {
        [SYNC_ID_KEY]: w.syncId,
        [SYNC_VERSION_KEY]: Date.now(),
        HKIndoorWorkout: w.indoor,
        [FORGE_CARDIO_KEY]: w.cardioId,
        [FORGE_CARDIO_REF_KEY]: w.syncId,
      },
    );
    return { result: 'saved', uuid: workout?.uuid ?? null };
  } catch {
    return { result: 'failed', uuid: null };
  }
}

/**
 * Removes the workout Forge saved for a cardio log, found by the log's sync
 * id. iOS only lets an app delete its own data, so nothing else can match.
 */
export async function deleteCardioWorkoutFromHealth(syncId: string): Promise<void> {
  if (!HK) return;
  try {
    await HK.deleteObjects('HKWorkoutTypeIdentifier', {
      metadata: { withMetadataKey: FORGE_CARDIO_REF_KEY, value: syncId },
    });
  } catch {
    /* already gone, or access was revoked */
  }
}

export type HealthCardioWorkout = {
  uuid: string;
  hkType: number;
  start: Date;
  end: Date;
  distanceMi: number | null;
};

function toMiles(q: { quantity?: number; unit?: string } | undefined): number | null {
  if (!q || typeof q.quantity !== 'number' || q.quantity <= 0) return null;
  const unit = String(q.unit ?? 'm').toLowerCase();
  const mi =
    unit === 'mi' ? q.quantity
    : unit === 'km' ? q.quantity * 1000 / METERS_PER_MILE
    : unit === 'yd' ? q.quantity * 0.9144 / METERS_PER_MILE
    : q.quantity / METERS_PER_MILE;
  return Math.round(mi * 100) / 100;
}

/**
 * Workouts other apps recorded since `since`, newest first, for offering to
 * add to Forge's cardio log. The caller filters to cardio types. Empty when
 * reading isn't allowed (iOS reports a denied read as "no data").
 */
export async function otherWorkoutsSince(since: Date): Promise<HealthCardioWorkout[]> {
  if (!HK) return [];
  try {
    const workouts = await HK.queryWorkoutSamples({
      limit: 50,
      ascending: false,
      filter: { date: { startDate: since } },
    });
    return (workouts ?? [])
      .filter((w: any) => !isForgeWorkout(w))
      .map((w: any) => ({
        uuid: String(w.uuid),
        hkType: Number(w.workoutActivityType),
        start: new Date(w.startDate),
        end: new Date(w.endDate),
        distanceMi: toMiles(w.totalDistance),
      }));
  } catch {
    return [];
  }
}

/** The newest workout recorded by any app other than Forge. */
async function mostRecentOtherWorkout(): Promise<any | null> {
  const workouts = await HK.queryWorkoutSamples({ limit: 10, ascending: false });
  return (workouts ?? []).find((w: any) => !isForgeWorkout(w)) ?? null;
}

// iOS deliberately hides HealthKit read-permission denials from apps. So
// `requestAuthorization` resolving truthy doesn't prove access was granted.
// This probes by attempting a small read; a positive result confirms access.
// A negative result is inconclusive (could be denial, could be a new user
// with no data).
export async function verifyHealthKitAccess(): Promise<boolean> {
  if (!HK) return false;
  const ok = await initHealthKit();
  if (!ok) return false;
  try {
    // Not Forge's own: iOS always lets an app read what it wrote, so a Forge
    // workout proves nothing about read access.
    const workout = await mostRecentOtherWorkout();
    if (workout) return true;
    const stepSample = await HK.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierStepCount',
    );
    return !!stepSample;
  } catch {
    return false;
  }
}

export type HealthMetrics = {
  durationMinutes: number | null;
  avgHr: number | null;
  calories: number | null;
};

const EMPTY_HEALTH_METRICS: HealthMetrics = {
  durationMinutes: null,
  avgHr: null,
  calories: null,
};

export async function fetchRecentWorkoutMetrics(): Promise<HealthMetrics> {
  const empty = EMPTY_HEALTH_METRICS;
  if (!HK) return empty;
  const ok = await initHealthKit();
  if (!ok) return empty;

  let workout: any;
  try {
    // Not getMostRecentWorkout(): once Forge saves its own workouts, that
    // would hand back Forge's own entry (no heart rate, no calories) instead
    // of the Apple Watch workout this summary is meant to show.
    workout = await mostRecentOtherWorkout();
  } catch {
    return empty;
  }
  if (!workout) return empty;

  const start = workout.startDate ?? workout.start;
  const end = workout.endDate ?? workout.end;
  if (!start || !end) return empty;

  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  // Only pull metrics from a workout that finished within the last 3 hours,
  // matching the previous library's behavior.
  if (Date.now() - endDate.getTime() > 3 * 60 * 60 * 1000) return empty;

  const durationMinutes = Math.round(
    (endDate.getTime() - startDate.getTime()) / 60000,
  );

  let avgHr: number | null = null;
  try {
    const samples = await HK.queryQuantitySamples(
      'HKQuantityTypeIdentifierHeartRate',
      {
        from: startDate,
        to: endDate,
        limit: 500,
        ascending: true,
      },
    );
    if (samples?.length) {
      const sum = samples.reduce(
        (s: number, x: any) => s + (x.quantity ?? 0),
        0,
      );
      avgHr = Math.round(sum / samples.length);
    }
  } catch {
    avgHr = null;
  }

  // Calories: try the workout summary itself first. Apple Watch and the
  // Fitness app populate `totalEnergyBurned` directly on the workout, and
  // strength-training workouts often don't emit per-interval ActiveEnergyBurned
  // samples — querying samples returns nothing while the workout's own total
  // is correct. Fall back through statistics, then a sample-window query, so
  // manually-logged workouts still resolve.
  let calories: number | null = null;
  try {
    const total = workout.totalEnergyBurned;
    if (total && typeof total.quantity === 'number') {
      // unit is typically 'kcal'; convert from kJ if HealthKit hands one back.
      const unit = String(total.unit ?? '').toLowerCase();
      const kcal =
        unit === 'kj' || unit === 'kj/min'
          ? total.quantity / 4.184
          : total.quantity;
      if (kcal > 0) calories = Math.round(kcal);
    }
  } catch {
    /* fall through */
  }

  if (calories == null && typeof workout.getStatistic === 'function') {
    try {
      const stat = await workout.getStatistic(
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'kcal',
      );
      const sum = stat?.sumQuantity?.quantity;
      if (typeof sum === 'number' && sum > 0) {
        calories = Math.round(sum);
      }
    } catch {
      /* fall through */
    }
  }

  if (calories == null) {
    try {
      const samples = await HK.queryQuantitySamples(
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        {
          from: startDate,
          to: endDate,
          ascending: true,
          unit: 'kcal',
        },
      );
      if (samples?.length) {
        const sum = samples.reduce(
          (s: number, x: any) => s + (x.quantity ?? 0),
          0,
        );
        if (sum > 0) calories = Math.round(sum);
      }
    } catch {
      calories = null;
    }
  }

  return { durationMinutes, avgHr, calories };
}
