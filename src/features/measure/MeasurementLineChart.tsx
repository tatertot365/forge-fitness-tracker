import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors } from "../../theme/colors";
import { type Measurement } from "../../types";
import { type MeasurementKey } from "./types";
import { useStyles } from "../../theme/useStyles";
import { daysBetween } from "../../utils/date";
import { shortDate } from "./helpers";

// ─── Chart ────────────────────────────────────────────────────────────

export function MeasurementLineChart({
  data,
  valueKey,
  label,
  unit,
  color,
  goodOnIncrease = null,
}: {
  data: Measurement[];
  valueKey: MeasurementKey;
  label: string;
  unit: string;
  color: string;
  // Which direction counts as progress. Null keeps the delta neutral -- weight
  // has no universally "good" direction without knowing the user's goal.
  goodOnIncrease?: boolean | null;
}) {
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const points = data
    .map((m) => ({ value: m[valueKey] as number | null, date: m.date }))
    .filter((p) => p.value != null) as {
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

  // Space points by elapsed days, not by array position. Indexing made three
  // daily weigh-ins and a five-month gap render as four evenly spaced points,
  // so the slope of the line said nothing about the rate of change.
  const firstDate = points[0].date;
  const spanDays = daysBetween(firstDate, points[points.length - 1].date) || 1;

  const toX = (date: string) =>
    padX + (daysBetween(firstDate, date) / spanDays) * innerW;
  const toY = (v: number) => padY + (1 - (v - minVal) / range) * innerH;

  const pathD = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${toX(p.date).toFixed(1)} ${toY(p.value).toFixed(1)}`,
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.value - first.value;
  const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${unit}`;
  const deltaColor =
    delta === 0
      ? colors.textMuted
      : goodOnIncrease == null
        ? colors.textSecondary
        : (delta > 0) === goodOnIncrease
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
            cx={toX(p.date)}
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
