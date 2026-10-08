import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { PressableSurface, Raised } from './PressableSurface';
import { depth as depths, radius, space, type Tone } from './tokens';

export interface CardProps {
  tone?: Tone;
  depth?: number;
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  children?: ReactNode;
}

/** Raised surface. Pass onPress and it becomes a pressable card with the same depth language. */
export function Card({
  tone = 'surface',
  depth = depths.lg,
  padding = space[5],
  onPress,
  style,
  contentStyle,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  children,
}: CardProps) {
  if (onPress) {
    return (
      <PressableSurface
        tone={tone}
        depth={depth}
        radius={radius.surface}
        onPress={onPress}
        disabled={disabled}
        pressScale={0.995}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={style}
        contentStyle={[{ padding }, contentStyle]}
      >
        {children}
      </PressableSurface>
    );
  }
  return (
    <Raised tone={tone} depth={depth} radius={radius.surface} style={style} contentStyle={[{ padding }, contentStyle]}>
      {children}
    </Raised>
  );
}
