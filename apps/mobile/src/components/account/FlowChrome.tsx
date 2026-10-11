import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CaretLeftIcon, IconButton, Text, WarningCircleIcon, XIcon, border, color, depth, font, layout, radius, space } from '@/design';
import { Expand, FADE_MS } from '@/motion';

/**
 * Chrome for the account flows (sign in, join a cohort, review detail): a quiet top
 * bar with close or back, a labelled text field with the app's focus ring, and a
 * gentle system notice that opens in place.
 */

export function FlowHeader({
  onClose,
  onBack,
  center,
  trailing,
  topInset = 0,
}: {
  onClose?: () => void;
  onBack?: () => void;
  center?: ReactNode;
  trailing?: ReactNode;
  topInset?: number;
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + space[2] }]}>
      <View style={styles.headerRow}>
        <View style={styles.side}>
          {onBack ? (
            <IconButton onPress={onBack} label="Back" icon={<CaretLeftIcon size={26} weight="bold" color={color.muted} />} />
          ) : onClose ? (
            <IconButton onPress={onClose} label="Close" icon={<XIcon size={26} weight="bold" color={color.muted} />} />
          ) : null}
        </View>
        <View style={styles.center}>{center}</View>
        <View style={[styles.side, styles.trailing]}>{trailing}</View>
      </View>
    </View>
  );
}

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shows the field's edge in the notice colour. */
  invalid?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A single-line field: 2pt edge, raised like the rest of the app, cobalt ring when focused. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, invalid, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  const f = useSharedValue(0);
  const bad = useSharedValue(0);
  useEffect(() => {
    f.value = withTiming(focused ? 1 : 0, { duration: 140 });
  }, [focused, f]);
  useEffect(() => {
    bad.value = withTiming(invalid ? 1 : 0, { duration: FADE_MS });
  }, [invalid, bad]);
  const ring = useAnimatedStyle(() => {
    const base = interpolateColor(bad.value, [0, 1], [color.line, color.notice]);
    return {
      borderColor: interpolateColor(f.value, [0, 1], [base, bad.value > 0.5 ? color.notice : color.primary]),
      borderBottomColor: interpolateColor(f.value, [0, 1], [bad.value > 0.5 ? color.notice : color.shadow, bad.value > 0.5 ? color.notice : color.primary]),
    };
  });
  return (
    <View style={style}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <Animated.View style={[styles.field, ring]}>
        <TextInput
          ref={ref}
          placeholderTextColor={color.faint}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
          {...rest}
        />
      </Animated.View>
    </View>
  );
});

/** A system notice under a field: offline, a code that didn't work. Opens in place. */
export function Notice({ text, style }: { text: string | null; style?: StyleProp<ViewStyle> }) {
  return (
    <Expand open={!!text} style={style}>
      <View style={styles.notice} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <WarningCircleIcon size={18} weight="bold" color={color.notice} />
        <Text variant="bodySmall" color={color.notice} style={styles.flex}>
          {text ?? ''}
        </Text>
      </View>
    </Expand>
  );
}

export const flowStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  body: {
    paddingHorizontal: layout.gutter,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: layout.gutter - 10,
    paddingBottom: space[1],
    backgroundColor: color.white,
    zIndex: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    width: '100%',
    maxWidth: layout.maxWidth + 20,
    alignSelf: 'center',
  },
  side: { minWidth: 48, justifyContent: 'center' },
  trailing: { alignItems: 'flex-end', paddingRight: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: space[2] },
  field: {
    borderWidth: border,
    borderBottomWidth: border + depth.sm,
    borderRadius: radius.md,
    backgroundColor: color.white,
  },
  input: {
    minHeight: 54,
    paddingHorizontal: space[4],
    fontFamily: font.bodyBold,
    fontSize: 17,
    color: color.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingTop: space[3],
  },
});
