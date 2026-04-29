# Forge — Personal Trainer App

A personal training companion built with React Native and Expo. Forge runs entirely on-device with a local SQLite database — no account, no cloud, no subscription.

---

## Features

### Home
- **Phase switcher** — toggle between Cut, Maintain, and Bulk to adjust calorie/macro targets and cardio frequency across the app
- **Today's session card** — shows the day's training focus, exercise count, and total planned sets; live sets-done progress once started ("8 / 30 sets done"), "Resume" CTA, or "✓ Done" when all sets are complete
- **Today's nutrition card** — macro ring summary (calories, protein, fat, carbs) with progress rings vs. daily goals; taps through to the Food Log
- **Goal progress card** — tracks weight and body fat % toward user-set targets with progress bars and a "X to go" hint; turns green when a goal is reached; prompts to set goals in Measure if none are configured
- **Catch-up queue** — surfaces missed sets from earlier in the week with age indicators and per-exercise skip; swipe left to dismiss
- **Weekly split strip** — 7-day overview with colour-coded dots (complete, in-progress, missed, skipped, rest); tapping a day opens that day's workout
- **Muscle volume grid** — 2-column grid showing completed sets per muscle group for the current week
- **Cardio tracker** — configurable exercise name and description with a weekly session counter and progress bar; target adjusts by phase (Cut 4×, Maintain 3×, Bulk 2×)

### Training
- **Session tab** — shows today's exercises grouped by muscle group; grouping is order-stable (sorted by first `sort_order` seen per group, so interleaved exercises always cluster correctly)
- **Day sessions** — tap any day in the weekly split to open that day's workout; same grouping logic applies; exercises come from the plan regardless of whether the day has already passed
- **Exercise detail** — log weight and reps per set; tap the checkmark to mark a set complete and start the rest timer
- **Set types**
  - Normal — weight + reps
  - Drop set — primary weight/reps + drop weight/reps in one row
  - Superset — link two exercises and navigate between them with a tap
  - Bodyweight — reps only, no weight column; displayed with a "Bodyweight" badge
- **Beat this** — shows your best set from the last completed session for that exercise; tap to see full history with a sparkline
- **Rest timer** — auto-starts on set completion, counts up in the background
- **Exercise management** — add exercises from a searchable library or create new ones; configure sets, rep range, notes, and type; duplicate or delete from the edit sheet; add directly to a muscle group within a session

### Plan
- Manage which days are training days vs rest days with a custom focus label per day (e.g. "Push day — heavy")
- Enabling a day also auto-enables it in the database so it's immediately tappable in the weekly split

### Food Log
- Log meals by name, calories, protein, fat, and carbs (fat and carbs optional — default to 0)
- Recent entries surface as quick-add chips with full macro breakdown
- Daily summary card with progress bars for all four macros
- Configurable calorie and macro goals — carry forward until changed; can be calculated automatically from TDEE
- 14-day trend charts for calories, protein, fat, and carbs; tap any bar to see that day's full entry list
- History sheet shows per-entry breakdown and daily totals vs. goals

### Measurements
- Log body stats: weight (lb), body fat %, shoulders, waist, arms (flexed), chest, and quads (in)
- **Stats grid** — three equal cards showing Weight, Body fat %, and Lean mass (= weight × (1 − bf/100)) with week-over-week deltas
- **Goal progress** — progress bars toward target weight and target body fat %, with "X to go" hints; turns green when reached; edit via the Goals button in the header
- **Shoulder-to-waist ratio card** — shown when both measurements are logged; displays ratio vs. target 1.618 with a progress bar
- **Profile section** — collapsible section for height, date of birth (native date picker wheel), and sex; shows an "Incomplete" badge when any field is missing; used for Mifflin-St Jeor TDEE calculations
- **Trend charts** — line charts for weight and body fat % history (shown once 2+ entries exist)
- Prompt banner to log body fat % if it hasn't been entered yet

### Macro / TDEE calculation
- **Calculated mode** — automatically derives calorie and macro targets from body stats:
  - Uses Katch-McArdle BMR when body fat % is available (lean mass = weight × (1 − bf/100))
  - Falls back to Mifflin-St Jeor when only height, date of birth, and sex are set
  - TDEE = BMR × activity multiplier; phase deltas applied on top (Cut −400 kcal, Maintain ±0, Bulk +300 kcal)
  - Protein target: 1.1 g/lb lean mass (Katch) or 0.85 g/lb bodyweight (Mifflin)
  - Fat and carbs fill remaining calories at a 30/70 split after protein
- **Manual mode** — enter calorie and macro goals directly

