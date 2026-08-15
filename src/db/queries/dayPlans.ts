import { getDb } from '../client';
import type {
  Day,
  DayPlan,
} from '../../types';
import { DAYS } from '../../types';

// ─── Day plans ────────────────────────────────────────────────────────

export async function getDayPlans(): Promise<Record<Day, DayPlan>> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayPlan>('SELECT * FROM day_plans');
  const out = {} as Record<Day, DayPlan>;
  for (const d of DAYS) {
    const row = rows.find((r) => r.day === d);
    out[d] = row ?? { day: d, name: '', enabled: 0 };
  }
  return out;
}

export async function updateDayPlan(
  day: Day,
  patch: { enabled?: 0 | 1; name?: string },
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<DayPlan>(
    'SELECT * FROM day_plans WHERE day = ?',
    [day],
  );
  if (existing) {
    await db.runAsync(
      'UPDATE day_plans SET enabled = ?, name = ? WHERE day = ?',
      [
        patch.enabled !== undefined ? patch.enabled : existing.enabled,
        patch.name !== undefined ? patch.name : existing.name,
        day,
      ],
    );
  } else {
    await db.runAsync(
      'INSERT INTO day_plans (day, enabled, name) VALUES (?, ?, ?)',
      [day, patch.enabled ?? 0, patch.name ?? ''],
    );
  }
}
