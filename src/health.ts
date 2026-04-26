// Thin wrapper around react-native-health. Returns nulls on any failure so
// session completion is never blocked.

let AppleHealthKit: any = null;
try {
  const m = require('react-native-health');
  AppleHealthKit = m?.default ?? m;
  if (AppleHealthKit && typeof AppleHealthKit.initHealthKit !== 'function') {
    AppleHealthKit = null;
  }
} catch {
  AppleHealthKit = null;
}

// Built lazily so a missing/changed `Constants` shape can't crash module load.
function buildPerms(): { permissions: { read: string[]; write: string[] } } | null {
  if (!AppleHealthKit?.Constants?.Permissions) return null;
  try {
    const P = AppleHealthKit.Constants.Permissions;
    return {
      permissions: {
        read: [P.Steps, P.HeartRate, P.ActiveEnergyBurned, P.Workout],
        write: [],
      },
    };
  } catch {
    return null;
  }
}

let initPromise: Promise<boolean> | null = null;

export function isHealthKitAvailable(): boolean {
  return !!AppleHealthKit;
}

export function initHealthKit(): Promise<boolean> {
  if (!AppleHealthKit) return Promise.resolve(false);
  if (initPromise) return initPromise;
  initPromise = new Promise<boolean>((resolve) => {
    const perms = buildPerms();
    if (!perms) return resolve(false);
    try {
      AppleHealthKit.initHealthKit(perms, (err: unknown) => {
        resolve(!err);
      });
    } catch {
      resolve(false);
    }
  });
  return initPromise;
}

// Forces a fresh permission request (clears cached promise so the native
// sheet shows if the system decides one is needed).
export function requestHealthKitAccess(): Promise<boolean> {
  initPromise = null;
  return initHealthKit();
}

// iOS deliberately hides HealthKit read-permission denials from apps (a privacy
// choice — apps can't distinguish "denied" from "no data"). So `initHealthKit`
// resolving `true` doesn't prove access was granted. This probes by attempting
// a small read (recent workout → today's steps); a positive result confirms
// access. A negative result is inconclusive (could be denial, could be a new
// user with no data), so callers should treat it as "not verified" rather than
// "definitely denied."
export async function verifyHealthKitAccess(): Promise<boolean> {
  if (!AppleHealthKit) return false;
  const ok = await initHealthKit();
  if (!ok) return false;

  const end = new Date().toISOString();
  const workoutStart = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const hasWorkout = await new Promise<boolean>((resolve) => {
    try {
      AppleHealthKit.getSamples(
        { startDate: workoutStart, endDate: end, type: 'Workout', ascending: false, limit: 1 },
        (err: unknown, samples: any[]) => {
          if (err) return resolve(false);
          resolve(Array.isArray(samples) && samples.length > 0);
        },
      );
    } catch {
      resolve(false);
    }
  });
  if (hasWorkout) return true;

  return new Promise<boolean>((resolve) => {
    try {
      AppleHealthKit.getStepCount({ date: end }, (err: unknown, result: any) => {
        if (err) return resolve(false);
        resolve(!!result && typeof result.value === 'number' && result.value > 0);
      });
    } catch {
      resolve(false);
    }
  });
}

export type HealthMetrics = {
  durationMinutes: number | null;
  avgHr: number | null;
  calories: number | null;
};

export async function fetchRecentWorkoutMetrics(): Promise<HealthMetrics> {
  const empty: HealthMetrics = { durationMinutes: null, avgHr: null, calories: null };
  if (!AppleHealthKit) return empty;
  const ok = await initHealthKit();
  if (!ok) return empty;

  const now = new Date();
  const startDate = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const endDate = now.toISOString();

  const workout = await new Promise<any | null>((resolve) => {
    try {
      AppleHealthKit.getSamples(
        { startDate, endDate, type: 'Workout', ascending: false, limit: 1 },
        (err: unknown, results: any[]) => {
          if (err || !results || results.length === 0) return resolve(null);
          resolve(results[0]);
        },
      );
    } catch {
      resolve(null);
    }
  });

  if (!workout) return empty;

  const wStart = workout.start ?? workout.startDate;
  const wEnd = workout.end ?? workout.endDate;
  if (!wStart || !wEnd) return empty;

  const durationMinutes = Math.round(
    (new Date(wEnd).getTime() - new Date(wStart).getTime()) / 60000,
  );

  const avgHr = await new Promise<number | null>((resolve) => {
    try {
      AppleHealthKit.getHeartRateSamples(
        { startDate: wStart, endDate: wEnd, limit: 500 },
        (err: unknown, samples: any[]) => {
          if (err || !samples || samples.length === 0) return resolve(null);
          const sum = samples.reduce((s, x) => s + (x.value ?? 0), 0);
          resolve(Math.round(sum / samples.length));
        },
      );
    } catch {
      resolve(null);
    }
  });

  const calories = await new Promise<number | null>((resolve) => {
    try {
      AppleHealthKit.getActiveEnergyBurned(
        { startDate: wStart, endDate: wEnd },
        (err: unknown, samples: any[]) => {
          if (err || !samples) return resolve(null);
          const sum = samples.reduce((s, x) => s + (x.value ?? 0), 0);
          resolve(Math.round(sum));
        },
      );
    } catch {
      resolve(null);
    }
  });

  return { durationMinutes, avgHr, calories };
}
