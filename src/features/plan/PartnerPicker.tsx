import { Minus, Plus } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors, muscleAccent } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import {
  MUSCLE_LABEL,
  type Exercise,
  type MuscleGroup,
} from "../../types";
import { makeSs } from "./sheetStyles";

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  "chest",
  "shoulders",
  "triceps",
  "back-width",
  "back-thickness",
  "biceps",
  "grip",
  "traps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
];

// ─── PartnerPicker ────────────────────────────────────────────────────────────

export type PartnerPickerValue =
  | { kind: "existing"; exercise: Exercise }
  | {
      kind: "new";
      name: string;
      muscleGroup: MuscleGroup;
      sets: number;
      repRange: string;
    };

export type PartnerPickerProps = {
  dayExercises: Exercise[];
  value: PartnerPickerValue | null;
  onChange: (v: PartnerPickerValue | null) => void;
};

export function PartnerPicker({ dayExercises, value, onChange }: PartnerPickerProps) {
  const ss = useStyles(makeSs);
  const [mode, setMode] = useState<"library" | "new">(
    value?.kind === "new" ? "new" : "library",
  );
  const [search, setSearch] = useState("");
  const [npName, setNpName] = useState(value?.kind === "new" ? value.name : "");
  const [npMg, setNpMg] = useState<MuscleGroup | null>(
    value?.kind === "new" ? value.muscleGroup : null,
  );
  const [npSets, setNpSets] = useState(value?.kind === "new" ? value.sets : 3);
  const [npRepRange, setNpRepRange] = useState(
    value?.kind === "new" ? value.repRange : "8–12",
  );

  const switchMode = (m: "library" | "new") => {
    setMode(m);
    onChange(null);
  };

  const selectExisting = (ex: Exercise) => {
    onChange({ kind: "existing", exercise: ex });
  };

  const updateNew = (patch: {
    name?: string;
    mg?: MuscleGroup | null;
    sets?: number;
    repRange?: string;
  }) => {
    const n = patch.name !== undefined ? patch.name : npName;
    const m = patch.mg !== undefined ? patch.mg : npMg;
    const s = patch.sets !== undefined ? patch.sets : npSets;
    const r = patch.repRange !== undefined ? patch.repRange : npRepRange;

    if (patch.name !== undefined) setNpName(patch.name);
    if (patch.mg !== undefined) setNpMg(patch.mg);
    if (patch.sets !== undefined) setNpSets(patch.sets);
    if (patch.repRange !== undefined) setNpRepRange(patch.repRange);

    if (n.trim() && m) {
      onChange({
        kind: "new",
        name: n.trim(),
        muscleGroup: m,
        sets: s,
        repRange: r.trim() || "8–12",
      });
    } else {
      onChange(null);
    }
  };

  const filtered = search.trim()
    ? dayExercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
      )
    : dayExercises;

  return (
    <View>
      <View style={[ss.modeToggle, { marginTop: 6 }]}>
        {(["library", "new"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            style={[ss.modeBtn, mode === m && ss.modeBtnActive]}
          >
            <Text style={[ss.modeBtnText, mode === m && ss.modeBtnTextActive]}>
              {m === "library" ? "From this day" : "Create new"}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "library" && (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={[ss.input, { marginBottom: 8 }]}
            placeholder="Search exercises…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {filtered.length === 0 ? (
            <Text style={ss.emptyText}>
              {search.trim()
                ? "No matches"
                : 'No other exercises on this day — use "Create new" to add one'}
            </Text>
          ) : (
            <View style={ss.listContainer}>
              {filtered.map((ex) => {
                const isSel =
                  value?.kind === "existing" && value.exercise.id === ex.id;
                return (
                  <Pressable
                    key={ex.id}
                    onPress={() => selectExisting(ex)}
                    style={({ pressed }) => [
                      ss.libraryRow,
                      isSel && ss.libraryRowSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          ss.libraryRowName,
                          isSel && ss.libraryRowNameSelected,
                        ]}
                      >
                        {ex.name}
                      </Text>
                      <Text style={ss.libraryRowMeta}>
                        {ex.sets} sets · {ex.rep_range}
                      </Text>
                    </View>
                    {isSel && (
                      <View style={ss.checkBadge}>
                        <Text style={ss.checkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {mode === "new" && (
        <>
          <Text style={ss.fieldLabel}>Name</Text>
          <TextInput
            value={npName}
            onChangeText={(t: string) => updateNew({ name: t })}
            style={ss.input}
            placeholder="e.g. Overhead tricep extension"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          <Text style={ss.fieldLabel}>Muscle group</Text>
          <View style={ss.pillRow}>
            {ALL_MUSCLE_GROUPS.map((mg) => {
              const active = npMg === mg;
              const accent = muscleAccent[mg] ?? colors.primary;
              return (
                <Pressable
                  key={mg}
                  onPress={() => updateNew({ mg: active ? null : mg })}
                  style={({ pressed }) => [
                    ss.pill,
                    active && {
                      backgroundColor: accent + "28",
                      borderColor: accent,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      ss.pillText,
                      active && { color: accent, fontWeight: "600" },
                    ]}
                  >
                    {MUSCLE_LABEL[mg]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={ss.fieldLabel}>Sets</Text>
          <View style={ss.stepperRow}>
            <Pressable
              onPress={() => updateNew({ sets: Math.max(1, npSets - 1) })}
              style={({ pressed }) => [
                ss.stepperBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Minus size={16} color={colors.text} />
            </Pressable>
            <Text style={ss.stepperValue}>{npSets}</Text>
            <Pressable
              onPress={() => updateNew({ sets: Math.min(10, npSets + 1) })}
              style={({ pressed }) => [
                ss.stepperBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Plus size={16} color={colors.text} />
            </Pressable>
          </View>

          <Text style={ss.fieldLabel}>Rep range</Text>
          <TextInput
            value={npRepRange}
            onChangeText={(t: string) => updateNew({ repRange: t })}
            style={ss.input}
            placeholder="e.g. 8–12"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}
    </View>
  );
}
