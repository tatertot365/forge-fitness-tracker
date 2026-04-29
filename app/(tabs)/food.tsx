import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import {
  Calculator,
  Droplets,
  Flame,
  Layers,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Svg, { Line, Rect } from "react-native-svg";
import { Card } from "../../src/components/Card";
import { ProgressBar } from "../../src/components/ProgressBar";
import { Screen } from "../../src/components/Screen";
import { SectionLabel } from "../../src/components/SectionLabel";
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
  setActivityLevel,
  setGoalsMode,
  setNutritionGoal,
  updateFoodEntry,
} from "../../src/db/queries";
import {
  ACTIVITY_LABEL,
  calculateTdee,
  type ActivityLevel,
  type MacroGoals,
} from "../../src/utils/tdee";
import { colors } from "../../src/theme/colors";
import { radius, typography } from "../../src/theme/spacing";
import {
  type DailyNutritionTotal,
  type FoodEntry,
  type FoodRecent,
  type NutritionGoal,
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
} from "../../src/utils/openFoodFacts";

export default function FoodScreen() {
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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanResult, setScanResult] = useState<FoodFactsResult | null>(null);

  const today = todayISO();

  const load = useCallback(async () => {
    const [g, e, r, t] = await Promise.all([
      getNutritionGoalForDate(today),
      getFoodEntriesForDate(today),
      getFoodRecents(12),
      getDailyNutritionTotals(14),
    ]);
    setGoal(g);
    setEntries(e);
    setRecents(r);
    setTotals(t);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
    const cal = Number(calInput);
    const prot = Number(proteinInput);
    const fat = fatInput.trim() === "" ? 0 : Number(fatInput);
    const carbs = carbsInput.trim() === "" ? 0 : Number(carbsInput);
    if (name.trim() === "") {
      Alert.alert("Enter a food name");
      return;
    }
    if (!Number.isFinite(cal) || cal < 0) {
      Alert.alert("Enter valid calories");
      return;
    }
    if (!Number.isFinite(prot) || prot < 0) {
      Alert.alert("Enter valid protein");
      return;
    }
    if (!Number.isFinite(fat) || fat < 0) {
      Alert.alert("Enter valid fat");
      return;
    }
    if (!Number.isFinite(carbs) || carbs < 0) {
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

  const onTapRecent = async (r: FoodRecent) => {
    hapticTap();
    await addFoodEntry({
      date: today,
      name: r.name,
      calories: r.calories,
      protein_g: r.protein_g,
      fat_g: r.fat_g,
      carbs_g: r.carbs_g,
    });
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

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Food</Text>
          <Text style={styles.subtitle}>{formatHeaderDate(today)}</Text>
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
          <Pencil size={12} color={colors.primary} strokeWidth={2} />
          <Text style={styles.editGoalText}>Goals</Text>
        </Pressable>
      </View>

      <Card>
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

      <SectionLabel>Log food</SectionLabel>
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
        <View style={styles.secondaryBtnRow}>
          <Pressable
            onPress={() => {
              hapticTap();
              setCalcSheet(true);
            }}
            style={({ pressed }) => [
              styles.calcBtn,
              { flex: 1 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Calculator size={14} color={colors.primary} strokeWidth={2} />
            <Text style={styles.calcBtnText}>Calculate macros</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              hapticTap();
              setScannerVisible(true);
            }}
            style={({ pressed }) => [
              styles.calcBtn,
              { flex: 1 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <ScanLine size={14} color={colors.primary} strokeWidth={2} />
            <Text style={styles.calcBtnText}>Scan barcode</Text>
          </Pressable>
        </View>
      </Card>

      {recents.length > 0 ? (
        <>
          <SectionLabel>Recent — tap to re-add</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentsRow}
          >
            {recents.map((r) => (
              <Pressable
                key={r.name}
                onPress={() => onTapRecent(r)}
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
            No entries yet — add a food above.
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
        onClose={() => setScannerVisible(false)}
        onScanned={async (barcode) => {
          setScannerVisible(false);
          try {
            const result = await lookupBarcode(barcode);
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
            Alert.alert("Error", e.message ?? "Could not look up barcode.");
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
  );
}

// ─── Barcode scanner modal ────────────────────────────────────────────

function BarcodeScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  React.useEffect(() => {
    if (visible) {
      scanned.current = false;
      if (!permission?.granted) requestPermission();
    }
  }, [visible]);

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={scan.container}>
          <Text style={scan.deniedText}>
            Camera access is required to scan barcodes.
          </Text>
          <Pressable onPress={onClose} style={scan.closeBtn}>
            <Text style={scan.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={scan.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={(result) => {
            if (scanned.current) return;
            scanned.current = true;
            onScanned(result.data);
          }}
          barcodeScannerSettings={{
            barcodeTypes: [
              "ean13",
              "ean8",
              "upc_a",
              "upc_e",
              "code128",
              "code39",
            ],
          }}
        />
        {/* Overlay */}
        <View style={scan.overlay}>
          <View style={scan.topShade} />
          <View style={scan.middleRow}>
            <View style={scan.sideShade} />
            <View style={scan.window}>
              <View style={[scan.corner, scan.tl]} />
              <View style={[scan.corner, scan.tr]} />
              <View style={[scan.corner, scan.bl]} />
              <View style={[scan.corner, scan.br]} />
            </View>
            <View style={scan.sideShade} />
          </View>
          <View style={scan.bottomShade}>
            <Text style={scan.hint}>Point at a barcode</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                scan.cancelBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={scan.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Barcode result sheet ─────────────────────────────────────────────

function BarcodeResultSheet({
  result,
  onClose,
  onAdd,
}: {
  result: FoodFactsResult | null;
  onClose: () => void;
  onAdd: (entry: {
    name: string;
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  }) => void;
}) {
  const [servingsInput, setServingsInput] = useState("1");
  const [calsInput, setCalsInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  React.useEffect(() => {
    if (result?.found) {
      setServingsInput("1");
      setCalsInput(String(result.caloriesPerServing));
      setProteinInput(String(result.proteinPerServing));
      setFatInput(String(result.fatPerServing));
      setCarbsInput(String(result.carbsPerServing));
    }
  }, [result]);

  if (!result?.found) return null;

  const servings = parseFloat(servingsInput) || 0;
  const totalCals = Math.round((parseFloat(calsInput) || 0) * servings);
  const totalProtein =
    Math.round((parseFloat(proteinInput) || 0) * servings * 10) / 10;
  const totalFat = Math.round((parseFloat(fatInput) || 0) * servings * 10) / 10;
  const totalCarbs =
    Math.round((parseFloat(carbsInput) || 0) * servings * 10) / 10;
  const hasResult = servings > 0;

  const save = () => {
    if (!hasResult) {
      Alert.alert("Enter a valid serving amount");
      return;
    }
    onAdd({
      name: result.productName,
      calories: totalCals,
      protein_g: totalProtein,
      fat_g: totalFat,
      carbs_g: totalCarbs,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {result.productName}
              </Text>
              <Text style={styles.sheetSubtitle}>
                1 serving = {result.servingDescription}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.formLabel, { marginBottom: 4 }]}>
              Per serving — tap to correct
            </Text>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Calories</Text>
                <TextInput
                  value={calsInput}
                  onChangeText={setCalsInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Protein (g)</Text>
                <TextInput
                  value={proteinInput}
                  onChangeText={setProteinInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
            </View>
            <View style={[styles.formRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Fat (g)</Text>
                <TextInput
                  value={fatInput}
                  onChangeText={setFatInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Carbs (g)</Text>
                <TextInput
                  value={carbsInput}
                  onChangeText={setCarbsInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
            </View>

            <Text style={[styles.formLabel, { marginTop: 14 }]}>
              How many servings?
            </Text>
            <TextInput
              value={servingsInput}
              onChangeText={setServingsInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput]}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />

            {hasResult && servings !== 1 ? (
              <View style={styles.calcResult}>
                <Text style={styles.calcResultTitle}>
                  Total for {servingsInput} servings
                </Text>
                <View style={styles.calcResultRow}>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>
                      {totalCals.toLocaleString()}
                    </Text>
                    <Text style={styles.calcResultLabel}>cal</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalProtein}g</Text>
                    <Text style={styles.calcResultLabel}>protein</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalFat}g</Text>
                    <Text style={styles.calcResultLabel}>fat</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalCarbs}g</Text>
                    <Text style={styles.calcResultLabel}>carbs</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={save}
              style={({ pressed }) => [
                styles.saveBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Add to log</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Macro calculator sheet ───────────────────────────────────────────

const UNITS = [
  "g",
  "oz",
  "ml",
  "fl oz",
  "tbsp",
  "cup",
  "slice",
  "piece",
] as const;
type ServingUnit = (typeof UNITS)[number];

function MacroCalculatorSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (entry: {
    name: string;
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  }) => void;
}) {
  const [foodName, setFoodName] = useState("");
  const [unit, setUnit] = useState<ServingUnit>("g");
  const [servingSizeInput, setServingSizeInput] = useState("");
  const [calsInput, setCalsInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");
  const [amountInput, setAmountInput] = useState("");

  const servingSize = parseFloat(servingSizeInput) || 0;
  const amount = parseFloat(amountInput) || 0;
  const ratio = servingSize > 0 && amount > 0 ? amount / servingSize : 0;

  const totalCals = Math.round((parseFloat(calsInput) || 0) * ratio);
  const totalProtein =
    Math.round((parseFloat(proteinInput) || 0) * ratio * 10) / 10;
  const totalFat = Math.round((parseFloat(fatInput) || 0) * ratio * 10) / 10;
  const totalCarbs =
    Math.round((parseFloat(carbsInput) || 0) * ratio * 10) / 10;

  const hasResult = ratio > 0;

  const reset = () => {
    setFoodName("");
    setUnit("g");
    setServingSizeInput("");
    setCalsInput("");
    setProteinInput("");
    setFatInput("");
    setCarbsInput("");
    setAmountInput("");
  };

  const pickUnit = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...UNITS, "Cancel"],
        cancelButtonIndex: UNITS.length,
        title: "Serving unit",
      },
      (idx) => {
        if (idx < UNITS.length) setUnit(UNITS[idx]);
      },
    );
  };

  const save = () => {
    if (foodName.trim() === "") {
      Alert.alert("Enter a food name");
      return;
    }
    if (servingSize <= 0) {
      Alert.alert("Enter a valid serving size");
      return;
    }
    if (amount <= 0) {
      Alert.alert("Enter how much you had");
      return;
    }
    if ((parseFloat(calsInput) || 0) < 0) {
      Alert.alert("Enter valid calories");
      return;
    }
    onAdd({
      name: foodName.trim(),
      calories: totalCals,
      protein_g: totalProtein,
      fat_g: totalFat,
      carbs_g: totalCarbs,
    });
    reset();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Calculate macros</Text>
            <Pressable
              onPress={() => {
                onClose();
                reset();
              }}
              hitSlop={10}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formLabel}>Food name</Text>
            <TextInput
              value={foodName}
              onChangeText={setFoodName}
              style={[styles.input, styles.sheetInput]}
              placeholder="e.g. Chicken breast"
              placeholderTextColor={colors.textMuted}
            />

            <View style={[styles.formRow, { marginTop: 10 }]}>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.formLabel}>Serving size</Text>
                <TextInput
                  value={servingSizeInput}
                  onChangeText={setServingSizeInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
                  placeholder="100"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Unit</Text>
                <Pressable
                  onPress={pickUnit}
                  style={({ pressed }) => [
                    styles.unitPicker,
                    styles.sheetInput,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.unitPickerText}>{unit}</Text>
                  <Text style={styles.unitPickerChevron}>›</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.calcSectionLabel, { marginTop: 14 }]}>
              Nutrition per serving
            </Text>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Calories</Text>
                <TextInput
                  value={calsInput}
                  onChangeText={setCalsInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
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
                  style={[styles.input, styles.sheetInput]}
                  placeholder="31"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            <View style={[styles.formRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Fat (g)</Text>
                <TextInput
                  value={fatInput}
                  onChangeText={setFatInput}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.sheetInput]}
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
                  style={[styles.input, styles.sheetInput]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={[styles.calcSectionLabel, { marginTop: 14 }]}>
              Amount you had
            </Text>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              style={[styles.input, styles.sheetInput]}
              placeholder={`e.g. 150 ${unit}`}
              placeholderTextColor={colors.textMuted}
            />

            {hasResult ? (
              <View style={styles.calcResult}>
                <Text style={styles.calcResultTitle}>Calculated totals</Text>
                <View style={styles.calcResultRow}>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>
                      {totalCals.toLocaleString()}
                    </Text>
                    <Text style={styles.calcResultLabel}>cal</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalProtein}g</Text>
                    <Text style={styles.calcResultLabel}>protein</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalFat}g</Text>
                    <Text style={styles.calcResultLabel}>fat</Text>
                  </View>
                  <View style={styles.calcResultItem}>
                    <Text style={styles.calcResultValue}>{totalCarbs}g</Text>
                    <Text style={styles.calcResultLabel}>carbs</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={save}
              style={({ pressed }) => [
                styles.saveBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Add to log</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Goal row ─────────────────────────────────────────────────────────

function GoalRow({
  icon,
  label,
  value,
  goal,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const remaining = Math.max(0, goal - value);
  const over = value > goal;
  return (
    <View>
      <View style={styles.goalHeader}>
        <View style={styles.goalLabelRow}>
          {icon}
          <Text style={styles.goalLabel}>{label}</Text>
        </View>
        <Text style={styles.goalValue}>
          {Math.round(value).toLocaleString()}
          <Text style={styles.goalGoal}>
            {" / "}
            {Math.round(goal).toLocaleString()} {unit}
          </Text>
        </Text>
      </View>
      <ProgressBar
        value={value}
        max={goal}
        color={over ? colors.warning : color}
      />
      <Text style={[styles.goalRemaining, over && { color: colors.warning }]}>
        {over
          ? `${Math.round(value - goal).toLocaleString()} ${unit} over`
          : `${Math.round(remaining).toLocaleString()} ${unit} left`}
      </Text>
    </View>
  );
}

// ─── Swipeable entry row ──────────────────────────────────────────────

function SwipeableFoodRow({
  entry,
  isLast,
  onDelete,
  onEdit,
}: {
  entry: FoodEntry;
  isLast: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const renderRight = () => (
    <View style={styles.swipeActions}>
      <Pressable
        onPress={() => {
          ref.current?.close();
          onDelete();
        }}
        style={({ pressed }) => [
          styles.swipeAction,
          { backgroundColor: colors.red },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Trash2 size={18} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.swipeLabel}>Delete</Text>
      </Pressable>
    </View>
  );
  return (
    <ReanimatedSwipeable
      ref={ref}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.entryRow,
          !isLast && styles.entryRowDivider,
          pressed && { backgroundColor: "rgba(0,0,0,0.02)" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.entryName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.entryMeta}>
            P {Math.round(entry.protein_g)}g · F {Math.round(entry.fat_g)}g · C{" "}
            {Math.round(entry.carbs_g)}g
          </Text>
        </View>
        <Text style={styles.entryCal}>
          {Math.round(entry.calories).toLocaleString()}
          <Text style={styles.entryCalUnit}> cal</Text>
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

// ─── Goal sheet ───────────────────────────────────────────────────────

const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

function GoalSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: NutritionGoal | null;
  onClose: () => void;
  onSave: (cal: number, prot: number, fat: number, carbs: number) => void;
}) {
  const [mode, setMode] = useState<"calculated" | "manual">("manual");
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [calculated, setCalculated] = useState<MacroGoals | null>(null);
  const [calcNote, setCalcNote] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  React.useEffect(() => {
    if (!visible) return;
    // Load persisted mode + activity
    (async () => {
      const [m, a] = await Promise.all([getGoalsMode(), getActivityLevel()]);
      setMode(m);
      setActivity(a);
    })();
    // Populate manual fields from current goal
    if (current) {
      setCalInput(String(Math.round(current.calorie_goal)));
      setProteinInput(String(Math.round(current.protein_goal)));
      setFatInput(String(Math.round(current.fat_goal)));
      setCarbsInput(String(Math.round(current.carbs_goal)));
    }
  }, [visible]);

  // Recalculate whenever activity, mode, or visibility changes
  React.useEffect(() => {
    if (!visible || mode !== "calculated" || !activity) {
      setCalculated(null);
      setCalcError(null);
      return;
    }
    (async () => {
      const [measurement, phase, profile] = await Promise.all([
        latestMeasurement(),
        getPhase(),
        getUserProfile(),
      ]);
      if (!measurement?.weight_lb) {
        setCalcError(
          "No weight logged yet. Add an entry in the Measurements tab first.",
        );
        setCalculated(null);
        return;
      }
      const result = calculateTdee({
        weight_lb: measurement.weight_lb,
        body_fat_pct: measurement.body_fat_pct,
        profile,
        activity,
        phase,
      });
      if (result.ok) {
        setCalculated(result.goals);
        setCalcNote(result.note);
        setCalcError(null);
      } else {
        setCalcError(result.reason);
        setCalculated(null);
      }
    })();
  }, [visible, mode, activity]);

  const switchMode = async (m: "calculated" | "manual") => {
    if (m === "manual" && calculated) {
      // Pre-fill manual fields with calculated values when switching away
      setCalInput(String(calculated.calories));
      setProteinInput(String(calculated.protein_g));
      setFatInput(String(calculated.fat_g));
      setCarbsInput(String(calculated.carbs_g));
    }
    setMode(m);
    await setGoalsMode(m);
  };

  const onPickActivity = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...ACTIVITY_LEVELS.map((a) => ACTIVITY_LABEL[a]), "Cancel"],
        cancelButtonIndex: ACTIVITY_LEVELS.length,
        title: "Activity level",
      },
      async (idx) => {
        if (idx < ACTIVITY_LEVELS.length) {
          const chosen = ACTIVITY_LEVELS[idx];
          setActivity(chosen);
          await setActivityLevel(chosen);
        }
      },
    );
  };

  const save = async () => {
    if (mode === "calculated") {
      if (!calculated) return;
      onSave(
        calculated.calories,
        calculated.protein_g,
        calculated.fat_g,
        calculated.carbs_g,
      );
    } else {
      const c = Number(calInput);
      const p = Number(proteinInput);
      const f = Number(fatInput);
      const cb = Number(carbsInput);
      if (!Number.isFinite(c) || c <= 0) {
        Alert.alert("Enter a valid calorie goal");
        return;
      }
      if (!Number.isFinite(p) || p <= 0) {
        Alert.alert("Enter a valid protein goal");
        return;
      }
      if (!Number.isFinite(f) || f < 0) {
        Alert.alert("Enter a valid fat goal");
        return;
      }
      if (!Number.isFinite(cb) || cb < 0) {
        Alert.alert("Enter a valid carbs goal");
        return;
      }
      onSave(c, p, f, cb);
    }
  };

  const canSave =
    mode === "manual"
      ? Number(calInput) > 0 && Number(proteinInput) > 0
      : calculated !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Daily goals</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            {(["calculated", "manual"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    mode === m && styles.modeBtnTextActive,
                  ]}
                >
                  {m === "calculated" ? "Calculated" : "Manual"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === "calculated" ? (
              <>
                <Text style={styles.formLabel}>Activity level</Text>
                <Pressable
                  onPress={onPickActivity}
                  style={({ pressed }) => [
                    styles.input,
                    styles.sheetInput,
                    styles.pickerRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={
                      activity ? styles.pickerText : styles.pickerPlaceholder
                    }
                    numberOfLines={1}
                  >
                    {activity
                      ? ACTIVITY_LABEL[activity]
                      : "Select activity level…"}
                  </Text>
                  <Text style={styles.unitPickerChevron}>›</Text>
                </Pressable>

                {calcError ? (
                  <View style={styles.calcWarning}>
                    <Text style={styles.calcWarningText}>{calcError}</Text>
                  </View>
                ) : calculated ? (
                  <>
                    <View style={styles.calcResult}>
                      <Text style={styles.calcResultTitle}>
                        Calculated goals
                      </Text>
                      <View style={styles.calcResultRow}>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.calories.toLocaleString()}
                          </Text>
                          <Text style={styles.calcResultLabel}>cal</Text>
                        </View>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.protein_g}g
                          </Text>
                          <Text style={styles.calcResultLabel}>protein</Text>
                        </View>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.fat_g}g
                          </Text>
                          <Text style={styles.calcResultLabel}>fat</Text>
                        </View>
                        <View style={styles.calcResultItem}>
                          <Text style={styles.calcResultValue}>
                            {calculated.carbs_g}g
                          </Text>
                          <Text style={styles.calcResultLabel}>carbs</Text>
                        </View>
                      </View>
                    </View>
                    {calcNote ? (
                      <Text style={styles.calcNoteText}>{calcNote}</Text>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Calories</Text>
                    <TextInput
                      value={calInput}
                      onChangeText={setCalInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="2500"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Protein (g)</Text>
                    <TextInput
                      value={proteinInput}
                      onChangeText={setProteinInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="180"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View style={[styles.formRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Fat (g)</Text>
                    <TextInput
                      value={fatInput}
                      onChangeText={setFatInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="80"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Carbs (g)</Text>
                    <TextInput
                      value={carbsInput}
                      onChangeText={setCarbsInput}
                      keyboardType="number-pad"
                      style={[styles.input, styles.sheetInput]}
                      placeholder="250"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </>
            )}

            <Pressable
              onPress={save}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveBtn,
                !canSave && { opacity: 0.4 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Apply goals</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit entry sheet ─────────────────────────────────────────────────

function EditFoodSheet({
  entry,
  onClose,
  onSave,
}: {
  entry: FoodEntry | null;
  onClose: () => void;
  onSave: (
    id: number,
    patch: {
      name: string;
      calories: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
    },
  ) => void;
}) {
  const [name, setName] = useState("");
  const [calInput, setCalInput] = useState("");
  const [proteinInput, setProteinInput] = useState("");
  const [fatInput, setFatInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");

  React.useEffect(() => {
    if (entry) {
      setName(entry.name);
      setCalInput(String(entry.calories));
      setProteinInput(String(entry.protein_g));
      setFatInput(String(entry.fat_g));
      setCarbsInput(String(entry.carbs_g));
    }
  }, [entry]);

  const save = () => {
    if (!entry) return;
    const c = Number(calInput);
    const p = Number(proteinInput);
    const f = fatInput.trim() === "" ? 0 : Number(fatInput);
    const cb = carbsInput.trim() === "" ? 0 : Number(carbsInput);
    if (name.trim() === "") {
      Alert.alert("Enter a name");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      Alert.alert("Enter valid calories");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      Alert.alert("Enter valid protein");
      return;
    }
    if (!Number.isFinite(f) || f < 0) {
      Alert.alert("Enter valid fat");
      return;
    }
    if (!Number.isFinite(cb) || cb < 0) {
      Alert.alert("Enter valid carbs");
      return;
    }
    onSave(entry.id, {
      name: name.trim(),
      calories: c,
      protein_g: p,
      fat_g: f,
      carbs_g: cb,
    });
  };

  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Edit entry</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.formLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, styles.sheetInput]}
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Calories</Text>
              <TextInput
                value={calInput}
                onChangeText={setCalInput}
                keyboardType="decimal-pad"
                style={[styles.input, styles.sheetInput]}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Protein (g)</Text>
              <TextInput
                value={proteinInput}
                onChangeText={setProteinInput}
                keyboardType="decimal-pad"
                style={[styles.input, styles.sheetInput]}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          <View style={[styles.formRow, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Fat (g)</Text>
              <TextInput
                value={fatInput}
                onChangeText={setFatInput}
                keyboardType="decimal-pad"
                style={[styles.input, styles.sheetInput]}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Carbs (g)</Text>
              <TextInput
                value={carbsInput}
                onChangeText={setCarbsInput}
                keyboardType="decimal-pad"
                style={[styles.input, styles.sheetInput]}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          <Pressable
            onPress={save}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Day history sheet ────────────────────────────────────────────────

function DayHistorySheet({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);

  React.useEffect(() => {
    if (!date) {
      setEntries([]);
      setGoal(null);
      return;
    }
    (async () => {
      const [e, g] = await Promise.all([
        getFoodEntriesForDate(date),
        getNutritionGoalForDate(date),
      ]);
      setEntries(e);
      setGoal(g);
    })();
  }, [date]);

  const totalCals = entries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = entries.reduce((s, e) => s + e.protein_g, 0);
  const totalFat = entries.reduce((s, e) => s + e.fat_g, 0);
  const totalCarbs = entries.reduce((s, e) => s + e.carbs_g, 0);

  return (
    <Modal
      visible={!!date}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: "75%" }]}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {date ? formatHeaderDate(date) : ""}
              </Text>
              {goal ? (
                <Text style={styles.sheetSubtitle}>
                  {Math.round(totalCals).toLocaleString()} /{" "}
                  {Math.round(goal.calorie_goal).toLocaleString()} cal
                  {" · "}P {Math.round(totalProtein)} /{" "}
                  {Math.round(goal.protein_goal)}g{" · "}F{" "}
                  {Math.round(totalFat)} / {Math.round(goal.fat_goal)}g{" · "}C{" "}
                  {Math.round(totalCarbs)} / {Math.round(goal.carbs_goal)}g
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          >
            {entries.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged this day.</Text>
            ) : (
              entries.map((e, i) => (
                <View
                  key={e.id}
                  style={[
                    styles.entryRow,
                    i < entries.length - 1 && styles.entryRowDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.entryMeta}>
                      P {Math.round(e.protein_g)}g · F {Math.round(e.fat_g)}g ·
                      C {Math.round(e.carbs_g)}g
                    </Text>
                  </View>
                  <Text style={styles.entryCal}>
                    {Math.round(e.calories).toLocaleString()}
                    <Text style={styles.entryCalUnit}> cal</Text>
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────

function NutritionTrendChart({
  data,
  onTapDay,
}: {
  data: DailyNutritionTotal[];
  onTapDay: (date: string) => void;
}) {
  const chartWidth = Dimensions.get("window").width - 16 * 2 - 16 * 2;
  const chartHeight = 110;
  const pad = 4;
  const innerW = chartWidth - pad * 2;
  const barSlot = innerW / Math.max(1, data.length);
  const barWidth = Math.max(4, barSlot * 0.55);

  const maxCal = Math.max(
    1,
    ...data.map((d) => Math.max(d.calories, d.calorie_goal)),
  );
  const maxProt = Math.max(
    1,
    ...data.map((d) => Math.max(d.protein_g, d.protein_goal)),
  );
  const maxFat = Math.max(1, ...data.map((d) => Math.max(d.fat_g, d.fat_goal)));
  const maxCarbs = Math.max(
    1,
    ...data.map((d) => Math.max(d.carbs_g, d.carbs_goal)),
  );

  const latestCalGoal = data[data.length - 1]?.calorie_goal ?? 0;
  const latestProtGoal = data[data.length - 1]?.protein_goal ?? 0;
  const latestFatGoal = data[data.length - 1]?.fat_goal ?? 0;
  const latestCarbsGoal = data[data.length - 1]?.carbs_goal ?? 0;

  const calChart = (
    <View>
      <View style={styles.chartHeader}>
        <View style={styles.chartLabelRow}>
          <Flame size={12} color={colors.red} strokeWidth={2} />
          <Text style={styles.chartLabel}>Calories</Text>
        </View>
        <Text style={styles.chartGoal}>
          goal {Math.round(latestCalGoal).toLocaleString()}
        </Text>
      </View>
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {latestCalGoal > 0 ? (
            <Line
              x1={pad}
              x2={chartWidth - pad}
              y1={pad + (1 - latestCalGoal / maxCal) * (chartHeight - pad * 2)}
              y2={pad + (1 - latestCalGoal / maxCal) * (chartHeight - pad * 2)}
              stroke={colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {data.map((d, i) => {
            const valH = (d.calories / maxCal) * (chartHeight - pad * 2);
            const x = pad + i * barSlot + (barSlot - barWidth) / 2;
            const y = chartHeight - pad - valH;
            const over = d.calories > d.calorie_goal;
            return (
              <Rect
                key={d.date}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(d.calories > 0 ? 2 : 0, valH)}
                rx={1.5}
                fill={over ? colors.warning : colors.red}
                opacity={d.calories === 0 ? 0.2 : 1}
              />
            );
          })}
        </Svg>
        <View
          style={[styles.tapRow, { width: chartWidth, height: chartHeight }]}
        >
          {data.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => onTapDay(d.date)}
              style={{ width: barSlot, height: "100%" }}
              hitSlop={4}
            />
          ))}
        </View>
      </View>
    </View>
  );

  const protChart = (
    <View style={{ marginTop: 14 }}>
      <View style={styles.chartHeader}>
        <View style={styles.chartLabelRow}>
          <Zap size={12} color={colors.teal} strokeWidth={2} />
          <Text style={styles.chartLabel}>Protein</Text>
        </View>
        <Text style={styles.chartGoal}>goal {Math.round(latestProtGoal)}g</Text>
      </View>
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {latestProtGoal > 0 ? (
            <Line
              x1={pad}
              x2={chartWidth - pad}
              y1={
                pad + (1 - latestProtGoal / maxProt) * (chartHeight - pad * 2)
              }
              y2={
                pad + (1 - latestProtGoal / maxProt) * (chartHeight - pad * 2)
              }
              stroke={colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {data.map((d, i) => {
            const valH = (d.protein_g / maxProt) * (chartHeight - pad * 2);
            const x = pad + i * barSlot + (barSlot - barWidth) / 2;
            const y = chartHeight - pad - valH;
            const met = d.protein_g >= d.protein_goal && d.protein_g > 0;
            return (
              <Rect
                key={d.date}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(d.protein_g > 0 ? 2 : 0, valH)}
                rx={1.5}
                fill={met ? colors.green : colors.teal}
                opacity={d.protein_g === 0 ? 0.2 : 1}
              />
            );
          })}
        </Svg>
        <View
          style={[styles.tapRow, { width: chartWidth, height: chartHeight }]}
        >
          {data.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => onTapDay(d.date)}
              style={{ width: barSlot, height: "100%" }}
              hitSlop={4}
            />
          ))}
        </View>
      </View>
    </View>
  );

  const fatChart = (
    <View style={{ marginTop: 14 }}>
      <View style={styles.chartHeader}>
        <View style={styles.chartLabelRow}>
          <Droplets size={12} color={colors.amber} strokeWidth={2} />
          <Text style={styles.chartLabel}>Fat</Text>
        </View>
        <Text style={styles.chartGoal}>goal {Math.round(latestFatGoal)}g</Text>
      </View>
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {latestFatGoal > 0 ? (
            <Line
              x1={pad}
              x2={chartWidth - pad}
              y1={pad + (1 - latestFatGoal / maxFat) * (chartHeight - pad * 2)}
              y2={pad + (1 - latestFatGoal / maxFat) * (chartHeight - pad * 2)}
              stroke={colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {data.map((d, i) => {
            const valH = (d.fat_g / maxFat) * (chartHeight - pad * 2);
            const x = pad + i * barSlot + (barSlot - barWidth) / 2;
            const y = chartHeight - pad - valH;
            const over = d.fat_g > d.fat_goal && d.fat_goal > 0;
            return (
              <Rect
                key={d.date}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(d.fat_g > 0 ? 2 : 0, valH)}
                rx={1.5}
                fill={over ? colors.warning : colors.amber}
                opacity={d.fat_g === 0 ? 0.2 : 1}
              />
            );
          })}
        </Svg>
        <View
          style={[styles.tapRow, { width: chartWidth, height: chartHeight }]}
        >
          {data.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => onTapDay(d.date)}
              style={{ width: barSlot, height: "100%" }}
              hitSlop={4}
            />
          ))}
        </View>
      </View>
    </View>
  );

  const carbsChart = (
    <View style={{ marginTop: 14 }}>
      <View style={styles.chartHeader}>
        <View style={styles.chartLabelRow}>
          <Layers size={12} color={colors.purple} strokeWidth={2} />
          <Text style={styles.chartLabel}>Carbs</Text>
        </View>
        <Text style={styles.chartGoal}>
          goal {Math.round(latestCarbsGoal)}g
        </Text>
      </View>
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {latestCarbsGoal > 0 ? (
            <Line
              x1={pad}
              x2={chartWidth - pad}
              y1={
                pad + (1 - latestCarbsGoal / maxCarbs) * (chartHeight - pad * 2)
              }
              y2={
                pad + (1 - latestCarbsGoal / maxCarbs) * (chartHeight - pad * 2)
              }
              stroke={colors.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {data.map((d, i) => {
            const valH = (d.carbs_g / maxCarbs) * (chartHeight - pad * 2);
            const x = pad + i * barSlot + (barSlot - barWidth) / 2;
            const y = chartHeight - pad - valH;
            const met = d.carbs_g >= d.carbs_goal && d.carbs_g > 0;
            return (
              <Rect
                key={d.date}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(d.carbs_g > 0 ? 2 : 0, valH)}
                rx={1.5}
                fill={met ? colors.green : colors.purple}
                opacity={d.carbs_g === 0 ? 0.2 : 1}
              />
            );
          })}
        </Svg>
        <View
          style={[styles.tapRow, { width: chartWidth, height: chartHeight }]}
        >
          {data.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => onTapDay(d.date)}
              style={{ width: barSlot, height: "100%" }}
              hitSlop={4}
            />
          ))}
        </View>
      </View>
      <View style={styles.xAxis}>
        {data.map((d, i) => (
          <Text key={d.date} style={[styles.xAxisLabel, { width: barSlot }]}>
            {i % 2 === 0 ? shortDate(d.date) : ""}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <View>
      {calChart}
      {protChart}
      {fatChart}
      {carbsChart}
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function formatHeaderDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

// ─── styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

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
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  goalLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalLabel: { ...typography.exerciseName, color: colors.text },
  goalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  goalGoal: {
    fontSize: 12,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  goalRemaining: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },

  formLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  sheetInput: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
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
  addBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

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
    color: colors.text,
  },
  recentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    gap: 12,
  },
  entryRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryName: { ...typography.exerciseName, color: colors.text },
  entryMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  entryCal: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  entryCalUnit: {
    fontSize: 11,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    padding: 20,
  },

  swipeActions: {
    width: 76,
    flexDirection: "row",
  },
  swipeAction: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  swipeLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chartLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  chartGoal: {
    fontSize: 11,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  tapRow: {
    position: "absolute",
    top: 0,
    left: 0,
    flexDirection: "row",
  },
  xAxis: {
    flexDirection: "row",
    marginTop: 4,
    paddingLeft: 4,
    paddingRight: 4,
  },
  xAxisLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },

  secondaryBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  calcBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  calcBtnText: { color: colors.primary, fontSize: 14, fontWeight: "600" },

  calcSectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  unitPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  unitPickerText: { fontSize: 15, color: colors.text, fontWeight: "500" },
  unitPickerChevron: {
    fontSize: 18,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  calcResult: {
    marginTop: 14,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  calcResultTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  calcResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calcResultItem: { alignItems: "center", flex: 1 },
  calcResultValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  calcResultLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
  modeBtnTextActive: { color: "#FFFFFF", fontWeight: "600" },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: 15, color: colors.text, flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: colors.textMuted, flex: 1 },

  calcWarning: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  calcWarningText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  calcNoteText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 17,
  },
});

// ─── Scanner overlay styles ───────────────────────────────────────────

const WINDOW_SIZE = 260;
const CORNER = 20;
const CORNER_THICKNESS = 3;

const scan = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  topShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  middleRow: { flexDirection: "row", height: WINDOW_SIZE },
  sideShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  window: {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    position: "relative",
  },
  bottomShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    paddingTop: 24,
    gap: 20,
  },
  hint: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
  cancelBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  cancelBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  // Corner bracket helpers
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#FFFFFF",
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  deniedText: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
    margin: 32,
  },
  closeBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  closeBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
