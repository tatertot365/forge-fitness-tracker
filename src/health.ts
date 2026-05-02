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
        toWrite: [],
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
    const workout = await HK.getMostRecentWorkout();
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

export async function fetchRecentWorkoutMetrics(): Promise<HealthMetrics> {
  const empty: HealthMetrics = {
    durationMinutes: null,
    avgHr: null,
    calories: null,
  };
  if (!HK) return empty;
  const ok = await initHealthKit();
  if (!ok) return empty;

  let workout: any;
  try {
    workout = await HK.getMostRecentWorkout();
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
