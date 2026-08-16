import { useFocusEffect } from "expo-router";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Layers,
  Plus,
  ScanLine,
  Search,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Card } from "../../src/components/Card";
import { PhasePills } from "../../src/components/PhasePills";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
import {
  BarcodeResultSheet,
  BarcodeScannerModal,
  DatabaseResultSheet,
  DayHistorySheet,
  EditFoodSheet,
  GoalRow,
  GoalSheet,
  MacroCalculatorSheet,
  FoodLibrarySheet,
  formatMultiplier,
  NutritionTrendChart,
  parseOptional,
  PortionSheet,
  parseRequired,
  SwipeableFoodRow,
} from "../../src/features/food";
import {
  addFoodEntry,
  deleteFoodEntry,
  getActivityLevel,
  getDailyNutritionTotals,
  getFoodEntriesForDate,
  getFoodRecents,
  getGoalsMode,
  getNutritionGoalForDate,
  getPhase,
  getUserProfile,
  latestMeasurement,
  setNutritionGoal,
  setPhase as saveBasePhase,
  updateFoodEntry,
} from "../../src/db/queries";
import { calculateTdee } from "../../src/utils/tdee";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import { useStyles } from "../../src/theme/useStyles";
import {
  type DailyNutritionTotal,
  type FoodEntry,
  type FoodLibraryItem,
  type FoodRecent,
  type NutritionGoal,
  type Phase,
} from "../../src/types";
import { todayISO } from "../../src/utils/date";
import {
  hapticSelect,
  hapticSuccess,
  hapticTap,
} from "../../src/utils/haptics";
import {
  lookupBarcode,
  type FoodFactsResult,
  type FoodSearchItem,
} from "../../src/utils/openFoodFacts";

