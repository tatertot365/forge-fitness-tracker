# Forge — Personal Trainer App

A personal training companion built with React Native and Expo. Forge runs entirely on-device with a local SQLite database — no account, no cloud, no subscription.

---

## Features

### Home
- **Phase switcher** — toggle between Cut, Maintain, and Bulk to adjust cardio targets and display context across the app
- **Today's session card** — shows the day's training focus, exercise count, and total planned sets; once a session is started it shows live sets-done progress (e.g. "8 / 30 sets done"), a "Resume" CTA, or "✓ Done" when all sets are complete
- **Catch-up queue** — surfaces any sets missed from earlier in the week, with age indicators and per-exercise skip controls; swipe left to dismiss
- **Weekly split strip** — 7-day overview with colour-coded dots (complete, in-progress, missed, skipped, rest)
- **Muscle volume grid** — 2-column grid showing completed sets per muscle group for the current week; only visible once at least one set has been logged
- **Cardio tracker** — configurable cardio exercise with a weekly session counter and progress bar; target adjusts automatically based on current phase

### Training
- **Day sessions** — each training day shows exercises grouped by muscle group with swipe-to-skip and swipe-to-delete
- **Exercise detail** — log weight and reps per set; tap the checkmark to mark a set complete and start the rest timer
- **Set types**
  - Normal — weight + reps
  - Drop set — primary weight/reps + drop weight/reps in one row
  - Superset — link two exercises and navigate between them with a tap
  - Bodyweight — reps only, no weight column; displayed with a "Body weight" badge
- **Beat this** — shows your best set from the last time you did that exercise; tap to see full history with a sparkline
- **Rest timer** — auto-starts on set completion, counts up in the background
- **Exercise management** — add exercises from a searchable library or create new ones; set name, sets, rep range, notes, and type; duplicate or delete from the edit sheet

### Plan
- Manage which days are training days vs rest days, and set a custom focus label per day (e.g. "Push day — heavy")

### Food Log
- Log meals by name, calories, protein, fat, and carbs (fat and carbs are optional — default to 0 if left blank)
- Recent entries surface as quick-add chips showing full macro breakdown
- Daily summary card with progress bars for all four macros
- Configurable calorie, protein, fat, and carbs goals — carry forward until you change them
- 14-day trend charts for calories, protein, fat, and carbs; tap any bar to see that day's full entry list
- History sheet shows per-entry macro breakdown and daily totals vs goals

### Measurements
- Log body stats: weight (lb), body fat %, shoulders, waist, arms (flexed), chest, and quads (in)
- History view with trend tracking

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
| Language | TypeScript |
| Architecture | React Native New Architecture (enabled) |

All data is stored locally in a SQLite database. There is no server, no authentication, and no network requests.

---

## Project Structure

```
app/
  (tabs)/
    index.tsx        # Home screen
    session.tsx      # Session tab
    food.tsx         # Food log
    measure.tsx      # Measurements
  day-session.tsx    # Day workout view
  exercise/[id].tsx  # Exercise detail + set logging
  plan.tsx           # Weekly plan editor

src/
  components/        # Shared UI components
  db/
    client.ts        # SQLite connection
    schema.ts        # Table definitions + migrations
    queries.ts       # All database queries
    seed.ts          # Default exercise data
  theme/             # Colors, spacing, typography
  types.ts           # Shared TypeScript types
  utils/             # Date helpers, haptics, notifications
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
cd personal-trainer-app

# 2. Install dependencies
npm install

# 3. Generate native iOS/Android projects
npm run prebuild
```

> `prebuild` runs `expo prebuild --clean` which writes the `/ios` and `/android` directories from the Expo config. Re-run this any time you add a new native dependency or change `app.json`.

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

The SQLite database is created automatically on first launch. Schema migrations run on every startup via `addColumnIfMissing` in `src/db/schema.ts`, so updates to the schema are non-destructive.

Tables:

| Table | Purpose |
|---|---|
| `exercises` | Exercise definitions (name, sets, rep range, type, muscle group, day) |
| `sessions` | One row per training day per date |
| `set_logs` | Individual set entries (weight, reps, completed flag) |
| `food_entries` | Daily food log (calories, protein, fat, carbs) |
| `nutrition_goals` | Calorie, protein, fat, and carbs targets (carry-forward by date) |
| `measurements` | Body stats snapshots |
| `cardio_sessions` | Cardio log entries |
| `day_plans` | Which days are training days and their focus label |
| `catchup_skips` | Dismissed catch-up items (pruned weekly) |
| `day_skips` | Skipped training days (pruned weekly) |
| `settings` | Key-value store for phase, cardio config, HealthKit flag |

---

## Notes

- **iOS only** in practice — HealthKit (`react-native-health`) is an iOS-only library. The app will build for Android but the health integration will be unavailable.
- The app uses the **React Native New Architecture** (`newArchEnabled: true`). Ensure any third-party native libraries you add support it.
- `expo-dev-client` is required for local development because the app uses custom native modules (HealthKit, Reanimated, Gesture Handler). The standard Expo Go app will not work.
