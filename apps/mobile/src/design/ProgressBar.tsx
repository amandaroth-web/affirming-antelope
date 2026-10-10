import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { STAGGER } from '@/motion/constants';
import { Pip } from './Pip';
import { color } from './tokens';

export interface ProgressBarProps {
  /** One entry per segment, 0..1. A whole step is 1. */
  fills: number[];
  tint?: string;
  height?: number;
  gap?: number;
  /** Wait before a segment that gains fill starts, so the event that caused it (a check popping) lands first. */
  delay?: number;
  /** Segments that change in the same render fill this far apart (LevelPips staggers 45ms too). */
  stagger?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Segmented track. Segments share `Pip` with `LevelPips`: the same track, fill
 * spring (settle) and stagger. It starts settled, so only a change animates;
 * under reduced motion a changing segment cross-fades at full width instead of growing.
 */
export function ProgressBar({ fills, tint = color.primary, height = 8, gap = 6, delay = 0, stagger = STAGGER, accessibilityLabel, style }: ProgressBarProps) {
  const prev = useRef(fills);
  // rank among the segments changing in this render: a lone change has rank 0, so it never waits on its neighbours
  const changed = fills.map((f, i) => f !== prev.current[i]);
  useEffect(() => {
    prev.current = fills;
  });
  let rank = 0;
  return (
    <View style={[styles.row, { gap }, style]} accessible={!!accessibilityLabel} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      {fills.map((f, i) => {
        const wait = changed[i] ? rank++ * stagger : 0;
        return <Pip key={i} fill={f} tint={tint} height={height} settled reducedFade delay={(f > (prev.current[i] ?? 0) ? delay : 0) + wait} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
