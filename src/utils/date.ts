import { DAYS, type Day } from '../types';

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayOfWeek(d: Date = new Date()): Day {
  // JS: 0 = Sunday … 6 = Saturday. Convert to our Monday-first list.
  const js = d.getDay();
  const idx = js === 0 ? 6 : js - 1;
  return DAYS[idx];
}

export function weekDates(reference: Date = new Date()): Record<Day, string> {
  const js = reference.getDay();
  const offsetToMonday = js === 0 ? -6 : 1 - js;
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + offsetToMonday);
  const out = {} as Record<Day, string>;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out[DAYS[i]] = toISO(d);
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(ms / 86_400_000);
}
