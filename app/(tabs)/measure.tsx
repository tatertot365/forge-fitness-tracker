import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import {
  getActivityLevel,
  getGoalsMode,
  getMeasurementHistory,
  getPhase,
  getUserProfile,
  latestMeasurement,
  measurementOneWeekAgo,
  setNutritionGoal,
  setUserProfile,
  upsertMeasurement,
} from '../../src/db/queries';
import { calculateTdee, type Sex, type UserProfile } from '../../src/utils/tdee';
import { colors } from '../../src/theme/colors';
import { radius, typography } from '../../src/theme/spacing';
import { type Measurement } from '../../src/types';
import { todayISO } from '../../src/utils/date';

const TARGET_RATIO = 1.618;

type CircField = {
  key: keyof Pick<Measurement, 'shoulders_in' | 'waist_in' | 'arms_flexed_in' | 'chest_in' | 'quads_in'>;
  label: string;
  goodOnIncrease: boolean;
};

const CIRC_FIELDS: CircField[] = [
  { key: 'shoulders_in', label: 'Shoulders', goodOnIncrease: true },
  { key: 'waist_in', label: 'Waist', goodOnIncrease: false },
  { key: 'arms_flexed_in', label: 'Arms (flexed)', goodOnIncrease: true },
  { key: 'chest_in', label: 'Chest', goodOnIncrease: true },
  { key: 'quads_in', label: 'Quads', goodOnIncrease: true },
];

type Inputs = {
  weight_lb: string;
  body_fat_pct: string;
  shoulders_in: string;
  waist_in: string;
  arms_flexed_in: string;
  chest_in: string;
  quads_in: string;
};

const EMPTY_INPUTS: Inputs = {
  weight_lb: '',
  body_fat_pct: '',
  shoulders_in: '',
  waist_in: '',
  arms_flexed_in: '',
  chest_in: '',
  quads_in: '',
};

function measurementToInputs(m: Measurement): Inputs {
  return {
    weight_lb: m.weight_lb != null ? String(m.weight_lb) : '',
    body_fat_pct: m.body_fat_pct != null ? String(m.body_fat_pct) : '',
    shoulders_in: m.shoulders_in != null ? String(m.shoulders_in) : '',
    waist_in: m.waist_in != null ? String(m.waist_in) : '',
    arms_flexed_in: m.arms_flexed_in != null ? String(m.arms_flexed_in) : '',
    chest_in: m.chest_in != null ? String(m.chest_in) : '',
    quads_in: m.quads_in != null ? String(m.quads_in) : '',
  };
}

