import { SkipForward, Trash2 } from 'lucide-react-native';
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { useStyles } from '../theme/useStyles';
import { hapticTap } from '../utils/haptics';

type Props = {
  onDelete?: () => void;
  onSkip: () => void;
  children: React.ReactNode;
};

const ACTION_WIDTH = 76;

export function SwipeableExerciseRow({ onDelete, onSkip, children }: Props) {
  const styles = useStyles(makeStyles);
  const ref = useRef<SwipeableMethods>(null);

  const close = () => ref.current?.close();

  const handleDelete = () => {
    hapticTap();
    close();
    onDelete?.();
  };

  const handleSkip = () => {
    hapticTap();
    close();
    onSkip();
  };

  const renderRight = () => (
    <View style={[styles.actions, !onDelete && { width: ACTION_WIDTH }]}>
      <Pressable
        onPress={handleSkip}
        style={({ pressed }) => [
          styles.action,
          styles.roundLeft,
          !onDelete && styles.roundRight,
          { backgroundColor: colors.gray },
          pressed && { opacity: 0.85 },
        ]}
      >
        <SkipForward size={18} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.actionLabel}>Skip</Text>
      </Pressable>
      {onDelete ? (
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [
            styles.action,
            styles.roundRight,
            { backgroundColor: colors.red },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Trash2 size={18} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      renderRightActions={renderRight}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const makeStyles = (s: (n: number) => number) => StyleSheet.create({
  actions: {
    width: ACTION_WIDTH * 2,
    flexDirection: 'row',
    marginBottom: 8,
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  // Only the outer edges are rounded so Skip and Delete meet flush in the
  // middle. When Skip renders alone it takes both sides instead.
  roundLeft: {
    borderTopLeftRadius: radius.card,
    borderBottomLeftRadius: radius.card,
  },
  roundRight: {
    borderTopRightRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: s(11),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
