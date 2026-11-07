import {
  getAllMeasurements,
  getHealthWriteEnabled,
  getMeasurementForDate,
  getUserProfile,
  isHealthBackfillOffered,
  markHealthBackfillOffered,
} from "../../db/queries";
import { writeHeightToHealth, writeMeasurementToHealth } from "../../health";
import { type Measurement } from "../../types";
import { confirm } from "../../utils/confirm";
import { fromISO, toISO, todayISO } from "../../utils/date";
import { hapticSuccess } from "../../utils/haptics";

// ─── Apple Health mirror for measurements ──────────────────────────────
//
// Forge's database stays the source of truth; Health gets a copy. Every
// function here checks the user's switch first and swallows failures, so
// callers can fire and forget without guarding.

// Measurements only carry a date. Today's entry is stamped with the save time;
// older days get local noon so they land on the right day in any time zone.
function timestampFor(date: string): Date {
  if (date === todayISO()) return new Date();
  const d = fromISO(date);
  d.setHours(12);
  return d;
}

/** Days with at least one value Health has a type for. */
function healthRows(rows: Measurement[]): Measurement[] {
  return rows.filter(
    (r) => r.weight_lb != null || r.body_fat_pct != null || r.waist_in != null,
  );
}

async function writeRows(rows: Measurement[]): Promise<void> {
  const profile = await getUserProfile();
  for (const row of rows) {
    await writeMeasurementToHealth(row, profile.height_in, timestampFor(row.date));
  }
}

/** Mirrors one day's merged measurement row to Health. */
export async function syncMeasurementDayToHealth(date: string): Promise<void> {
  try {
    if (!(await getHealthWriteEnabled("measurements"))) return;
    const row = await getMeasurementForDate(date);
    if (row) await writeRows([row]);
  } catch {
    /* never block a save on Health */
  }
}

/**
 * Writes the new height, then re-sends today's measurements so today's BMI is
 * recomputed from it. Earlier days keep the BMI they were written with.
 */
export async function syncHeightToHealth(heightIn: number): Promise<void> {
  try {
    if (!(await getHealthWriteEnabled("measurements"))) return;
    const today = todayISO();
    await writeHeightToHealth(heightIn, today, timestampFor(today));
    await syncMeasurementDayToHealth(today);
  } catch {
    /* never block a save on Health */
  }
}

/**
 * Sends days logged while saving was switched off. Called on re-enable with
 * the time it was switched off; quiet, because the user already chose to sync
 * these when they first turned saving on.
 */
export async function catchUpMeasurementsToHealth(offSince: string): Promise<void> {
  try {
    const sinceDate = toISO(new Date(offSince));
    const rows = healthRows(await getAllMeasurements()).filter(
      (r) => r.date >= sinceDate,
    );
    await writeRows(rows);
  } catch {
    /* each day re-syncs on its next save anyway */
  }
}

/**
 * Asks once, ever, whether to send existing history. Called whenever writing
 * gets turned on -- from Profile or the Home "Connect" card -- and returns
 * immediately on every call after the first. Resolves after the user answers,
 * so the Connect card can follow it with the workouts offer.
 */
export async function offerMeasurementBackfill(): Promise<void> {
  if (await isHealthBackfillOffered("measurements")) return;
  await markHealthBackfillOffered("measurements");
  const rows = healthRows(await getAllMeasurements());
  if (rows.length === 0) return;
  const send = await confirm(
    "Send past measurements?",
    `You have ${rows.length} day${rows.length === 1 ? "" : "s"} of measurements in Forge. Send them to Apple Health too, or only save new ones from now on.`,
    "Only new ones",
    "Send history",
  );
  if (!send) return;
  try {
    await writeRows(rows);
    const { height_in } = await getUserProfile();
    if (height_in != null) {
      await writeHeightToHealth(height_in, todayISO(), new Date());
    }
    hapticSuccess();
  } catch {
    /* partial backfill is fine; the next save of each day re-syncs it */
  }
}
