import type { StyleProp, ViewStyle } from 'react-native';

export type MascotPose = 'wave' | 'celebrate' | 'head';
export type MascotMood = 'idle' | 'listening' | 'cheer';

/**
 * Stable mascot API. The sprite rig (MascotSprite) implements it today; a Rive
 * implementation can drop in behind the same props and handle later.
 */
export interface MascotProps {
  pose?: MascotPose;
  mood?: MascotMood;
  /** Height in pt. Width follows the pose's artwork. */
  size: number;
  /** Wave once shortly after mount (only meaningful for pose="wave"). */
  greet?: boolean;
  /** Stop breathing and blinking, e.g. when the screen is not focused. */
  paused?: boolean;
  /** Mirror horizontally so the mascot faces the other way. */
  flip?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export interface MascotHandle {
  /** Arm wave (wave pose); a small hop for the other poses. */
  wave: () => void;
  /** Squash-and-stretch hop. */
  hop: () => void;
  /** Quick turn toward the viewer, then a wave. */
  turn: () => void;
}
