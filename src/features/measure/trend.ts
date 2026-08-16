import { type Measurement } from "../../types";
import { daysBetween } from "../../utils/date";

// ─── Trend math ────────────────────────────────────────────────────────
//
// A single scale reading is mostly water, glycogen and gut contents, so the
// raw latest value is the noisiest number the screen can show. These helpers
// derive the smoothed figure and the rate of change that actually describe
// what a body is doing.

export type TrendPoint = { date: string; value: number };

// Pull one metric out of the history, dropping days where it was not logged.
// History arrives oldest-first from getMeasurementHistory().
export function seriesFor(
  history: Measurement[],
  key: keyof Omit<Measurement, "id" | "date">,
): TrendPoint[] {
  return history
    .map((m) => ({ date: m.date, value: m[key] as number | null }))
    .filter((p): p is TrendPoint => p.value != null);
}

// Time-aware exponential moving average.
//
// A plain EMA weights by position, which assumes evenly spaced samples. Real
// check-ins are irregular -- three in one week, then nothing for a month -- so
// the weight here decays by *elapsed days*, letting a long gap correctly pull
// the average back toward the newer reading.
export function emaSeries(
  points: TrendPoint[],
  halfLifeDays = 7,
): TrendPoint[] {
  if (points.length === 0) return [];
  const out: TrendPoint[] = [{ date: points[0].date, value: points[0].value }];
  let acc = points[0].value;
  for (let i = 1; i < points.length; i++) {
    const gap = Math.max(daysBetween(points[i - 1].date, points[i].date), 0);
    // 2^(-gap/halfLife): one half-life of silence gives the old average and the
    // new reading equal say.
    const decay = Math.pow(2, -gap / halfLifeDays);
    acc = acc * decay + points[i].value * (1 - decay);
    out.push({ date: points[i].date, value: acc });
  }
  return out;
}

export function emaAt(points: TrendPoint[], halfLifeDays = 7): number | null {
  const series = emaSeries(points, halfLifeDays);
  return series.length ? series[series.length - 1].value : null;
}

// Least-squares slope in units per week, fit over the trailing `windowDays`.
//
// Regression rather than (last - first) / weeks: the endpoint version is
// hostage to noise in exactly two readings, which is the problem the trend is
// meant to solve in the first place.
export function ratePerWeek(
  points: TrendPoint[],
  windowDays = 42,
): number | null {
  if (points.length < 2) return null;
  // Fit the smoothed series, not the raw readings. Weekly logging puts only
  // four or five points in the window, so one water-weight spike is a large
  // share of the sample -- on a real -0.7 lb/wk cut, a single +2.3 lb final
  // reading pulled the raw fit to -0.1 and the card claimed the cut had
  // stalled. 42 days rather than 28 for the same reason: more points, less
  // leverage for any one of them.
  const smoothed = emaSeries(points);
  const last = smoothed[smoothed.length - 1].date;
  const window = smoothed.filter(
    (p) => daysBetween(p.date, last) <= windowDays,
  );
  // Two points spanning a single day extrapolate to a wild weekly figure.
  if (window.length < 2) return null;
  const span = daysBetween(window[0].date, window[window.length - 1].date);
  if (span < 2) return null;

  const xs = window.map((p) => daysBetween(window[0].date, p.date));
  const ys = window.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}
