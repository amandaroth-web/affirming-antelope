import { forwardRef, type ComponentProps } from 'react';
import { StyleSheet, type View } from 'react-native';
import Animated from 'react-native-reanimated';
import { border, color, depth, radius, space } from './tokens';

export type BubbleSide = 'learner' | 'other' | 'coach';

export interface BubbleProps extends ComponentProps<typeof Animated.View> {
  /**
   * learner: cobalt on deep cobalt, depth.sm, tail bottom right.
   * other (the person you're talking to): white raised, depth.lg, tail bottom left.
   * coach (the antelope): like other, but it fills the row beside the mascot.
   */
  side: BubbleSide;
  /** Tighter padding and corners, for replays and quoted lines. */
  compact?: boolean;
  /** The small corner on the speaker's side. Off for a card-sized line (the drill's speech card). */
  tail?: boolean;
}

/**
 * The one speech-bubble surface. It's an Animated.View that forwards its ref
 * and every animation prop (`layout`, `entering`, `exiting`, animated `style`),
 * so a bubble can be measured, morphed or springing its frame like any view.
 */
export const Bubble = forwardRef<View, BubbleProps>(function Bubble({ side, compact, tail = true, style, ...rest }, ref) {
  return (
    <Animated.View
      ref={ref}
      style={[
        styles.base,
        side === 'learner' ? styles.learner : side === 'coach' ? styles.coach : styles.other,
        tail && (side === 'learner' ? styles.tailRight : styles.tailLeft),
        compact && styles.compact,
        style,
      ]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.surface,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  learner: {
    maxWidth: '86%',
    backgroundColor: color.primary,
    borderBottomWidth: depth.sm,
    borderBottomColor: color.primaryShadow,
  },
  other: {
    maxWidth: '82%',
    flexShrink: 1,
    backgroundColor: color.white,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: depth.lg,
    borderBottomColor: color.shadow,
  },
  coach: {
    flex: 1,
    backgroundColor: color.white,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: depth.lg,
    borderBottomColor: color.shadow,
  },
  tailRight: { borderBottomRightRadius: 6 },
  tailLeft: { borderBottomLeftRadius: 6 },
  compact: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md },
});
