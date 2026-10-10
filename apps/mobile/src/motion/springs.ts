import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Named springs. Physics over timed easing: springs are interruptible and
 * carry velocity when a gesture hands off. Pick by intent, not by feel-of-the-day.
 */
export const spring = {
  /** Press-in, toggles, tab indicator. Fast, no visible overshoot. */
  snappy: { damping: 26, stiffness: 520, mass: 0.7 },
  /** Release after press; tiny overshoot so the control "lands". */
  release: { damping: 14, stiffness: 420, mass: 0.7 },
  /** Entrances, sheets, layout moves. Soft and settled. */
  gentle: { damping: 20, stiffness: 170, mass: 1 },
  /** Celebration, icon pops, mascot hops. Noticeable overshoot. */
  bouncy: { damping: 9, stiffness: 240, mass: 0.8 },
  /** Things that must stop precisely: rings filling, sheets snapping. */
  settle: { damping: 30, stiffness: 240, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

export type SpringName = keyof typeof spring;
