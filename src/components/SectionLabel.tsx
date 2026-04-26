import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/spacing';

type Props = {
  children: string;
  trailing?: React.ReactNode;
};

export function SectionLabel({ children, trailing }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{children}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  text: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },
});
