import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

type Point = { date: string; score: number };

type Props = {
  data: Point[];
  width?: number;
  height?: number;
};

export function HistorySparkline({ data, width = 120, height = 36 }: Props) {
  if (data.length < 2) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>
          {data.length === 0 ? 'No history' : '1 session'}
        </Text>
      </View>
    );
  }

  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const pointsXY = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * innerW;
    const y = pad + innerH - ((d.score - min) / range) * innerH;
    return { x, y };
  });

  const path = pointsXY
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const last = pointsXY[pointsXY.length - 1];
  const first = data[0].score;
  const latest = data[data.length - 1].score;
  const up = latest >= first;
  const color = up ? colors.green : colors.red;

  return (
    <Svg width={width} height={height}>
      <Path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
