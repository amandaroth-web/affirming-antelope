import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle, type StyleProp } from 'react-native';
import { color as palette, type as scale, type TypeVariant } from './tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Dynamic Type ceiling. Display sizes cap lower so headings don't wrap into towers. */
  maxScale?: number;
  style?: StyleProp<TextStyle>;
}

const DEFAULT_MAX: Record<TypeVariant, number> = {
  hero: 1.25,
  title: 1.3,
  heading: 1.35,
  subheading: 1.4,
  body: 1.6,
  bodyStrong: 1.6,
  label: 1.5,
  caption: 1.5,
  overline: 1.4,
  button: 1.3,
  number: 1.3,
};

/**
 * The only text component. Variants map to the brand type scale: Fredoka for
 * display (hero, title, heading, subheading, number) and Nunito for UI.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', color, align, maxScale, style, ...rest },
  ref,
) {
  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxScale ?? DEFAULT_MAX[variant]}
      style={[scale[variant], { color: color ?? palette.ink, textAlign: align }, style]}
      {...rest}
    />
  );
});
