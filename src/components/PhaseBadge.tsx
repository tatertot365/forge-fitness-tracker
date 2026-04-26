import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Phase } from '../types';
import { phaseColor } from '../theme/colors';

const LABEL: Record<Phase, string> = { cut: 'Cut', maintain: 'Maintain', bulk: 'Bulk' };

export function PhaseBadge({ phase }: { phase: Phase }) {
  const c = phaseColor[phase];
  return (
    <View style={[styles.pill, { backgroundColor: c + '22', borderColor: c }]}>
      <Text style={[styles.text, { color: c }]}>{LABEL[phase]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
