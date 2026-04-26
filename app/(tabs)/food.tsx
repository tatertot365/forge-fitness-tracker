import { useFocusEffect } from 'expo-router';
import { Flame, Pencil, Plus, Trash2, X, Zap } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
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
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Svg, { Line, Rect } from 'react-native-svg';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import {
  addFoodEntry,
  deleteFoodEntry,
  getDailyNutritionTotals,
  getFoodEntriesForDate,
  getFoodRecents,
  getNutritionGoalForDate,
  setNutritionGoal,
  updateFoodEntry,
} from '../../src/db/queries';
import { colors } from '../../src/theme/colors';
import { radius, typography } from '../../src/theme/spacing';
import {
  type DailyNutritionTotal,
  type FoodEntry,
  type FoodRecent,
  type NutritionGoal,
} from '../../src/types';
import { todayISO } from '../../src/utils/date';
import { hapticSelect, hapticSuccess, hapticTap } from '../../src/utils/haptics';

export default function FoodScreen() {
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [recents, setRecents] = useState<FoodRecent[]>([]);
  const [totals, setTotals] = useState<DailyNutritionTotal[]>([]);

  const [name, setName] = useState('');
  const [calInput, setCalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');

  const [goalSheet, setGoalSheet] = useState(false);
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null);
  const [historyDate, setHistoryDate] = useState<string | null>(null);

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

  const clearForm = () => {
    setName('');
    setCalInput('');
    setProteinInput('');
  };

  const onAdd = async () => {
    const cal = Number(calInput);
    const prot = Number(proteinInput);
    if (name.trim() === '') {
      Alert.alert('Enter a food name');
      return;
    }
    if (!Number.isFinite(cal) || cal < 0) {
      Alert.alert('Enter valid calories');
      return;
    }
    if (!Number.isFinite(prot) || prot < 0) {
      Alert.alert('Enter valid protein');
      return;
    }
    await addFoodEntry({ date: today, name: name.trim(), calories: cal, protein_g: prot });
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
    });
    load();
  };

  const onDelete = (id: number) => {
    Alert.alert('Delete entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFoodEntry(id);
          hapticTap();
          load();
        },
      },
    ]);
  };

  const onSaveEdit = async (id: number, patch: { name: string; calories: number; protein_g: number }) => {
    await updateFoodEntry(id, patch);
    hapticSuccess();
    setEditEntry(null);
    load();
  };

  const onSaveGoal = async (cal: number, prot: number) => {
    await setNutritionGoal(today, { calorie_goal: cal, protein_goal: prot });
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
          style={({ pressed }) => [styles.editGoalBtn, pressed && { opacity: 0.6 }]}
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
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
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
                style={({ pressed }) => [styles.recentChip, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.recentName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.recentMeta}>
                  {Math.round(r.calories)} cal · {Math.round(r.protein_g)}g
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionLabel>Today&apos;s log</SectionLabel>
      <Card padded={false}>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet — add a food above.</Text>
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
    </Screen>
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
            {' / '}
            {Math.round(goal).toLocaleString()} {unit}
          </Text>
        </Text>
      </View>
      <ProgressBar value={value} max={goal} color={over ? colors.warning : color} />
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
          pressed && { backgroundColor: 'rgba(0,0,0,0.02)' },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.entryName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.entryMeta}>{Math.round(entry.protein_g)}g protein</Text>
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

function GoalSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: NutritionGoal | null;
  onClose: () => void;
  onSave: (cal: number, prot: number) => void;
}) {
  const [calInput, setCalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');

  React.useEffect(() => {
    if (visible && current) {
      setCalInput(String(Math.round(current.calorie_goal)));
      setProteinInput(String(Math.round(current.protein_goal)));
    }
  }, [visible, current]);

  const save = () => {
    const c = Number(calInput);
    const p = Number(proteinInput);
    if (!Number.isFinite(c) || c <= 0) {
      Alert.alert('Enter a valid calorie goal');
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      Alert.alert('Enter a valid protein goal');
      return;
    }
    onSave(c, p);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <Text style={styles.formLabel}>Calorie goal</Text>
          <TextInput
            value={calInput}
            onChangeText={setCalInput}
            keyboardType="number-pad"
            style={styles.input}
            placeholder="2500"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.formLabel, { marginTop: 10 }]}>Protein goal (g)</Text>
          <TextInput
            value={proteinInput}
            onChangeText={setProteinInput}
            keyboardType="number-pad"
            style={styles.input}
            placeholder="180"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            onPress={save}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
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
  onSave: (id: number, patch: { name: string; calories: number; protein_g: number }) => void;
}) {
  const [name, setName] = useState('');
  const [calInput, setCalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');

  React.useEffect(() => {
    if (entry) {
      setName(entry.name);
      setCalInput(String(entry.calories));
      setProteinInput(String(entry.protein_g));
    }
  }, [entry]);

  const save = () => {
    if (!entry) return;
    const c = Number(calInput);
    const p = Number(proteinInput);
    if (name.trim() === '') {
      Alert.alert('Enter a name');
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      Alert.alert('Enter valid calories');
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      Alert.alert('Enter valid protein');
      return;
    }
    onSave(entry.id, { name: name.trim(), calories: c, protein_g: p });
  };

  return (
    <Modal
      visible={!!entry}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            style={styles.input}
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
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          <Pressable
            onPress={save}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
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

  return (
    <Modal
      visible={!!date}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: '75%' }]}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{date ? formatHeaderDate(date) : ''}</Text>
              {goal ? (
                <Text style={styles.sheetSubtitle}>
                  {Math.round(totalCals).toLocaleString()} / {Math.round(goal.calorie_goal).toLocaleString()} cal
                  {' · '}
                  {Math.round(totalProtein)} / {Math.round(goal.protein_goal)}g protein
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {entries.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged this day.</Text>
            ) : (
              entries.map((e, i) => (
                <View
                  key={e.id}
                  style={[styles.entryRow, i < entries.length - 1 && styles.entryRowDivider]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.entryMeta}>{Math.round(e.protein_g)}g protein</Text>
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
  const chartWidth = Dimensions.get('window').width - 16 * 2 - 16 * 2;
  const chartHeight = 110;
  const pad = 4;
  const innerW = chartWidth - pad * 2;
  const barSlot = innerW / Math.max(1, data.length);
  const barWidth = Math.max(4, barSlot * 0.55);

  const maxCal = Math.max(1, ...data.map((d) => Math.max(d.calories, d.calorie_goal)));
  const maxProt = Math.max(1, ...data.map((d) => Math.max(d.protein_g, d.protein_goal)));

  const latestCalGoal = data[data.length - 1]?.calorie_goal ?? 0;
  const latestProtGoal = data[data.length - 1]?.protein_goal ?? 0;

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
        <View style={[styles.tapRow, { width: chartWidth, height: chartHeight }]}>
          {data.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => onTapDay(d.date)}
              style={{ width: barSlot, height: '100%' }}
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
              y1={pad + (1 - latestProtGoal / maxProt) * (chartHeight - pad * 2)}
              y2={pad + (1 - latestProtGoal / maxProt) * (chartHeight - pad * 2)}
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
        <View style={[styles.tapRow, { width: chartWidth, height: chartHeight }]}>
          {data.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => onTapDay(d.date)}
              style={{ width: barSlot, height: '100%' }}
              hitSlop={4}
            />
          ))}
        </View>
      </View>
      <View style={styles.xAxis}>
        {data.map((d, i) => (
          <Text
            key={d.date}
            style={[styles.xAxisLabel, { width: barSlot }]}
          >
            {i % 2 === 0 ? shortDate(d.date) : ''}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <View>
      {calChart}
      {protChart}
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function formatHeaderDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

// ─── styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  editGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    color: colors.primary,
  },

  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  goalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalLabel: { ...typography.exerciseName, color: colors.text },
  goalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  goalGoal: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  goalRemaining: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  formLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
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
  formRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

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
    flexDirection: 'row',
    alignItems: 'center',
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
  entryMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  entryCal: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  entryCalUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    padding: 20,
  },

  swipeActions: {
    width: 76,
    flexDirection: 'row',
  },
  swipeAction: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  swipeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chartLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  chartGoal: {
    fontSize: 11,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tapRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
  },
  xAxis: {
    flexDirection: 'row',
    marginTop: 4,
    paddingLeft: 4,
    paddingRight: 4,
  },
  xAxisLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