export default function MeasureScreen() {
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [prior, setPrior] = useState<Measurement | null>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [inputs, setInputs] = useState<Inputs>(EMPTY_INPUTS);
  const [profile, setProfile] = useState<UserProfile>({ height_in: null, dob: null, sex: null });
  const [heightInput, setHeightInput] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const load = useCallback(async () => {
    const [l, p, h, prof] = await Promise.all([
      latestMeasurement(),
      measurementOneWeekAgo(),
      getMeasurementHistory(),
      getUserProfile(),
    ]);
    setLatest(l);
    setPrior(p);
    setHistory(h);
    setProfile(prof);
    setHeightInput(prof.height_in != null ? String(prof.height_in) : '');
    setDobDate(prof.dob ? new Date(prof.dob) : null);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveProfile = async (patch: Partial<UserProfile>) => {
    await setUserProfile(patch);
    setProfile((p) => ({ ...p, ...patch }));
  };

  const pickSex = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Male', 'Female', 'Cancel'], cancelButtonIndex: 2 },
      async (idx) => {
        if (idx === 0) await saveProfile({ sex: 'male' });
        else if (idx === 1) await saveProfile({ sex: 'female' });
      },
    );
  };

  const save = async () => {
    const parsed = {
      weight_lb: parseField(inputs.weight_lb),
      body_fat_pct: parseField(inputs.body_fat_pct),
      shoulders_in: parseField(inputs.shoulders_in),
      waist_in: parseField(inputs.waist_in),
      arms_flexed_in: parseField(inputs.arms_flexed_in),
      chest_in: parseField(inputs.chest_in),
      quads_in: parseField(inputs.quads_in),
    };
    for (const [k, v] of Object.entries(parsed) as [keyof typeof parsed, number | null][]) {
      if (inputs[k].trim() !== '' && v == null) {
        Alert.alert(`Invalid value for ${k}`);
        return;
      }
    }
    const today = todayISO();
    await upsertMeasurement(today, parsed);

    const [goalsMode, activity, phase, freshProfile] = await Promise.all([
      getGoalsMode(),
      getActivityLevel(),
      getPhase(),
      getUserProfile(),
    ]);
    if (goalsMode === 'calculated' && activity) {
      const weight = parsed.weight_lb ?? (await latestMeasurement())?.weight_lb;
      const bodyFat = parsed.body_fat_pct ?? (await latestMeasurement())?.body_fat_pct ?? null;
      if (weight) {
        const result = calculateTdee({ weight_lb: weight, body_fat_pct: bodyFat, profile: freshProfile, activity, phase });
        if (result.ok) {
          await setNutritionGoal(today, {
            calorie_goal: result.goals.calories,
            protein_goal: result.goals.protein_g,
            fat_goal: result.goals.fat_g,
            carbs_goal: result.goals.carbs_g,
          });
        }
      }
    }

    Keyboard.dismiss();
    setInputs(EMPTY_INPUTS);
    load();
  };

  const ratio =
    latest?.shoulders_in != null && latest?.waist_in != null && latest.waist_in > 0
      ? latest.shoulders_in / latest.waist_in
      : null;
  const pctOff = ratio != null ? Math.abs((TARGET_RATIO - ratio) / TARGET_RATIO) * 100 : null;

  const hasBfHistory = history.some((m) => m.body_fat_pct != null);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={styles.header}>
          <Text style={styles.title}>Measurements</Text>
          <Text style={styles.subtitle}>Shoulder-to-waist ratio · target {TARGET_RATIO}</Text>
        </View>

        {/* Weight + body fat summary */}
        <View style={styles.bodyCompRow}>
          <View style={[styles.bodyCompCard, { flex: 1 }]}>
            <Text style={styles.bodyCompLabel}>Weight</Text>
            <Text style={styles.bodyCompValue}>
              {latest?.weight_lb != null ? `${latest.weight_lb} lbs` : '—'}
            </Text>
            <DeltaChip
              current={latest?.weight_lb ?? null}
              prior={prior?.weight_lb ?? null}
              goodOnIncrease={false}
              neutral
              unit=" lbs"
            />
          </View>
          <View style={[styles.bodyCompCard, { flex: 1 }]}>
            <Text style={styles.bodyCompLabel}>Body fat</Text>
            <Text style={styles.bodyCompValue}>
              {latest?.body_fat_pct != null ? `${latest.body_fat_pct}%` : '—'}
            </Text>
            <DeltaChip
              current={latest?.body_fat_pct ?? null}
              prior={prior?.body_fat_pct ?? null}
              goodOnIncrease={false}
              unit="%"
            />
          </View>
        </View>

        {/* Shoulder-to-waist ratio */}
        <View style={styles.ratioCard}>
          <Text style={styles.ratioLabel}>Shoulder-to-waist ratio</Text>
          <View style={styles.ratioValueRow}>
            <Text style={styles.ratioValue}>{ratio != null ? ratio.toFixed(2) : '—'}</Text>
            <Text style={styles.ratioTarget}>/ {TARGET_RATIO}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={ratio ?? 0} max={TARGET_RATIO} color={colors.primary} />
          </View>
          <View style={styles.ratioFooter}>
            <Text style={styles.ratioPct}>
              {pctOff != null
                ? `${pctOff.toFixed(1)}% off`
                : 'Log shoulders + waist to see progress'}
            </Text>
          </View>
          <Text style={styles.ratioHint}>
            Expand shoulders or tighten waist to close the gap.
          </Text>
        </View>

        {/* Circumference measurements */}
        <SectionLabel>Current</SectionLabel>
        <View style={styles.listCard}>
          {CIRC_FIELDS.map((f, i) => {
            const current = latest?.[f.key] ?? null;
            const previous = prior?.[f.key] ?? null;
            return (
              <View
                key={f.key}
                style={[styles.listRow, i !== CIRC_FIELDS.length - 1 && styles.listDivider]}
              >
                <Text style={styles.listLabel}>{f.label}</Text>
                <View style={styles.listTrailing}>
                  <Text style={styles.listValue}>
                    {current != null ? `${current.toFixed(1)}″` : '—'}
                  </Text>
                  <DeltaChip
                    current={current}
                    prior={previous}
                    goodOnIncrease={f.goodOnIncrease}
                    unit="″"
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Profile */}
        <SectionLabel>Profile</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Height (inches)</Text>
            <TextInput
              value={heightInput}
              onChangeText={setHeightInput}
              onBlur={async () => {
                const v = parseField(heightInput);
                if (v != null) await saveProfile({ height_in: v });
              }}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="e.g. 70 (5′10″)"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Date of birth</Text>
            <Pressable
              onPress={() => setShowDobPicker((v) => !v)}
              style={({ pressed }) => [styles.input, styles.pickerRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={dobDate ? styles.pickerText : styles.pickerPlaceholder}>
                {dobDate ? formatDob(dobDate) : 'Select date…'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </Pressable>
            {showDobPicker && (
              <DateTimePicker
                value={dobDate ?? new Date(2000, 0, 1)}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={async (_, date) => {
                  if (date) {
                    setDobDate(date);
                    const iso = toISODate(date);
                    await saveProfile({ dob: iso });
                  }
                }}
                style={{ marginTop: 4 }}
              />
            )}
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Sex</Text>
            <Pressable
              onPress={pickSex}
              style={({ pressed }) => [styles.input, styles.pickerRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={profile.sex ? styles.pickerText : styles.pickerPlaceholder}>
                {profile.sex === 'male' ? 'Male' : profile.sex === 'female' ? 'Female' : 'Select…'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* Body fat prompt banner */}
        {latest?.body_fat_pct == null && (
          <View style={styles.bfBanner}>
            <Text style={styles.bfBannerText}>
              Log your body fat % below for more accurate macro calculations. Without it, height, age & sex are used instead.
            </Text>
          </View>
        )}

        {/* Update form */}
        <SectionLabel>Update</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Weight (lbs)</Text>
            <TextInput
              value={inputs.weight_lb}
              onChangeText={(t) => setInputs((p) => ({ ...p, weight_lb: t }))}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="optional"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Body fat (%)</Text>
            <TextInput
              value={inputs.body_fat_pct}
              onChangeText={(t) => setInputs((p) => ({ ...p, body_fat_pct: t }))}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="optional"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          {CIRC_FIELDS.map((f) => (
            <View key={f.key} style={styles.formRow}>
              <Text style={styles.formLabel}>{f.label} (inches)</Text>
              <TextInput
                value={inputs[f.key]}
                onChangeText={(t) => setInputs((p) => ({ ...p, [f.key]: t }))}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="optional"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ))}
          <Pressable
            onPress={save}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.saveBtnText}>Save measurements</Text>
          </Pressable>
        </View>

        {/* Trend chart */}
        {history.length >= 2 ? (
          <>
            <SectionLabel>Trends</SectionLabel>
            <View style={styles.chartCard}>
              <MeasurementLineChart
                data={history}
                valueKey="weight_lb"
                label="Weight"
                unit=" lbs"
                color={colors.primary}
              />
              {hasBfHistory ? (
                <View style={{ marginTop: 20 }}>
                  <MeasurementLineChart
                    data={history}
                    valueKey="body_fat_pct"
                    label="Body fat"
                    unit="%"
                    color={colors.warning}
                  />
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function MeasurementLineChart({
  data,
  valueKey,
  label,
  unit,
  color,
}: {
  data: Measurement[];
  valueKey: 'weight_lb' | 'body_fat_pct';
  label: string;
  unit: string;
  color: string;
}) {
  const points = data
    .map((m, i) => ({ i, value: m[valueKey] as number | null, date: m.date }))
    .filter((p) => p.value != null) as { i: number; value: number; date: string }[];

  if (points.length < 2) {
    return (
      <View>
        <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={styles.chartEmpty}>Not enough data yet</Text>
      </View>
    );
  }

  const chartWidth = Dimensions.get('window').width - 16 * 2 - 16 * 2;
  const chartHeight = 100;
  const padX = 8;
  const padY = 12;
  const innerW = chartWidth - padX * 2;
  const innerH = chartHeight - padY * 2;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const totalSlots = data.length - 1 || 1;

  const toX = (idx: number) => padX + (idx / totalSlots) * innerW;
  const toY = (v: number) => padY + (1 - (v - minVal) / range) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.value - first.value;
  const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}${unit}`;
  const deltaColor = delta === 0 ? colors.textMuted : valueKey === 'weight_lb'
    ? colors.textSecondary
    : delta < 0 ? colors.green : colors.red;

  return (
    <View>
      <View style={styles.chartHeader}>
        <Text style={styles.chartLabel}>{label}</Text>
        <View style={styles.chartMeta}>
          <Text style={[styles.chartDelta, { color: deltaColor }]}>{deltaStr}</Text>
          <Text style={styles.chartRange}>
            {last.value.toFixed(1)}{unit}
          </Text>
        </View>
      </View>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Baseline grid line */}
        <Line
          x1={padX} x2={chartWidth - padX}
          y1={chartHeight - padY} y2={chartHeight - padY}
          stroke={colors.border}
          strokeWidth={1}
        />
        {/* Trend line */}
        <Path d={pathD} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {points.map((p) => (
          <Circle
            key={p.date}
            cx={toX(p.i)}
            cy={toY(p.value)}
            r={3}
            fill={color}
          />
        ))}
      </Svg>
      {/* X-axis date labels: first and last */}
      <View style={[styles.xAxis, { width: chartWidth, paddingHorizontal: padX }]}>
        <Text style={styles.xLabel}>{shortDate(first.date)}</Text>
        <Text style={styles.xLabel}>{shortDate(last.date)}</Text>
      </View>
    </View>
  );
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function DeltaChip({
  current,
  prior,
  goodOnIncrease,
  neutral,
  unit,
}: {
  current: number | null;
  prior: number | null;
  goodOnIncrease: boolean;
  neutral?: boolean;
  unit: string;
}) {
  if (current == null || prior == null) return <View style={{ height: 18 }} />;
  const d = current - prior;
  if (Math.abs(d) < 0.05) {
    return (
      <View style={styles.deltaChip}>
        <Minus size={11} color={colors.textMuted} strokeWidth={2.5} />
        <Text style={[styles.deltaText, { color: colors.textMuted }]}>0</Text>
      </View>
    );
  }
  const up = d > 0;
  const tint = neutral
    ? colors.textSecondary
    : (goodOnIncrease ? up : !up)
    ? colors.green
    : colors.red;
  return (
    <View style={styles.deltaChip}>
      {up ? (
        <ArrowUp size={11} color={tint} strokeWidth={2.5} />
      ) : (
        <ArrowDown size={11} color={tint} strokeWidth={2.5} />
      )}
      <Text style={[styles.deltaText, { color: tint }]}>
        {Math.abs(d).toFixed(1)}{unit}
      </Text>
    </View>
  );
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDob(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function parseField(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const styles = StyleSheet.create({
  header: { paddingTop: 8, paddingBottom: 8 },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  bodyCompRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  bodyCompCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  bodyCompLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  bodyCompValue: { fontSize: 22, fontWeight: '600', color: colors.text, marginTop: 2 },

  ratioCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    marginTop: 6,
  },
  ratioLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  ratioValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  ratioValue: { fontSize: 34, fontWeight: '600', color: colors.text },
  ratioTarget: { fontSize: 14, color: colors.textSecondary },
  ratioFooter: { marginTop: 8 },
  ratioPct: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  ratioHint: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },

  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  listDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  listLabel: { fontSize: 14, fontWeight: '500', color: colors.text },
  listTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listValue: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  deltaText: { fontSize: 11, fontWeight: '600' },

  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  formRow: { marginBottom: 10 },
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
  saveBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { fontSize: 15, color: colors.text },
  pickerPlaceholder: { fontSize: 15, color: colors.textMuted },
  pickerChevron: { fontSize: 18, color: colors.textSecondary, lineHeight: 20 },

  bfBanner: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  bfBannerText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  chartMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chartDelta: { fontSize: 12, fontWeight: '600' },
  chartRange: { fontSize: 12, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  chartEmpty: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xLabel: { fontSize: 10, color: colors.textMuted },
});
