# Classic Physique Training App — Claude Code Specification

## Project overview

A personal iOS training tracker app for a classic physique competitor. Single user, no authentication. Built with React Native (Expo), using SQLite for local data persistence and HealthKit for passive workout data (duration, heart rate, calories) via `react-native-health`. Installed on device via Xcode sideloading.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React Native with Expo (managed workflow) |
| Navigation | Expo Router (file-based) |
| Database | SQLite via `expo-sqlite` |
| Health data | `react-native-health` (HealthKit read-only) |
| Icons | `lucide-react-native` |
| Language | TypeScript |
| Target platform | iOS only |

---

## App structure

Four bottom-tab screens. No authentication. No onboarding flow.

```
app/
  (tabs)/
    index.tsx          # Today
    session.tsx        # Session
    body.tsx           # Body comp
    measure.tsx        # Measurements
  exercise/
    [id].tsx           # Exercise detail / set logging
  _layout.tsx
```

---

## Navigation & tab bar

Four tabs with Lucide icons:

| Tab | Icon | Screen |
|---|---|---|
| Today | `Calendar` | Weekly overview + catch-up |
| Session | `Coffee` | Active workout session |
| Body | `BarChart2` | Body comp logging + trend chart |
| Measure | `Package` | Measurements + shoulder-to-waist ratio |

Active tab color: `#185FA5`. Inactive: system gray.

---

## Database schema (SQLite)

```sql
-- Training phase
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- key: 'phase', value: 'cut' | 'maintain' | 'bulk'

-- Exercises (seeded from v5 plan, read-only reference)
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,           -- 'monday', 'tuesday', etc.
  muscle_group TEXT NOT NULL,  -- 'chest', 'shoulders', 'triceps', etc.
  name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  rep_range TEXT NOT NULL,     -- e.g. '6-10', '12-15', 'failure'
  notes TEXT,
  sort_order INTEGER NOT NULL,
  accent_color TEXT NOT NULL   -- hex color for left-border accent
);

-- Session logs (one row per completed session)
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  date TEXT NOT NULL,          -- ISO 8601 date string
  completed_at TEXT,           -- ISO 8601 datetime, null if in-progress
  hk_duration_minutes INTEGER, -- from HealthKit, nullable
  hk_avg_hr INTEGER,           -- from HealthKit, nullable
  hk_calories INTEGER          -- from HealthKit, nullable
);

-- Set logs (one row per logged set)
CREATE TABLE set_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  weight_lb REAL,
  reps INTEGER,
  completed INTEGER NOT NULL DEFAULT 0  -- 0 or 1
);

-- Body composition entries
CREATE TABLE body_comp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,   -- ISO 8601 date string
  weight_lb REAL NOT NULL,
  body_fat_pct REAL
);

-- Measurement entries
CREATE TABLE measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,   -- ISO 8601 date string
  shoulders_in REAL,
  waist_in REAL,
  arms_flexed_in REAL,
  chest_in REAL,
  quads_in REAL
);
```

---

## Seed data — v5 training plan

Seed the `exercises` table on first launch. The plan is a 6-day PPL split.

### Monday & Thursday — Push (Chest / Shoulders / Triceps)

**Chest** — accent color `#185FA5`

| name | sets | rep_range | notes |
|---|---|---|---|
| Flat barbell bench press | 4 | 6–10 | Alternate with dumbbell bench each session |
| Incline dumbbell press | 3 | 10–12 | Elbows at 45°, full stretch at bottom |
| Machine chest fly | 2 | 12–15 | Finisher — squeeze hard at peak contraction |

**Shoulders** — accent color `#7F77DD`

| name | sets | rep_range | notes |
|---|---|---|---|
| Dumbbell overhead press | 2 | 8–10 | Reduced to 2 sets — volume shifted to laterals |
| Dumbbell lateral raise | 5 | 12–15 | Primary V-taper builder |
| Cable lateral raise | 2 | 15–20 | Low pulley, single arm — constant tension |
| Cable face pull | 4 | 15 | Rope attachment, pull to forehead level |

**Triceps** — accent color `#1D9E75`

| name | sets | rep_range | notes |
|---|---|---|---|
| Cable rope pushdown | 3 | 10–12 | Flare rope at bottom — lateral head |
| Overhead dumbbell tricep extension | 3 | 10–12 | Single arm, deep stretch — long head |

