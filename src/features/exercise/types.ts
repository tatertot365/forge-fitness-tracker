// Row shapes for the exercise detail screen's set table. Working (string)
// values, not persisted SetLog rows — they hold in-progress text input.

export type Row = {
  setNumber: number;
  weight: string;
  reps: string;
  dropWeight: string;
  dropReps: string;
  /** Timed exercises only: the set's time as typed, e.g. "45s" or "1:15". */
  time: string;
  completed: boolean;
};

export type WarmupRow = {
  setNumber: number; // negative: -1 = W1, -2 = W2, etc.
  weight: string;
  reps: string;
};
