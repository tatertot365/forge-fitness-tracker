import { getDb } from '../client';
import type {
  Phase,
} from '../../types';
import { latestMeasurement, startingMeasurement } from './measurements';

// ─── Phase ────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getGoalsMode(): Promise<'calculated' | 'manual'> {
  const v = await getSetting('goals_mode');
  return v === 'calculated' ? 'calculated' : 'manual';
}

export async function setGoalsMode(mode: 'calculated' | 'manual'): Promise<void> {
  await setSetting('goals_mode', mode);
}

export async function getActivityLevel(): Promise<import('../../utils/tdee').ActivityLevel | null> {
  const v = await getSetting('activity_level');
  return (v as import('../../utils/tdee').ActivityLevel) ?? null;
}

export async function setActivityLevel(level: import('../../utils/tdee').ActivityLevel): Promise<void> {
  await setSetting('activity_level', level);
}

export async function getUserProfile(): Promise<import('../../utils/tdee').UserProfile> {
  const [h, d, s] = await Promise.all([
    getSetting('profile_height_in'),
    getSetting('profile_dob'),
    getSetting('profile_sex'),
  ]);
  return {
    height_in: h ? Number(h) : null,
    dob: d ?? null,
    sex: (s as import('../../utils/tdee').Sex) ?? null,
  };
}

export async function setUserProfile(profile: Partial<import('../../utils/tdee').UserProfile>): Promise<void> {
  if (profile.height_in != null) await setSetting('profile_height_in', String(profile.height_in));
  if (profile.dob != null) await setSetting('profile_dob', profile.dob);
  if (profile.sex != null) await setSetting('profile_sex', profile.sex);
}

export type BodyGoals = {
  goal_weight_lb: number | null;
  goal_body_fat_pct: number | null;
  goal_weight_start_lb: number | null;
  goal_body_fat_start_pct: number | null;
  show_ratio_card: boolean;
};

export async function getBodyGoals(): Promise<BodyGoals> {
  const [w, b, r, sw, sb] = await Promise.all([
    getSetting('goal_weight_lb'),
    getSetting('goal_body_fat_pct'),
    getSetting('show_ratio_card'),
    getSetting('goal_weight_start_lb'),
    getSetting('goal_body_fat_start_pct'),
  ]);
  return {
    goal_weight_lb: w ? Number(w) : null,
    goal_body_fat_pct: b ? Number(b) : null,
    goal_weight_start_lb: sw ? Number(sw) : null,
    goal_body_fat_start_pct: sb ? Number(sb) : null,
    show_ratio_card: r === '1',
  };
}

export async function setBodyGoals(goals: Partial<BodyGoals>): Promise<void> {
  if (goals.goal_weight_lb != null) {
    const prev = await getSetting('goal_weight_lb');
    const existingStart = await getSetting('goal_weight_start_lb');
    const goalChanged = prev == null || Number(prev) !== goals.goal_weight_lb;
    // Snapshot the user's current weight as their journey start whenever the
    // goal value changes or no snapshot exists yet — this keeps the progress
    // bar fixed instead of following same-day upserts to today's measurement.
    if (goalChanged || existingStart == null) {
      const latest = await latestMeasurement();
      if (latest?.weight_lb != null) {
        await setSetting('goal_weight_start_lb', String(latest.weight_lb));
      }
    }
    await setSetting('goal_weight_lb', String(goals.goal_weight_lb));
  }
  if (goals.goal_body_fat_pct != null) {
    const prev = await getSetting('goal_body_fat_pct');
    const existingStart = await getSetting('goal_body_fat_start_pct');
    const goalChanged = prev == null || Number(prev) !== goals.goal_body_fat_pct;
    if (goalChanged || existingStart == null) {
      const latest = await latestMeasurement();
      if (latest?.body_fat_pct != null) {
        await setSetting('goal_body_fat_start_pct', String(latest.body_fat_pct));
      }
    }
    await setSetting('goal_body_fat_pct', String(goals.goal_body_fat_pct));
  }
  if (goals.show_ratio_card != null) await setSetting('show_ratio_card', goals.show_ratio_card ? '1' : '0');
}

// Backfill the journey-start snapshot for users who set a goal before this
// snapshot existed. Idempotent: only writes when a goal is set and the
// matching start setting is still missing. Uses the earliest logged
// measurement (best estimate of journey start), not the latest, so existing
// users keep their visible progress.
export async function backfillBodyGoalStarts(): Promise<void> {
  const [gw, gb, sw, sb] = await Promise.all([
    getSetting('goal_weight_lb'),
    getSetting('goal_body_fat_pct'),
    getSetting('goal_weight_start_lb'),
    getSetting('goal_body_fat_start_pct'),
  ]);
  if ((gw != null && sw == null) || (gb != null && sb == null)) {
    const starting = await startingMeasurement();
    if (gw != null && sw == null && starting.weight_lb != null) {
      await setSetting('goal_weight_start_lb', String(starting.weight_lb));
    }
    if (gb != null && sb == null && starting.body_fat_pct != null) {
      await setSetting('goal_body_fat_start_pct', String(starting.body_fat_pct));
    }
  }
}

export async function getPhase(): Promise<Phase> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['phase'],
  );
  return (row?.value as Phase) ?? 'maintain';
}

export async function setPhase(phase: Phase): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('phase', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [phase],
  );
}

export async function isHealthKitAsked(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['healthkit_asked'],
  );
  return row?.value === '1';
}

export async function markHealthKitAsked(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('healthkit_asked', '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

export async function getCustomRestSeconds(): Promise<number | null> {
  const v = await getSetting('rest_custom_secs');
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setCustomRestSeconds(seconds: number): Promise<void> {
  await setSetting('rest_custom_secs', String(Math.round(seconds)));
}