### Apple Health (iOS)
- Optional integration — pulls heart rate, active calories, and workout duration from HealthKit after a session is finished
- Prompted once on first use; can be skipped

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo 54 |
| Navigation | Expo Router (file-based, tab layout) |
| Database | expo-sqlite (local SQLite, no backend) |
| Animations | React Native Reanimated 4 |
| Gestures | React Native Gesture Handler |
| Health | react-native-health (HealthKit, iOS only) |
| Icons | lucide-react-native |
| Date picker | @react-native-community/datetimepicker |
| Charts | react-native-svg (custom) |
| Language | TypeScript |
| Architecture | React Native New Architecture (enabled) |

All data is stored locally in a SQLite database. There is no server, no authentication, and no network requests.

---

## Project Structure

```
app/
  (tabs)/
    index.tsx        # Home screen
    session.tsx      # Session tab (today's workout)
    food.tsx         # Food log
    measure.tsx      # Measurements + goals + profile
  day-session.tsx    # Day workout view (opened from weekly split)
  exercise/[id].tsx  # Exercise detail + set logging
  plan.tsx           # Weekly plan editor

src/
  components/        # Shared UI components
  db/
    client.ts        # SQLite connection
    schema.ts        # Table definitions + migrations
    queries.ts       # All database queries
    seed.ts          # Default exercise library data
  theme/             # Colors, spacing, typography
  types.ts           # Shared TypeScript types
  utils/
    date.ts          # ISO date helpers, weekDates()
    tdee.ts          # BMR / TDEE / macro calculations
    haptics.ts       # Haptic feedback wrappers
  health.ts          # HealthKit integration
```

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- **Xcode** 15 or later (for iOS builds) — available from the Mac App Store
- An **Apple Developer account** (free tier works for personal device installs)
- A physical iOS device (recommended; simulator does not support HealthKit)

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/tatertot365/forge-fitness-tracker.git
cd personal-trainer-app/forge-app

# 2. Install dependencies
npm install

# 3. Generate native iOS/Android projects
npm run prebuild
```

> `prebuild` runs `expo prebuild --clean` which writes the `/ios` and `/android` directories from the Expo config. Re-run any time you add a new native dependency or change `app.json`.

---

## Running on a Device (iOS)

### Option A — Expo Dev Client (recommended for development)

```bash
# Connect your iPhone via USB, then:
npm run ios
```

This builds a debug binary with the Expo Dev Client, installs it on your phone, and opens Metro bundler. Subsequent JS changes reload instantly without rebuilding.

**First time only:** you may need to trust the developer certificate on your device under **Settings → General → VPN & Device Management**.

### Option B — Xcode

1. Open `ios/Forge.xcworkspace` in Xcode
2. Select your device from the device picker
3. Set your team under **Signing & Capabilities**
4. Press **Run** (⌘R)

---

## Running on Android

```bash
# Connect your Android device via USB with USB debugging enabled, then:
npm run android
```

Or open the `android/` folder in Android Studio and run from there.

---

## Other Commands

```bash
# Start Metro bundler only (if the app is already installed)
npm start

# Type-check the project
npm run typecheck

# Regenerate native projects from scratch
npm run prebuild
```

---

## Database

The SQLite database is created automatically on first launch. Migrations run on every startup — schema changes are non-destructive. On init, any day in `day_plans` that has exercises in `day_exercises` is automatically enabled, ensuring past-added exercises always appear as tappable in the weekly split.

| Table | Purpose |
|---|---|
| `exercises` | Exercise library (name, muscle group, notes) |
| `day_exercises` | Exercises assigned to a day (sets, rep range, sort order, type) |
| `day_plans` | Which days are training days and their focus label |
| `sessions` | One row per training day per date |
| `set_logs` | Individual set entries (weight, reps, completed flag) |
| `food_entries` | Daily food log (calories, protein, fat, carbs) |
| `nutrition_goals` | Calorie and macro targets (carry-forward by date) |
| `measurements` | Body stats snapshots (weight, body fat %, circumferences) |
| `cardio_sessions` | Cardio log entries |
| `catchup_skips` | Dismissed catch-up items (pruned weekly) |
| `day_skips` | Skipped training days (pruned weekly) |
| `settings` | Key-value store for phase, goals mode, activity level, profile fields, body goals, cardio config, HealthKit flag |

---

## Notes

- **iOS only** in practice — HealthKit (`react-native-health`) is an iOS-only library. The app will build for Android but the health integration will be unavailable.
- The app uses the **React Native New Architecture** (`newArchEnabled: true`). Ensure any third-party native libraries you add support it.
- `expo-dev-client` is required for local development because the app uses custom native modules (HealthKit, Reanimated, Gesture Handler). The standard Expo Go app will not work.
- Age for TDEE calculations is derived at runtime from the stored date of birth, so it stays current across birthdays without requiring any data updates.
