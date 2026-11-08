import {
  getCardioPlanRaw,
  setCardioPlan,
  type CardioPlan,
} from "../../db/queries";
import { cardioActivity } from "./activities";

// The plan a fresh install starts with -- the same incline walk the old
// free-text defaults described.
const DEFAULT_PLAN: CardioPlan = {
  activity: "incline_walk",
  minutes: 30,
  details: "12° / 3 mph",
};

/** Best guess at the activity a free-text plan name describes. */
function guessActivity(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("incline")) return "incline_walk";
  if (/\b(run|jog)/.test(t)) return "run";
  if (/\b(bike|cycl|spin)/.test(t)) return "bike";
  if (/\brow/.test(t)) return "rower";
  if (t.includes("ellip")) return "elliptical";
  if (/\b(stair|step)/.test(t)) return "stairs";
  if (t.includes("swim")) return "swim";
  if (t.includes("hike")) return "hike";
  if (t.includes("walk")) return "walk";
  return null;
}

// "20–30 min" / "25 min" / "25min" -> the upper (or only) number.
const MINUTES_RE = /(\d+)(?:\s*[–-]\s*(\d+))?\s*min\w*/i;

// The old free-text default name; says nothing the activity doesn't.
const LEGACY_DEFAULT_NAME = "Incline treadmill walk";

/**
 * Converts a plan saved as free text ("Incline treadmill walk" +
 * "12° / 3 mph / 20–30 min") into activity + minutes + details. A custom name
 * ("Zone 2 bike") is kept at the front of the details, so nothing the user
 * wrote is lost -- unless it's the old default or just the activity's label.
 */
function convertLegacy(name: string | null, details: string | null): CardioPlan {
  const activity = guessActivity(`${name ?? ""} ${details ?? ""}`) ?? "other";
  const m = (details ?? "").match(MINUTES_RE);
  const minutes = m ? Number(m[2] ?? m[1]) : null;
  let rest = (details ?? "")
    .replace(MINUTES_RE, "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" / ");
  const keepName =
    !!name &&
    name !== LEGACY_DEFAULT_NAME &&
    name.toLowerCase() !== cardioActivity(activity).label.toLowerCase();
  if (keepName) rest = rest ? `${name} · ${rest}` : name!;
  return { activity, minutes, details: rest };
}

/**
 * The current plan. A plan from before plans were structured is converted
 * and saved the first time it's read, so this happens once.
 */
export async function getCardioPlan(): Promise<CardioPlan> {
  const raw = await getCardioPlanRaw();
  if (raw.activity) {
    return {
      activity: raw.activity,
      minutes: raw.minutes,
      details: raw.details ?? "",
    };
  }
  const plan =
    raw.legacyName == null && raw.details == null
      ? DEFAULT_PLAN
      : convertLegacy(raw.legacyName, raw.details);
  await setCardioPlan(plan);
  return plan;
}

/** Card title, e.g. "Incline walk · 30 min". */
export function planTitle(plan: CardioPlan): string {
  const label = cardioActivity(plan.activity).label;
  return plan.minutes ? `${label} · ${plan.minutes} min` : label;
}
