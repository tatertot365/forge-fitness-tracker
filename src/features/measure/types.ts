import { type Measurement } from "../../types";

export type CircField = {
  key: keyof Pick<
    Measurement,
    "shoulders_in" | "waist_in" | "arms_flexed_in" | "chest_in" | "quads_in"
  >;
  label: string;
  goodOnIncrease: boolean;
};

export const CIRC_FIELDS: CircField[] = [
  { key: "shoulders_in", label: "Shoulders", goodOnIncrease: true },
  { key: "waist_in", label: "Waist", goodOnIncrease: false },
  { key: "arms_flexed_in", label: "Arms (flexed)", goodOnIncrease: true },
  { key: "chest_in", label: "Chest", goodOnIncrease: true },
  { key: "quads_in", label: "Quads", goodOnIncrease: true },
];

export type Inputs = {
  weight_lb: string;
  body_fat_pct: string;
  shoulders_in: string;
  waist_in: string;
  arms_flexed_in: string;
  chest_in: string;
  quads_in: string;
};

export const EMPTY_INPUTS: Inputs = {
  weight_lb: "",
  body_fat_pct: "",
  shoulders_in: "",
  waist_in: "",
  arms_flexed_in: "",
  chest_in: "",
  quads_in: "",
};

// Sanity ranges — block save outside these to prevent typos flowing into macros.
export const RANGES: Record<keyof Inputs, { min: number; max: number; label: string }> = {
  weight_lb:      { min: 50, max: 700, label: "Weight should be 50–700 lb" },
  body_fat_pct:   { min: 3,  max: 60,  label: "Body fat should be 3–60%" },
  shoulders_in:   { min: 5,  max: 80,  label: "Shoulders should be 5–80 in" },
  waist_in:       { min: 5,  max: 80,  label: "Waist should be 5–80 in" },
  arms_flexed_in: { min: 5,  max: 80,  label: "Arms should be 5–80 in" },
  chest_in:       { min: 5,  max: 80,  label: "Chest should be 5–80 in" },
  quads_in:       { min: 5,  max: 80,  label: "Quads should be 5–80 in" },
};

export const HEIGHT_RANGE = { min: 36, max: 96, label: "Height should be 36–96 in" };
export const HEIGHT_INPUT_ID = "height-input-accessory";
export const AGE_RANGE = { min: 13, max: 100, label: "Age must be 13–100" };

export type ParsedMeasurement = Record<keyof Inputs, number | null>;
