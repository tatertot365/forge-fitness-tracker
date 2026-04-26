import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import { Card } from '../src/components/Card';
import { SectionLabel } from '../src/components/SectionLabel';
import { getDayPlans, updateDayPlan } from '../src/db/queries';
import { colors } from '../src/theme/colors';
import { radius, typography } from '../src/theme/spacing';
import { DAY_LABEL, DAYS, type Day, type DayPlan } from '../src/types';
import { hapticSelect, hapticSuccess } from '../src/utils/haptics';

export default function PlanScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<Record<Day, DayPlan> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const p = await getDayPlans();
    setPlans(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setDay = (day: Day, patch: Partial<Pick<DayPlan, 'enabled' | 'focus'>>) => {
    setPlans((prev) => (prev ? { ...prev, [day]: { ...prev[day], ...patch } } : prev));
  };

  const onToggle = (day: Day, enabled: boolean) => {
    hapticSelect();
    setDay(day, { enabled: enabled ? 1 : 0 });
  };

  const onSave = async () => {
    if (!plans) return;
    setBusy(true);
    try {
      await Promise.all(
        DAYS.map((d) =>
          updateDayPlan(d, {
            enabled: plans[d].enabled,
            focus: plans[d].focus.trim() || DAY_LABEL[d],
          }),
        ),
      );
      hapticSuccess();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const enabledCount = plans ? DAYS.filter((d) => plans[d].enabled).length : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Edit plan</Text>
          <Text style={styles.subtitle}>
            {enabledCount} training day{enabledCount === 1 ? '' : 's'} per week
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <SectionLabel>Days</SectionLabel>
          <Card padded={false}>
            {DAYS.map((d, idx) => {
              const plan = plans?.[d];
              const enabled = !!plan?.enabled;
              const isLast = idx === DAYS.length - 1;
              return (
                <View
                  key={d}
                  style={[
                    styles.dayRow,
                    !isLast && styles.rowDivider,
                  ]}
                >
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{DAY_LABEL[d]}</Text>
                    <Switch
                      value={enabled}
                      onValueChange={(v) => onToggle(d, v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  <TextInput
                    value={plan?.focus ?? ''}
                    onChangeText={(t) => setDay(d, { focus: t })}
                    editable={enabled}
                    placeholder="e.g. Push day"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.focusInput,
                      !enabled && styles.focusInputDisabled,
                    ]}
                    autoCapitalize="sentences"
                  />
                </View>
              );
            })}
          </Card>

          <Text style={styles.hint}>
            Disabling a day hides it from the Today screen and weekly split. Exercises on that day are kept — re-enable any time.
          </Text>

          <Pressable
            onPress={onSave}
            disabled={busy || !plans}
            style={({ pressed }) => [
              styles.saveBtn,
              (busy || !plans) && { opacity: 0.6 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>Save plan</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  dayRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    ...typography.exerciseName,
    color: colors.text,
  },
  focusInput: {
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  focusInputDisabled: {
    color: colors.textMuted,
    backgroundColor: 'transparent',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 14,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
