import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

type Props = {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewProps['style'];
};

export function Card({ children, padded = true, style }: Props) {
  return (
    <View style={[styles.card, padded && styles.padding, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padding: {
    paddingVertical: spacing.cardY,
    paddingHorizontal: spacing.cardX,
  },
});
