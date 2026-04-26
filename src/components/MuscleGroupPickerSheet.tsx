import { X } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, muscleAccent } from '../theme/colors';
import { radius, typography } from '../theme/spacing';
import { MUSCLE_LABEL, type MuscleGroup } from '../types';

const GROUPS = Object.keys(MUSCLE_LABEL) as MuscleGroup[];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (group: MuscleGroup) => void;
};

export function MuscleGroupPickerSheet({ visible, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add muscle group</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {GROUPS.map((g) => (
              <Pressable
                key={g}
                onPress={() => { onSelect(g); onClose(); }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <View
                  style={[styles.accent, { backgroundColor: muscleAccent[g] ?? colors.primary }]}
                />
                <Text style={styles.rowLabel}>{MUSCLE_LABEL[g]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { ...typography.screenTitle, fontSize: 18, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accent: {
    width: 4,
    height: 28,
    borderRadius: radius.accent,
  },
  rowLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
});
