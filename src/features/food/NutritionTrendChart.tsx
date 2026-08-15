import { Droplets, Flame, Layers, Zap } from "lucide-react-native";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { shortDate } from "./helpers";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import {
  type DailyNutritionTotal,
} from "../../types";

export function NutritionTrendChart({
  data,
  onTapDay,
}: {
  data: DailyNutritionTotal[];
  onTapDay: (date: string) => void;
}) {
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const chartWidth = width - 16 * 2 - 16 * 2;
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

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    chartGoal: {
    fontSize: s(11),
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
    chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
    chartLabel: {
    fontSize: s(12),
    fontWeight: "600",
    color: colors.text,
  },
    chartLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
    fontSize: s(9),
    color: colors.textMuted,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  });
