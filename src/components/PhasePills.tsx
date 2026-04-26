import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import type { Phase } from '../types';
import { colors, phaseColor } from '../theme/colors';
import { radius } from '../theme/spacing';

type Props = {
  value: Phase;
  onChange: (p: Phase) => void;
};

const ORDER: Phase[] = ['cut', 'maintain', 'bulk'];
const LABEL: Record<Phase, string> = {
  cut: 'Cut',
  maintain: 'Maintain',
  bulk: 'Bulk',
};

export function PhasePills({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {ORDER.map((p) => {
        const active = p === value;
        const tint = phaseColor[p];
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            style={({ pressed }) => [
              styles.pill,
              active && { backgroundColor: tint, borderColor: tint },
              pressed && { opacity: 0.7 },
            ]}
          >
            <PhaseIcon phase={p} color={active ? '#FFFFFF' : tint} />
            <Text style={[styles.label, { color: active ? '#FFFFFF' : colors.text }]}>
              {LABEL[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PhaseIcon({ phase, color }: { phase: Phase; color: string }) {
  const size = 14;
  if (phase === 'cut') return <TrendingDown size={size} color={color} strokeWidth={2} />;
  if (phase === 'maintain') return <Minus size={size} color={color} strokeWidth={2} />;
  return <TrendingUp size={size} color={color} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
