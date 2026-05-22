import { useMemo } from 'react';
import { useResponsive } from './useResponsive';

// Bridges static StyleSheet factories with the responsive scaling hook.
// Define a `makeStyles(s)` factory at module scope, then inside any
// component call `const styles = useStyles(makeStyles)` to get a styles
// object whose numeric values scale with the current window width.
//
// The factory reference itself should be stable (declared at module scope),
// so memoization keys on the scale function — which is stable per width.
export function useStyles<T>(
  factory: (scale: (n: number) => number) => T,
): T {
  const { scale } = useResponsive();
  return useMemo(() => factory(scale), [scale, factory]);
}
