import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/spacing';
import { useStyles } from '../theme/useStyles';

type Props = {
  children: string;
  trailing?: React.ReactNode;
};

export function SectionLabel({ children, trailing }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{children}</Text>
      {trailing}
    </View>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
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
    fontSize: s(11),
    color: colors.textSecondary,
  },
});
