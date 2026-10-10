import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Text } from './Text';
import { color, radius, space } from './tokens';

export interface CalloutProps extends ViewProps {
  /** Leading glyph in its own column (a target, a bulb). */
  glyph?: ReactNode;
  /** Small cobalt heading above the content. */
  overline?: string;
  /** Icon inline before the overline (a quote mark). */
  overlineIcon?: ReactNode;
  /** Tighter vertical padding, for a one- or two-line note. */
  dense?: boolean;
  /** Decoration pinned to the callout's own box (a brightening edge, a halo), drawn over the content. */
  overlay?: ReactNode;
  /** Vertical alignment of the glyph against the content. */
  align?: 'start' | 'center';
  children?: ReactNode;
}

/**
 * Soft periwinkle inset inside a card or sheet: the trainer's note, the task,
 * a possible response, the next thing to try. It sits inside a surface, so it
 * has no edge and no depth. Extra props (accessibility, animated style) pass through.
 */
export function Callout({ glyph, overline, overlineIcon, dense, overlay, align = 'start', children, style, ...rest }: CalloutProps) {
  const body = (
    <View style={glyph ? styles.flex : styles.stack}>
      {overline ? (
        <View style={styles.head}>
          {overlineIcon}
          <Text variant="overline" color={color.primaryShadow}>
            {overline}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <View style={[styles.box, dense && styles.dense, glyph ? [styles.row, { alignItems: align === 'center' ? 'center' : 'flex-start' }, dense && styles.denseGlyph] : null, style]} {...rest}>
      {glyph}
      {body}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: color.soft, borderRadius: radius.md, padding: space[4] },
  dense: { paddingVertical: space[3] },
  row: { flexDirection: 'row', gap: space[3] },
  denseGlyph: { paddingLeft: space[3] },
  stack: { gap: space[2] },
  flex: { flex: 1, gap: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