---

### Tuesday — Pull (Back Width / Biceps)

**Back — width** — accent color `#185FA5`

| name | sets | rep_range | notes |
|---|---|---|---|
| Wide grip pull-up | 4 | failure | Full hang at bottom, chin over bar at top |
| Wide grip lat pulldown | 3 | 10–12 | Drive elbows down and back |
| Cable straight arm pulldown | 3 | 12–15 | Constant tension — best pure lat width builder |
| Dumbbell pullover | 3 | 12–15 | Slight bend in elbow, big stretch at top |

**Biceps** — accent color `#7F77DD`

| name | sets | rep_range | notes |
|---|---|---|---|
| Barbell curl / reverse grip curl (superset) | 3 | 12/12 | No rest between grips |
| Seated dumbbell curl | 3 | 10–12 | Supinate at top |
| Preacher machine curl (drop set) | 2 | 15→20 | No rest between drops |

**Grip** — accent color `#888780`

| name | sets | rep_range | notes |
|---|---|---|---|
| Dumbbell farmer carry | 3 | — | 30–40 meters per set, heavy |

---

### Wednesday — Legs (Quad Focus / Calves / Core)

**Quads** — accent color `#185FA5`

| name | sets | rep_range | notes |
|---|---|---|---|
| Barbell back squat | 4 | 6–10 | Primary quad builder — go deep, brace core |
| Bulgarian split squat | 3 | 10–12 | Rear foot elevated |
| Leg press | 3 | 10–12 | Alternate with hack squat each week |
| Leg extension (drop set) | 2 | 15→15 | Slow eccentric |

**Calves** — accent color `#1D9E75`

| name | sets | rep_range | notes |
|---|---|---|---|
| Standing calf raise | 4 | 12–15 | Full stretch at bottom, pause at top |
| Seated calf raise | 3 | 30 | 10 toes out / 10 neutral / 10 toes in |

**Core** — accent color `#888780`

| name | sets | rep_range | notes |
|---|---|---|---|
| Hanging leg raise | 3 | 15 | Control the negative |
| Ab wheel rollout | 2 | failure | From knees, brace hard |

---

### Friday — Pull (Back Thickness / Biceps)

**Back — thickness** — accent color `#185FA5`

| name | sets | rep_range | notes |
|---|---|---|---|
| Deadlift | 4 | 6–8 | Hip hinge, brace core |
| Barbell bent-over row | 4 | 8–10 | Overhand grip — primary thickness builder |
| Chest-supported dumbbell row | 3 | 10–12 | Removes lower back fatigue |
| Seated cable row | 3 | 10–12 | Close grip, drive elbows behind torso |

Biceps same as Tuesday.

---

### Saturday — Legs (Hamstring Focus / Calves / Core)

**Hamstrings & Glutes** — accent color `#185FA5`

| name | sets | rep_range | notes |
|---|---|---|---|
| Lying leg curl | 3 | 12–15 | Pre-fatigue before RDL |
| Romanian deadlift | 4 | 8–10 | Hip hinge, big hamstring stretch |
| Walking lunge | 3 | 10/leg | Progress to barbell loading |
| Hip thrust | 2 | 12 | Drive through heel |

Calves and Core same as Wednesday.

---

### Sunday — Rest

No exercises.

---

## Screen specifications

### Today screen

**Header**
- Title: "Today", subtitle: current day name + session focus (e.g. "Monday — push day")
- Phase badge top-right: color-coded pill showing current phase

**Phase selector** — three pill buttons, full-width row below header
- Cut (blue `#185FA5` active state, down-trend arrow icon)
- Maintain (green `#3B6D11` active state, flat line icon)
- Bulk (amber `#854F0B` active state, up-trend arrow icon)
- Selecting a phase writes to `settings` table (`key: 'phase'`)
- Phase affects cardio frequency display: Cut = 3x/week, Maintain = 2x/week, Bulk = 2x/week

**Catch-up section** — only shown if there are incomplete sets from earlier in the current week
- Each item shows: exercise name, day it was missed, number of sets missed, muscle group
- Urgency logic:
  - If missed 3+ days ago: show triangle warning icon (color `#993C1D`), meta text says "at risk"
  - If missed 1–2 days ago: show clock icon (color `#888780`), meta text says "X days ago"
