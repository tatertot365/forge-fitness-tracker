import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { radius, typography } from './spacing';

/**
 * Style primitives shared by the app's bottom sheets and their forms.
 *
 * These were duplicated across the sheets that used to live inside
 * `app/(tabs)/food.tsx`. Spread them into a component's own StyleSheet so
 * each component keeps a single `styles` object:
 *
 *     const makeStyles = (s: (n: number) => number) =>
 *       StyleSheet.create({ ...makeSheetStyles(s), myOwnKey: { ... } });
 *
 * Keys defined locally after the spread win, so a component can override any
 * primitive it needs to diverge from.
 */
export const makeSheetStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  // ─── Sheet chrome ───────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: 14,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
  sheetSubtitle: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"] as const,
  },

  // ─── Form fields ────────────────────────────────────────────────────
  formLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    fontWeight: "600" as const,
    marginBottom: 6,
  },
  input: {
    fontSize: s(15),
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  // Variant of `input` for use inside a sheet, where the sheet background
  // matches `colors.background` and the field needs to stand off it.
  sheetInput: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  formRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginTop: 10,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: "center" as const,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" as const },

  // ─── Calculated-macro result block ──────────────────────────────────
  calcResult: {
    marginTop: 14,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  calcResultTitle: {
    fontSize: s(11),
    fontWeight: "600" as const,
    color: colors.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  calcResultRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
  calcResultItem: { alignItems: "center" as const, flex: 1 },
  calcResultValue: {
    fontSize: s(16),
    fontWeight: "600" as const,
    color: colors.text,
    fontVariant: ["tabular-nums"] as const,
  },
  calcResultLabel: {
    fontSize: s(10),
    color: colors.textSecondary,
    marginTop: 2,
  },
  });

/**
 * Food-log entry row, shared by the swipeable row on the Food screen and the
 * read-only list inside the day-history sheet.
 */
export const makeEntryRowStyles = (s: (n: number) => number) =>
  StyleSheet.create({
  entryRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    gap: 12,
  },
  entryRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryName: { ...typography.exerciseName, fontSize: s(14), color: colors.text },
  entryMeta: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
  },
  entryCal: {
    fontSize: s(15),
    fontWeight: "600" as const,
    color: colors.text,
    fontVariant: ["tabular-nums"] as const,
  },
  entryCalUnit: {
    fontSize: s(11),
    fontWeight: "400" as const,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textMuted,
    textAlign: "center" as const,
    padding: 20,
  },
  });
