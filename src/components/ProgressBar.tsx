import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

type Props = {
  value: number;
  max: number;
  color?: string;
};

export function ProgressBar({ value, max, color = colors.primary }: Props) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: radius.bar,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.bar,
  },
});
