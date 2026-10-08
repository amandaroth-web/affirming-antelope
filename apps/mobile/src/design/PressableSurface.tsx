import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { haptic } from './haptics';
import { border, depth as depths, radius as radii, tone as tones, type Tone } from './tokens';

export interface PressableSurfaceProps extends Omit<PressableProps, 'style' | 'children'> {
  tone?: Tone;
  /** Bottom-shadow depth in pt. The face travels exactly this far when pressed. */
  depth?: number;
  radius?: number;
  /** Override the tone's colours. */
  face?: string;
  edge?: string;
  shadow?: string;
  /** Outer box: margins, width, flex. */
  style?: StyleProp<ViewStyle>;
  /** The face: padding, layout of children. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Haptic at press-in. */
  haptic?: 'press' | 'tick' | false;
  /** Optional scale at full press, for large cards (1 = none). */
  pressScale?: number;
  children?: ReactNode;
}

/**
 * The brand's 3D press. The face sits on a solid bottom shadow in the darker
 * related token; on press-in the face springs down onto it (shadow collapses),
 * on release it springs back with a whisper of overshoot so it "lands".
 */
export function PressableSurface({
  tone = 'surface',
  depth = depths.lg,
  radius = radii.surface,
  face,
  edge,
  shadow,
  style,
  contentStyle,
  haptic: feel = 'press',
  pressScale = 1,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableSurfaceProps) {
  const reduce = useReduceMotion();
  const t = disabled ? tones.locked : tones[tone];
  const pressed = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * depth }, { scale: 1 - (1 - pressScale) * pressed.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = reduce ? 1 : withSpring(1, spring.snappy);
        if (feel) haptic[feel]();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = reduce ? 0 : withSpring(0, spring.release);
        onPressOut?.(e);
      }}
      style={[{ paddingBottom: depth }, style]}
      {...rest}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { top: depth, borderRadius: radius, backgroundColor: shadow ?? t.shadow }]}
      />
      <Animated.View
        style={[
          { flexGrow: 1, borderRadius: radius, borderWidth: border, borderColor: edge ?? t.border, backgroundColor: face ?? t.face },
          contentStyle,
          faceStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Static raised surface: same depth language, no press. */
export function Raised({
  tone = 'surface',
  depth = depths.lg,
  radius = radii.surface,
  face,
  edge,
  shadow,
  style,
  contentStyle,
  children,
}: Pick<PressableSurfaceProps, 'tone' | 'depth' | 'radius' | 'face' | 'edge' | 'shadow' | 'style' | 'contentStyle' | 'children'>) {
  const t = tones[tone];
  return (
    <View style={[{ paddingBottom: depth }, style]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { top: depth, borderRadius: radius, backgroundColor: shadow ?? t.shadow }]}
      />
      <View
        style={[
          { flexGrow: 1, borderRadius: radius, borderWidth: border, borderColor: edge ?? t.border, backgroundColor: face ?? t.face },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
