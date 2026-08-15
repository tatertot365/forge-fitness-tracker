import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors } from "../../theme/colors";
import { type Measurement } from "../../types";
import { useStyles } from "../../theme/useStyles";
import { shortDate } from "./helpers";

// ─── Chart ────────────────────────────────────────────────────────────

export function MeasurementLineChart({
  data,
  valueKey,
  label,
  unit,
  color,
}: {
  data: Measurement[];
  valueKey: "weight_lb" | "body_fat_pct";
  label: string;
  unit: string;
  color: string;
}) {
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const points = data
    .map((m, i) => ({ i, value: m[valueKey] as number | null, date: m.date }))
    .filter((p) => p.value != null) as {
    i: number;
    value: number;
    date: string;
  }[];

  if (points.length < 2) {
    return (
      <View>
        <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={styles.chartEmpty}>Not enough data yet</Text>
      </View>
    );
  }

  const chartWidth = width - 16 * 2 - 16 * 2;
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
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${toX(p.i).toFixed(1)} ${toY(p.value).toFixed(1)}`,
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.value - first.value;
  const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${unit}`;
  const deltaColor =
    delta === 0
      ? colors.textMuted
      : valueKey === "weight_lb"
        ? colors.textSecondary
        : delta < 0
          ? colors.green
          : colors.red;

  return (
    <View>
      <View style={styles.chartHeader}>
        <Text style={styles.chartLabel}>{label}</Text>
        <View style={styles.chartMeta}>
          <Text style={[styles.chartDelta, { color: deltaColor }]}>
            {deltaStr}
          </Text>
          <Text style={styles.chartRange}>
            {last.value.toFixed(1)}
            {unit}
          </Text>
        </View>
      </View>
      <Svg width={chartWidth} height={chartHeight}>
        <Line
          x1={padX}
          x2={chartWidth - padX}
          y1={chartHeight - padY}
          y2={chartHeight - padY}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Path
          d={pathD}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
      <View
        style={[styles.xAxis, { width: chartWidth, paddingHorizontal: padX }]}
      >
        <Text style={styles.xLabel}>{shortDate(first.date)}</Text>
        <Text style={styles.xLabel}>{shortDate(last.date)}</Text>
      </View>
    </View>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
    chartLabel: { fontSize: s(13), fontWeight: "600", color: colors.text },
    chartMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
    chartDelta: { fontSize: s(12), fontWeight: "600" },
    chartRange: {
    fontSize: s(12),
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
    chartEmpty: { fontSize: s(13), color: colors.textMuted, paddingVertical: 8 },
    xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
    xLabel: { fontSize: s(10), color: colors.textMuted },
  });