- Tapping an item navigates to that exercise's logging screen
- Section is hidden entirely if nothing is outstanding

**Weekly split** — list of all 6 training days
- Green dot = session completed that day
- Blue dot = today
- Empty dot = upcoming
- Tapping any day navigates to that day's session screen

**Cardio tracker**
- Shows: "Incline treadmill walk · 12° / 3 mph / 20–30 min"
- Progress bar showing sessions completed vs. weekly target
- Target: Cut = 3x, Maintain/Bulk = 2x
- Cardio sessions logged manually (simple +1 tap)

---

### Session screen

Accessed by tapping a day from Today, or via tab bar (defaults to today's day).

**Header**: day name (e.g. "Push day"), subtitle with day of week and exercise count.

**Exercise list** — grouped by muscle group with section labels
- Each exercise row shows:
  - Left accent border (3px, rounded, muscle-group color)
  - Exercise name (weight 500)
  - Sets · rep range (secondary text)
  - "Last: X lb × Y" in blue (pulled from most recent `set_logs` for that exercise)
  - Set completion counter top-right (e.g. "0/4")
- Tapping a row navigates to the exercise detail screen
- Priority badge on Shoulders section label

**Finish session button** — at bottom of list
- On tap: marks session as complete, attempts HealthKit fetch, shows post-session summary modal

**Post-session summary modal**
- Checkmark icon + "Session complete" title
- Two metric cards: Sets completed (X/total), Volume (total sets × reps × weight in lb)
- HealthKit section (labeled "From Apple Health" with heart icon):
  - Duration (minutes) — clock icon, blue
  - Avg heart rate (bpm) — heart icon, red
  - Active calories (kcal) — lightning icon, amber
  - If HealthKit data unavailable, show "—" for each value with a note "Enable Health access in Settings"
- "Done" button dismisses modal and returns to Today

---

### Exercise detail screen

Accessed by tapping an exercise row in Session.

**Header**: back button to session, exercise name, rep range subtitle.

**"Beat this" card** — prominent card at top
- Trophy/trend-up icon
- Label: "Beat this"
- Value: last session's best set for this exercise (highest weight × reps)
- If no history: shows "No previous data"

**Set logging table**
- Column headers: Set / Weight (lb) / Reps / ✓
- One row per set (count from exercise definition)
- Weight field pre-filled with last session's weight for that set number
- Checkmark button per row — tapping marks set as complete (fills blue)
- All inputs are numeric
- Data auto-saved to `set_logs` on input change (no explicit save button per field)

**Save & back button** — saves session state, navigates back to session screen. Incomplete sets are tracked for the catch-up system.

---

### Body comp screen

**Metric cards** (2×2 grid):
- Weight (lb) — with week-over-week delta
- Body fat % — with week-over-week delta
- Lean mass (lb) — calculated: weight × (1 - body_fat_pct/100)
- Stage target — static display "4–6%" with "X% to go" calculated from current body fat

**Trend chart**
- Dual line chart: weight (blue `#185FA5`) and body fat % (red `#D85A30`)
- 8-week rolling window
- Grid lines, endpoint labels, legend below

**Log today form**
- Weight (lb) input
- Body fat % input (optional — for InBody/DEXA scan days)
- "Save entry" button — writes to `body_comp` table, one entry per date (upsert)

---

### Measurements screen

**Shoulder-to-waist ratio card** — featured card with blue border accent
- Displays calculated ratio to 2 decimal places (shoulders_in / waist_in)
- Target: 1.618
- Progress bar showing proximity to target
- Percentage-off label (e.g. "6% off")
- Hint text: "Expand shoulders or tighten waist to close the gap"

**Current measurements list**
- Shoulders, Waist, Arms (flexed), Chest, Quads
- Each row: label left, value + week-over-week delta right
- Delta: green arrow up for increases in shoulders/arms/chest/quads, red for waist increases, green for waist decreases

**Update form**
- Input fields for each measurement
- "Save measurements" — upserts to `measurements` table by date

---

## HealthKit integration

Library: `react-native-health`

**Permissions requested** (read-only):
- `Permissions.Steps` (not used, required for workout queries on some iOS versions)
- `Permissions.HeartRate`
- `Permissions.ActiveEnergyBurned`
- `Permissions.Workout`

**Fetch logic** — triggered when user taps "Finish session":
1. Query HealthKit for workouts in the last 3 hours
2. Find the most recent workout (any type — user will have started from Apple Watch)
3. Extract: duration (minutes), average heart rate (bpm), active calories (kcal)
4. Store in `sessions` table columns `hk_duration_minutes`, `hk_avg_hr`, `hk_calories`
5. If no workout found or permission denied: display "—" gracefully, do not block session completion

Permission request: prompt on first app launch with a clear explanation ("To show your workout stats after each session").

---

## Catch-up system logic

Runs on app launch and when Today screen is focused.

```
1. Determine current ISO week (Monday–Sunday)
2. For each day that has already passed this week (not including today):
   a. Check if a session exists in `sessions` for that day + date
   b. If session exists: check `set_logs` for any sets where completed = 0
   c. If no session at all: all sets for that day count as missed
3. Build a list of missed exercises with:
   - exercise name, exercise_id, day, date missed, sets missed count, muscle group
   - days_ago = today - date_missed
4. Sort: most urgent (highest days_ago) first
5. Expose via a hook: useCatchupItems()
```

Catch-up items link directly to the exercise detail screen for that exercise, allowing the user to log those sets into a new session entry for the current day (tagged with original exercise_id but current date).

---

## Design system

### Colors

| Token | Hex | Usage |
|---|---|---|
| Primary blue | `#185FA5` | Active nav, buttons, links, chest accent |
| Purple | `#7F77DD` | Shoulders accent |
| Teal | `#1D9E75` | Triceps/calves accent |
| Gray | `#888780` | Grip/core accent, inactive |
| Red | `#D85A30` | Body fat trend, warning |
| Green | `#3B6D11` | Completed dots, positive deltas |
| Amber | `#854F0B` | Calories icon, bulk phase |

### Typography

- Font: System (SF Pro on iOS)
- Screen titles: 22px, weight 500
- Section labels: 11px, weight 500, uppercase, letter-spacing 0.07em, secondary color
- Exercise names: 14px, weight 500
- Supporting text: 12–13px, weight 400, secondary color
- Metric values: 22px, weight 500

### Components

- Cards: white background, 0.5px border, 12px border radius, overflow hidden
- Exercise accent: 3px left border strip, 2px border radius, full exercise row height
- Phase pills: 3 equal-width buttons, 8px border radius, icon + label
- Set check: 24px circle button, fills blue on complete with white checkmark
- Bottom tab bar: 74px height, 0.5px top border, icons 22px stroke weight 1.75
- Progress bars: 4px height, 2px border radius

### Spacing

- Screen horizontal padding: 16px
- Card internal padding: 14px 16px
- Section gap: 16px top padding
- Row internal padding: 13px 16px
- Between cards: 12px margin-bottom

---

## Data persistence notes

- All data is local SQLite — no backend, no sync, no cloud
- Database initialised on first launch via a migration script
- `exercises` table is seeded once (check `settings` for `key: 'seeded'`)
- All writes are synchronous within a transaction where multiple tables are touched
- Weekly catch-up query runs fresh on each Today screen focus — no caching needed

---

## Project setup commands

```bash
npx create-expo-app ClassicPhysique --template blank-typescript
cd ClassicPhysique
npx expo install expo-sqlite
npx expo install expo-router
npm install react-native-health
npm install lucide-react-native
npx expo install expo-dev-client
```

HealthKit requires a bare workflow or dev client — use `expo-dev-client` for local builds. Add the following to `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-health",
        {
          "isClinicalDataEnabled": false
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSHealthShareUsageDescription": "Used to read workout duration, heart rate, and calories after each training session.",
        "NSHealthUpdateUsageDescription": "Not used."
      }
    }
  }
}
```

Build and run on device:
```bash
npx expo run:ios --device
```

---

## Out of scope

- Android support
- Authentication / multi-user
- Cloud sync or backup
- Push notifications
- Rest timers or session timers (user uses Apple Watch)
- Social features
- Exercise library or custom exercise creation (plan is fixed at v5)
- AI-generated programming
