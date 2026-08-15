import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../theme/colors";
import { useStyles } from "../../theme/useStyles";
import { type Measurement } from "../../types";
import { makeStyles } from "./measureStyles";
import { parseField } from "./helpers";
import {
  CIRC_FIELDS,
  EMPTY_INPUTS,
  RANGES,
  type Inputs,
  type ParsedMeasurement,
} from "./types";

// ─── Edit measurements sheet ───────────────────────────────────────────
//
// Owns the measurement entry form and its validation. Values are parsed and
// range-checked here; the parent receives only validated numbers and is
// responsible for persisting them (and for any downstream recalculation).

export function EditMeasurementSheet({
  visible,
  latest,
  onClose,
  onSave,
}: {
  visible: boolean;
  latest: Measurement | null;
  onClose: () => void;
  onSave: (parsed: ParsedMeasurement) => void;
}) {
  const styles = useStyles(makeStyles);
  const [inputs, setInputs] = useState<Inputs>(EMPTY_INPUTS);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof Inputs, string>>
  >({});

  // Seed the form from the latest measurement each time the sheet opens.
  React.useEffect(() => {
    if (!visible) return;
    setFieldErrors({});
    if (latest) {
      setInputs({
        weight_lb: latest.weight_lb != null ? String(latest.weight_lb) : "",
        body_fat_pct:
          latest.body_fat_pct != null ? String(latest.body_fat_pct) : "",
        shoulders_in:
          latest.shoulders_in != null ? String(latest.shoulders_in) : "",
        waist_in: latest.waist_in != null ? String(latest.waist_in) : "",
        arms_flexed_in:
          latest.arms_flexed_in != null ? String(latest.arms_flexed_in) : "",
        chest_in: latest.chest_in != null ? String(latest.chest_in) : "",
        quads_in: latest.quads_in != null ? String(latest.quads_in) : "",
      });
    } else {
      setInputs(EMPTY_INPUTS);
    }
  }, [visible]);

  const handleSave = () => {
    const parsed: ParsedMeasurement = {
      weight_lb: parseField(inputs.weight_lb),
      body_fat_pct: parseField(inputs.body_fat_pct),
      shoulders_in: parseField(inputs.shoulders_in),
      waist_in: parseField(inputs.waist_in),
      arms_flexed_in: parseField(inputs.arms_flexed_in),
      chest_in: parseField(inputs.chest_in),
      quads_in: parseField(inputs.quads_in),
    };
    const errs: Partial<Record<keyof Inputs, string>> = {};
    for (const [k, v] of Object.entries(parsed) as [
      keyof Inputs,
      number | null,
    ][]) {
      if (inputs[k].trim() !== "" && v == null) {
        errs[k] = "Enter a valid number";
        continue;
      }
      if (v != null) {
        const r = RANGES[k];
        if (v < r.min || v > r.max) {
          errs[k] = r.label;
        }
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setInputs(EMPTY_INPUTS);
    onSave(parsed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetBackdrop}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => onClose()}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Update measurements</Text>
            <Pressable
              onPress={() => onClose()}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Weight (lbs)</Text>
                <TextInput
                  value={inputs.weight_lb}
                  onChangeText={(t: string) => {
                    setInputs((p) => ({ ...p, weight_lb: t }));
                    if (fieldErrors.weight_lb)
                      setFieldErrors((e) => ({ ...e, weight_lb: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  style={[
                    styles.input,
                    styles.sheetInput,
                    fieldErrors.weight_lb && styles.inputError,
                  ]}
                  placeholder="optional"
                  placeholderTextColor={colors.textMuted}
                />
                {fieldErrors.weight_lb ? (
                  <Text style={styles.errorText}>{fieldErrors.weight_lb}</Text>
                ) : null}
              </View>
              <View style={{ flex: 1, marginTop: 10 }}>
                <Text style={styles.formLabel}>Body fat (%)</Text>
                <TextInput
                  value={inputs.body_fat_pct}
                  onChangeText={(t: string) => {
                    setInputs((p) => ({ ...p, body_fat_pct: t }));
                    if (fieldErrors.body_fat_pct)
                      setFieldErrors((e) => ({
                        ...e,
                        body_fat_pct: undefined,
                      }));
                  }}
                  keyboardType="decimal-pad"
                  style={[
                    styles.input,
                    styles.sheetInput,
                    fieldErrors.body_fat_pct && styles.inputError,
                  ]}
                  placeholder="optional"
                  placeholderTextColor={colors.textMuted}
                />
                {fieldErrors.body_fat_pct ? (
                  <Text style={styles.errorText}>{fieldErrors.body_fat_pct}</Text>
                ) : null}
              </View>
            </View>
            {CIRC_FIELDS.map((f) => (
              <View key={f.key} style={[styles.formRow, { marginTop: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>{f.label} (inches)</Text>
                  <TextInput
                    value={inputs[f.key]}
                    onChangeText={(t: string) => {
                      setInputs((p) => ({ ...p, [f.key]: t }));
                      if (fieldErrors[f.key])
                        setFieldErrors((e) => ({ ...e, [f.key]: undefined }));
                    }}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      styles.sheetInput,
                      fieldErrors[f.key] && styles.inputError,
                    ]}
                    placeholder="optional"
                    placeholderTextColor={colors.textMuted}
                  />
                  {fieldErrors[f.key] ? (
                    <Text style={styles.errorText}>{fieldErrors[f.key]}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveBtnText}>Save measurements</Text>
            </Pressable>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
