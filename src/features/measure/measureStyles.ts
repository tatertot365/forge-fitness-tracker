import { StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";

// Styles for the Measurements screen. These sheet styles intentionally
// differ from the shared primitives in theme/sheets.ts (sheetInput border,
// saveBtn margin, sheet maxHeight, sheetHeader alignment) -- do not unify
// them without checking the visual diff.
export const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  inputError: {
    borderColor: colors.red,
    borderWidth: 1,
  },
  errorText: {
    color: colors.red,
    fontSize: s(12),
    marginTop: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { ...typography.screenTitle, fontSize: s(22), color: colors.text },
  subtitle: {
    ...typography.caption,
    fontSize: s(12),
    color: colors.textSecondary,
    marginTop: 2,
  },

  headerBtns: { flexDirection: "row", gap: 8 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  editBtnText: { fontSize: s(12), fontWeight: "600", color: colors.primary },

  // Goals card
  goalsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginTop: 6,
    gap: 12,
  },
  goalsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalsCardTitle: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  // First-launch card
  firstCheckInCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  firstCheckInTitle: {
    fontSize: s(15),
    fontWeight: "600",
    color: colors.text,
  },
  firstCheckInSub: {
    fontSize: s(13),
    color: colors.textSecondary,
    lineHeight: 18,
  },
  firstCheckInCta: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.primary,
    marginTop: 4,
  },

  // Stats grid
  statsGrid: { flexDirection: "row", gap: 8, marginBottom: 2 },
  // Ratio card
  ratioCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    marginTop: 6,
  },
  ratioLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  ratioValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  ratioValue: { fontSize: s(34), fontWeight: "600", color: colors.text },
  ratioTarget: { fontSize: s(14), color: colors.textSecondary },
  ratioPct: {
    fontSize: s(12),
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 8,
  },
  ratioHint: {
    fontSize: s(12),
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: "italic",
  },

  // List
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  listDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listLabel: { fontSize: s(14), fontWeight: "500", color: colors.text },
  listTrailing: { flexDirection: "row", alignItems: "center", gap: 8 },
  listValue: {
    fontSize: s(15),
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  // Profile collapsible
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 8,
  },
  profileHeaderText: {
    fontSize: s(11),
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  profileHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileIncomplete: {
    fontSize: s(11),
    color: colors.warning,
    fontWeight: "500",
  },

  // Form
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  formRow: { marginBottom: 10 },
  formLabel: {
    fontSize: s(11),
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
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
  sheetInput: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: s(14), fontWeight: "600" },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: s(15), color: colors.text },
  pickerPlaceholder: { fontSize: s(15), color: colors.textMuted },
  pickerChevron: { fontSize: s(18), color: colors.textSecondary, lineHeight: 20 },

  dobDoneBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dobDoneBtnText: { color: "#FFFFFF", fontSize: s(13), fontWeight: "600" },

  accessoryBar: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  accessoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  accessoryBtnText: { color: "#FFFFFF", fontSize: s(13), fontWeight: "600" },

  // BF banner
  bfBanner: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  bfBannerText: { fontSize: s(13), color: colors.textSecondary, lineHeight: 18 },

  // Chart
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  // Edit sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
  sheetClose: { fontSize: s(18), color: colors.textSecondary, padding: 4 },
});

