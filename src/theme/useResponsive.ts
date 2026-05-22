import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { breakpoints, scale } from './spacing';

export type Responsive = {
  width: number;
  height: number;
  isSmall: boolean;
  isLarge: boolean;
  // Scale an arbitrary numeric token (font size, padding, margin, etc.)
  // off the current window width. Use this inside `useMemo`d StyleSheets so
  // values refresh on rotation or device-size change.
  scale: (value: number) => number;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const s = (v: number) => scale(v, width);
    return {
      width,
      height,
      isSmall: width < breakpoints.sm,
      isLarge: width >= breakpoints.md,
      scale: s,
    };
  }, [width, height]);
}
