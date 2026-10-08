import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';
import { color, depth, layout, radius, type Tone } from './tokens';

type Variant = 'primary' | 'secondary' | 'onPrimary';
type Size = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconPosition?: 'leading' | 'trailing';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const HEIGHT: Record<Size, number> = { lg: 56, md: 48, sm: 40 };
const DEPTH: Record<Size, number> = { lg: depth.lg, md: depth.md, sm: depth.sm };
const TONE: Record<Variant, Tone> = { primary: 'primary', secondary: 'surface', onPrimary: 'onPrimary' };
const INK: Record<Variant, string> = { primary: color.white, secondary: color.primary, onPrimary: color.primary };

/**
 * Chunky raised button. Primary labels are ALL CAPS (short action words only:
 * START, CONTINUE). Secondary labels stay in sentence case.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'trailing',
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const caps = variant !== 'secondary';
  const ink = disabled ? color.faint : INK[variant];
  const h = HEIGHT[size];
  return (
    <PressableSurface
      tone={TONE[variant]}
      depth={DEPTH[size]}
      radius={size === 'sm' ? radius.sm : radius.md}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      hitSlop={h < layout.minHit ? (layout.minHit - h) / 2 : undefined}
      style={[fullWidth ? styles.full : styles.hug, style]}
      contentStyle={[styles.face, { minHeight: h - 4, paddingHorizontal: size === 'sm' ? 14 : 22 }]}
    >
      <View style={[styles.row, iconPosition === 'leading' && styles.reverse]}>
        <Text
          variant={caps ? 'button' : 'bodyStrong'}
          color={ink}
          style={[caps ? null : styles.sentence, size === 'sm' && styles.small]}
          numberOfLines={1}
        >
          {caps ? label.toUpperCase() : label}
        </Text>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  face: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reverse: { flexDirection: 'row-reverse' },
  icon: { marginTop: -1 },
  sentence: { fontFamily: 'Nunito_900Black' },
  small: { fontSize: 14 },
});