export default function FoodScreen() {
  const styles = useStyles(makeStyles);
  const [phase, setPhaseState] = useState<Phase>("maintain");
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [recents, setRecents] = useState<FoodRecent[]>([]);
  const [totals, setTotals] = useState<DailyNutritionTotal[]>([]);

  const [name, setName] = useState("");
  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  const [goalSheet, setGoalSheet] = useState(false);
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null);
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [calcSheet, setCalcSheet] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [portionRecent, setPortionRecent] = useState<FoodRecent | null>(null);
  const [librarySheet, setLibrarySheet] = useState(false);
  const [dbResult, setDbResult] = useState<FoodSearchItem | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanResult, setScanResult] = useState<FoodFactsResult | null>(null);
  const [scanLookupBusy, setScanLookupBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const [today, setToday] = useState<string>(() => todayISO());

  const load = useCallback(async () => {
    // Recompute the current date up-front so an open-tab-across-midnight
    // doesn't keep writing entries against yesterday.
    const currentDate = todayISO();
    setToday(currentDate);

    const [g, e, r, t, p] = await Promise.all([
      getNutritionGoalForDate(currentDate),
      getFoodEntriesForDate(currentDate),
      getFoodRecents(12),
      getDailyNutritionTotals(14),
      getPhase(),
    ]);
    setGoal(g);
    setEntries(e);
    setRecents(r);
    setTotals(t);
    setPhaseState(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => sub.remove();
  }, [load]);

  const totalCals = entries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = entries.reduce((s, e) => s + e.protein_g, 0);
  const totalFat = entries.reduce((s, e) => s + e.fat_g, 0);
  const totalCarbs = entries.reduce((s, e) => s + e.carbs_g, 0);

  const clearForm = () => {
    setName("");
    setCalInput("");
    setProteinInput("");
    setFatInput("");
    setCarbsInput("");
  };

  const onAdd = async () => {
    // parseRequired rejects a blank field; parseOptional treats blank as 0.
    // Calories and protein are required, so an empty box must not become 0.
    const cal = parseRequired(calInput);
    const prot = parseRequired(proteinInput);
    const fat = parseOptional(fatInput);
    const carbs = parseOptional(carbsInput);
    if (name.trim() === "") {
      Alert.alert("Enter a food name");
      return;
    }
    if (cal == null) {
      Alert.alert("Enter valid calories");
      return;
    }
    if (prot == null) {
      Alert.alert("Enter valid protein");
      return;
    }
    if (fat == null) {
      Alert.alert("Enter valid fat");
      return;
    }
    if (carbs == null) {
      Alert.alert("Enter valid carbs");
      return;
    }
    await addFoodEntry({
      date: today,
      name: name.trim(),
      calories: cal,
      protein_g: prot,
      fat_g: fat,
      carbs_g: carbs,
    });
    hapticSuccess();
    Keyboard.dismiss();
    clearForm();
    load();
  };

  // The library returns richer rows than the recents strip; the add path only
  // needs the macro fields they share.
  const toRecent = (i: FoodLibraryItem): FoodRecent => ({
    name: i.name,
    calories: i.calories,
    protein_g: i.protein_g,
    fat_g: i.fat_g,
    carbs_g: i.carbs_g,
    last_used_at: i.last_used_at,
  });

  const onTapRecent = async (r: FoodRecent, multiplier = 1) => {
    hapticTap();
    await addFoodEntry({
      date: today,
      name:
        multiplier === 1 ? r.name : `${r.name} (${formatMultiplier(multiplier)})`,
      calories: Math.round(r.calories * multiplier),
      protein_g: Math.round(r.protein_g * multiplier * 10) / 10,
      fat_g: Math.round(r.fat_g * multiplier * 10) / 10,
      carbs_g: Math.round(r.carbs_g * multiplier * 10) / 10,
    });
    setPortionRecent(null);
    load();
  };

  const onDelete = (id: number) => {
    Alert.alert("Delete entry?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFoodEntry(id);
          hapticTap();
          load();
        },
      },
    ]);
  };

  const onSaveEdit = async (
    id: number,
    patch: {
      name: string;
      calories: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
    },
  ) => {
    await updateFoodEntry(id, patch);
    hapticSuccess();
    setEditEntry(null);
    load();
  };

  const onSaveGoal = async (
    cal: number,
    prot: number,
    fat: number,
    carbs: number,
  ) => {
    await setNutritionGoal(today, {
      calorie_goal: cal,
      protein_goal: prot,
      fat_goal: fat,
      carbs_goal: carbs,
    });
    hapticSuccess();
    setGoalSheet(false);
    load();
  };

  const onChangePhase = async (p: Phase) => {
    hapticSelect();
    setPhaseState(p);
    await saveBasePhase(p);

    const [goalsMode, activity, measurement, profile] = await Promise.all([
      getGoalsMode(),
      getActivityLevel(),
      latestMeasurement(),
      getUserProfile(),
    ]);
    if (goalsMode === "calculated" && activity && measurement?.weight_lb) {
      const result = calculateTdee({
        weight_lb: measurement.weight_lb,
        body_fat_pct: measurement.body_fat_pct,
        profile,
        activity,
        phase: p,
      });
      if (result.ok) {
        await setNutritionGoal(today, {
          calorie_goal: result.goals.calories,
          protein_goal: result.goals.protein_g,
          fat_goal: result.goals.fat_g,
          carbs_goal: result.goals.carbs_g,
        });
        const phaseLabel = p === "cut" ? "cut" : p === "bulk" ? "bulk" : "maintain";
        const base = `Goals updated for ${phaseLabel}: ${result.goals.calories} cal · ${result.goals.protein_g}P · ${result.goals.fat_g}F · ${result.goals.carbs_g}C`;
        // Surface floor / protein-trim notes from the calculator so the user
        // sees when their target was adjusted away from the raw formula.
        showToast(result.note ? `${base}\n${result.note}` : base);
      }
    }

    const updatedGoal = await getNutritionGoalForDate(today);
    setGoal(updatedGoal);
  };

  return (
    <>
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Food</Text>
        </View>
        <Pressable
          onPress={() => {
            hapticTap();
            setGoalSheet(true);
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.editGoalBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.editGoalText}>Goals</Text>
        </Pressable>
      </View>

      <View style={{ paddingTop: 8 }}>
        <PhasePills value={phase} onChange={onChangePhase} />
      </View>

      <Card style={{ marginTop: 12 }}>
        <GoalRow
          icon={<Flame size={14} color={colors.red} strokeWidth={2} />}
          label="Calories"
          value={totalCals}
          goal={goal?.calorie_goal ?? 0}
          unit="cal"
          color={colors.red}
        />
        <View style={{ height: 14 }} />
        <GoalRow
          icon={<Zap size={14} color={colors.teal} strokeWidth={2} />}
          label="Protein"
          value={totalProtein}
          goal={goal?.protein_goal ?? 0}
          unit="g"
          color={colors.teal}
        />
        <View style={{ height: 14 }} />
        <GoalRow
          icon={<Droplets size={14} color={colors.amber} strokeWidth={2} />}
          label="Fat"
          value={totalFat}
          goal={goal?.fat_goal ?? 0}
          unit="g"
          color={colors.amber}
        />
        <View style={{ height: 14 }} />
        <GoalRow
          icon={<Layers size={14} color={colors.purple} strokeWidth={2} />}
          label="Carbs"
          value={totalCarbs}
          goal={goal?.carbs_goal ?? 0}
          unit="g"
          color={colors.purple}
        />
      </Card>

      {/* Quick-add: scan / calculator promoted above the manual form so users
          reach the lower-friction options first. */}
      <SectionLabel>Add food</SectionLabel>
      <View style={styles.quickAddRow}>
        <Pressable
          onPress={() => {
            hapticTap();
            setScannerVisible(true);
          }}
          style={({ pressed }) => [
            styles.quickAddBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <ScanLine size={18} color={colors.primary} strokeWidth={2} />
          <Text style={styles.quickAddText}>Scan barcode</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            hapticTap();
            setCalcSheet(true);
          }}
          style={({ pressed }) => [
            styles.quickAddBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Calculator size={18} color={colors.primary} strokeWidth={2} />
          <Text style={styles.quickAddText}>Calculator</Text>
        </Pressable>
      </View>
      {/* Sits outside the recents block on purpose: the strip only renders once
          something has been logged, which would leave the full history
          unreachable on a fresh install. */}
      <Pressable
        onPress={() => {
          hapticTap();
          setLibrarySheet(true);
        }}
        style={({ pressed }) => [
          styles.libraryBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Search size={16} color={colors.primary} strokeWidth={2} />
        <Text style={styles.quickAddText}>Search foods</Text>
      </Pressable>

      {recents.length > 0 ? (
        <>
          <SectionLabel>Recent — tap to add, hold for portion</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentsRow}
          >
            {recents.map((r) => (
              <Pressable
                // Keyed on the lowercased name: the recents query dedupes with
                // LOWER() but returns whatever casing was stored, so raw name
                // is not guaranteed unique across rows.
                key={r.name.toLowerCase()}
                onPress={() => onTapRecent(r)}
                onLongPress={() => {
                  hapticSelect();
                  setPortionRecent(r);
                }}
                delayLongPress={300}
                style={({ pressed }) => [
                  styles.recentChip,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.recentName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.recentMeta}>
                  {Math.round(r.calories)} cal · P {Math.round(r.protein_g)}g ·
                  F {Math.round(r.fat_g)}g · C {Math.round(r.carbs_g)}g
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionLabel>Today&apos;s log</SectionLabel>
      <Card padded={false}>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>
            No entries yet — scan, search, or enter one manually.
          </Text>
        ) : (
          entries.map((e, i) => (
            <SwipeableFoodRow
              key={e.id}
              entry={e}
              isLast={i === entries.length - 1}
              onDelete={() => onDelete(e.id)}
              onEdit={() => {
                hapticTap();
                setEditEntry(e);
              }}
            />
          ))
        )}
      </Card>


      {/* Collapsed by default: it is the slowest path (six fields) and the
          least used once recents exist, but it was occupying the most space
          and pushing today's log below the fold. */}
      <Pressable
        onPress={() => {
          hapticTap();
          setManualOpen((v) => !v);
        }}
        style={({ pressed }) => [
          styles.manualToggle,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.manualToggleText}>Enter manually</Text>
        {manualOpen ? (
          <ChevronUp size={16} color={colors.textSecondary} strokeWidth={2} />
        ) : (
          <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
        )}
      </Pressable>
      {manualOpen ? (
      <Card>
        <Text style={styles.formLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="e.g. Chicken breast"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Calories</Text>
            <TextInput
              value={calInput}
              onChangeText={setCalInput}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="165"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Protein (g)</Text>
            <TextInput
              value={proteinInput}
              onChangeText={setProteinInput}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="31"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Fat (g)</Text>
            <TextInput
              value={fatInput}
              onChangeText={setFatInput}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="7"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Carbs (g)</Text>
            <TextInput
              value={carbsInput}
              onChangeText={setCarbsInput}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </Card>

      ) : null}
      <SectionLabel>Last 14 days</SectionLabel>
      <Card>
        <NutritionTrendChart
          data={totals}
          onTapDay={(date) => {
            hapticSelect();
            setHistoryDate(date);
          }}
        />
      </Card>

      <FoodLibrarySheet
        visible={librarySheet}
        onClose={() => setLibrarySheet(false)}
        onPick={(item) => {
          setLibrarySheet(false);
          onTapRecent(toRecent(item));
        }}
        onLongPick={(item) => {
          hapticSelect();
          setLibrarySheet(false);
          setPortionRecent(toRecent(item));
        }}
        onPickRemote={(item) => {
          hapticSelect();
          setLibrarySheet(false);
          setDbResult(item);
        }}
      />

      <DatabaseResultSheet
        item={dbResult}
        onClose={() => setDbResult(null)}
        onAdd={async (entry) => {
          await addFoodEntry({ date: today, ...entry });
          hapticSuccess();
          setDbResult(null);
          load();
        }}
      />

      <PortionSheet
        recent={portionRecent}
        onClose={() => setPortionRecent(null)}
        onAdd={onTapRecent}
      />

      <GoalSheet
        visible={goalSheet}
        current={goal}
        onClose={() => setGoalSheet(false)}
        onSave={onSaveGoal}
      />

      <EditFoodSheet
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={onSaveEdit}
      />

      <DayHistorySheet
        date={historyDate}
        onClose={() => setHistoryDate(null)}
        onCopied={() => {
          hapticSuccess();
          showToast("Copied to today's log");
          load();
        }}
      />

      <MacroCalculatorSheet
        visible={calcSheet}
        onClose={() => setCalcSheet(false)}
        onAdd={async (entry) => {
          await addFoodEntry({ date: today, ...entry });
          hapticSuccess();
          setCalcSheet(false);
          load();
        }}
      />

      <BarcodeScannerModal
        visible={scannerVisible}
        loading={scanLookupBusy}
        onClose={() => {
          if (scanLookupBusy) return;
          setScannerVisible(false);
        }}
        onScanned={async (barcode) => {
          setScanLookupBusy(true);
          try {
            const result = await lookupBarcode(barcode);
            setScannerVisible(false);
            if (!result.found) {
              Alert.alert(
                "Product not found",
                "This barcode isn't in the Open Food Facts database. Enter the nutrition manually.",
                [{ text: "OK" }],
              );
              if (result.productName) setName(result.productName);
              return;
            }
            setScanResult(result);
          } catch (e: any) {
            setScannerVisible(false);
            Alert.alert("Error", e.message ?? "Could not look up barcode.");
          } finally {
            setScanLookupBusy(false);
          }
        }}
      />

      <BarcodeResultSheet
        result={scanResult}
        onClose={() => setScanResult(null)}
        onAdd={async (entry) => {
          await addFoodEntry({ date: today, ...entry });
          hapticSuccess();
          setScanResult(null);
          load();
        }}
      />
    </Screen>
    {toast ? (
      <View pointerEvents="none" style={styles.toastWrap}>
        <View style={styles.toast}>
          <Text style={styles.toastText} numberOfLines={4}>
            {toast}
          </Text>
        </View>
      </View>
    ) : null}
    </>
  );
}


// ─── styles ───────────────────────────────────────────────────────────

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { ...typography.screenTitle, fontSize: s(22), color: colors.text },

  editGoalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  editGoalText: {
    fontSize: s(12),
    fontWeight: "600",
    color: colors.primary,
  },

  formLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    fontSize: s(15),
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
  },
  addBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },
  manualToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  manualToggleText: { fontSize: s(14), fontWeight: "500", color: colors.text },
  libraryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },

  recentsRow: {
    gap: 8,
    paddingRight: 16,
  },
  recentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minWidth: 120,
    maxWidth: 180,
  },
  recentName: {
    ...typography.exerciseName,
    fontSize: s(14),
    color: colors.text,
  },
  recentMeta: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
  },

  emptyText: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textMuted,
    textAlign: "center",
    padding: 20,
  },

  quickAddRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickAddBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.card,
    backgroundColor: colors.primary + "15",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary + "40",
  },
  quickAddText: { color: colors.primary, fontSize: s(14), fontWeight: "600" },

  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  toast: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    maxWidth: "100%",
  },
  toastText: {
    color: colors.text,
    fontSize: s(13),
    fontWeight: "500",
    textAlign: "center",
  },
});
