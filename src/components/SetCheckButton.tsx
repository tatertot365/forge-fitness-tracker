import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../theme/colors';

type Props = {
  completed: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function SetCheckButton({ completed, onToggle, disabled }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <View
        style={[
          styles.circle,
          completed ? styles.filled : styles.empty,
        ]}
      >
        {completed ? <Check size={14} strokeWidth={2.5} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  filled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
