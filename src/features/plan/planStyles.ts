import { StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";

// Shared by DaySection and the drag-and-drop row/group components.
export const makeDs = (s: (n: number) => number) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  dayName: { fontSize: s(16), fontWeight: "600", color: colors.text },
  dayNameDisabled: { color: colors.textSecondary },
  focusInput: {
    fontSize: s(14),
    color: colors.text,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  focusInputDisabled: {
    color: colors.textMuted,
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  exercisesBlock: {
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  muscleLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 4,
    gap: 6,
  },
  groupGripArea: {
    padding: 2,
  },
  muscleLabel: {
    fontSize: s(10),
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  groupDeleteBtn: {
    padding: 2,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 14,
    gap: 10,
  },
  exerciseDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accentBar: { width: 3, height: 32, borderRadius: 2, flexShrink: 0 },
  exerciseName: { fontSize: s(14), fontWeight: "500", color: colors.text },
  exerciseMeta: { fontSize: s(12), color: colors.textSecondary, marginTop: 1 },
  dayActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addBtnText: { fontSize: s(13), color: colors.primary, fontWeight: "500" },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  copyBtnText: { fontSize: s(13), color: colors.textSecondary, fontWeight: "500" },
});
