import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  // Extra space reserved below the content. Defaults to the tab-bar height
  // so content scrolls past the bar; pass 0 for screens without a tab bar.
  bottomInset?: number;
} & Pick<ScrollViewProps, 'contentContainerStyle'>;

// Matches the tab-bar logical height in app/(tabs)/_layout.tsx — the bar
// already accounts for the home-indicator inset, so we only reserve the
// chrome portion here.
const TAB_BAR_HEIGHT = 56;

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  bottomInset = TAB_BAR_HEIGHT,
  contentContainerStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const paddingBottom = bottomInset + insets.bottom + 16;

  const contentStyle = [
    styles.content,
    { paddingBottom },
    contentContainerStyle,
  ];

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={contentStyle}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenX,
  },
});
