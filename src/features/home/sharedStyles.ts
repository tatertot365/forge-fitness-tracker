import { StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";

// Home-screen chrome shared by more than one card or sheet: the bottom-sheet
// frame (EditCardioSheet, ExportSheet) and the "glance" card header with its
// prev/next nav (MacroRingCard, BodyStatsCard).
export const makeSharedStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
    sheetDismiss: { flex: 1 },
    sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
    sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
    sheetTitle: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
    sheetSaveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.card,
    alignItems: "center",
  },
    sheetSaveBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
    glanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
    glanceTitle: {
    fontSize: s(13),
    fontWeight: "600",
    color: colors.text,
  },
    glanceNav: {
    fontSize: s(12),
    fontWeight: "600",
    color: colors.primary,
  },
  });
