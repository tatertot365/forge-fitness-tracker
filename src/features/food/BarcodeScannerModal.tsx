import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";

const WINDOW_SIZE = 260;
const CORNER = 20;
const CORNER_THICKNESS = 3;

export function BarcodeScannerModal({
  visible,
  loading,
  onClose,
  onScanned,
}: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const scan = useStyles(makeScanStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  React.useEffect(() => {
    if (visible) {
      scanned.current = false;
      if (!permission?.granted) requestPermission();
    }
  }, [visible]);

  if (!visible) return null;

  if (!permission?.granted) {
    const canAskAgain = permission?.canAskAgain ?? true;
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={scan.container}>
          <Text style={scan.deniedText}>
            Camera access is required to scan barcodes.{"\n"}
            {canAskAgain
              ? "Tap below to allow access."
              : "Enable camera access in Settings to continue."}
          </Text>
          <Pressable
            onPress={() => {
              if (canAskAgain) {
                requestPermission();
              } else {
                Linking.openSettings();
              }
            }}
            style={scan.primaryBtn}
          >
            <Text style={scan.primaryBtnText}>
              {canAskAgain ? "Allow camera" : "Open Settings"}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} style={scan.closeBtn}>
            <Text style={scan.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={scan.container}>
        {loading ? (
          <View style={scan.loadingPane}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={scan.loadingText}>Looking up product…</Text>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={(result) => {
                if (scanned.current) return;
                scanned.current = true;
                onScanned(result.data);
              }}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "code128",
                  "code39",
                ],
              }}
            />
            {/* Overlay */}
            <View style={scan.overlay}>
              <View style={scan.topShade} />
              <View style={scan.middleRow}>
                <View style={scan.sideShade} />
                <View style={scan.window}>
                  <View style={[scan.corner, scan.tl]} />
                  <View style={[scan.corner, scan.tr]} />
                  <View style={[scan.corner, scan.bl]} />
                  <View style={[scan.corner, scan.br]} />
                </View>
                <View style={scan.sideShade} />
              </View>
              <View style={scan.bottomShade}>
                <Text style={scan.hint}>Point at a barcode</Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    scan.cancelBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={scan.cancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeScanStyles = (s: (n: number) => number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFill, flexDirection: "column" },
  topShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  middleRow: { flexDirection: "row", height: WINDOW_SIZE },
  sideShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  window: {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    position: "relative",
  },
  bottomShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    paddingTop: 24,
    gap: 20,
  },
  hint: { color: "rgba(255,255,255,0.8)", fontSize: s(14), fontWeight: "500" },
  cancelBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  cancelBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
  // Corner bracket helpers
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "#FFFFFF",
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  deniedText: {
    color: "#FFFFFF",
    fontSize: s(15),
    textAlign: "center",
    margin: 32,
  },
  primaryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#000000", fontSize: s(15), fontWeight: "600" },
  closeBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  closeBtnText: { color: "#FFFFFF", fontSize: s(15), fontWeight: "600" },
  loadingPane: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: s(15),
    fontWeight: "500",
  },
});
