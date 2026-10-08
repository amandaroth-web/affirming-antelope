import { forwardRef, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowUpIcon, PressableSurface, border, color, font, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

const MIN_H = 48;
const MAX_H = 132;

export interface ComposerProps {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  placeholder?: string;
  /** Can't send right now (waiting on a reply). Typing is still allowed. */
  busy?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}

/**
 * Multiline composer that grows with the text (to a cap, then scrolls). The
 * send button wakes up with a spring pop the moment there's something to send.
 * On web, Enter sends and Shift+Enter adds a line.
 */
export const Composer = forwardRef<TextInput, ComposerProps>(function Composer(
  { value, onChangeText, onSend, placeholder = 'Type your response…', busy, autoFocus, accessibilityLabel },
  ref,
) {
  const reduce = useReduceMotion();
  const [h, setH] = useState(MIN_H);
  const [focused, setFocused] = useState(false);
  const ready = value.trim().length > 0 && !busy;
  const live = useSharedValue(ready ? 1 : 0);
  const pop = useSharedValue(1);
  const focus = useSharedValue(0);

  useEffect(() => {
    live.value = reduce ? withTiming(ready ? 1 : 0, { duration: FADE_MS }) : withSpring(ready ? 1 : 0, spring.snappy);
    if (ready && !reduce) pop.value = withSequence(withSpring(1.14, spring.snappy), withSpring(1, spring.bouncy));
  }, [ready, reduce, live, pop]);

  // shrink back after sending (onContentSizeChange doesn't always fire on clear)
  useEffect(() => {
    if (!value) setH(MIN_H);
  }, [value]);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: 140 });
  }, [focused, focus]);

  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value * (0.86 + 0.14 * live.value) }],
    opacity: 0.55 + 0.45 * live.value,
  }));
  const fieldStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [color.line, color.primary]),
  }));

  const send = () => {
    if (!ready) {
      haptic.warn();
      return;
    }
    onSend();
  };

  const onKeyPress =
    Platform.OS === 'web'
      ? (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
          const ne = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
          if (ne.key === 'Enter' && !ne.shiftKey) {
            e.preventDefault();
            send();
          }
        }
      : undefined;

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.field, fieldStyle]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.faint}
          multiline
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyPress={onKeyPress}
          onContentSizeChange={(e) => setH(Math.max(MIN_H, Math.min(MAX_H, e.nativeEvent.contentSize.height + 2)))}
          scrollEnabled={h >= MAX_H}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          style={[styles.input, { height: h }]}
          textAlignVertical="top"
        />
      </Animated.View>
      <Animated.View style={sendStyle}>
        <PressableSurface
          tone={ready ? 'primary' : 'locked'}
          depth={4}
          radius={24}
          onPress={send}
          haptic={ready ? 'press' : false}
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !ready }}
          contentStyle={styles.sendFace}
        >
          <ArrowUpIcon size={22} weight="bold" color={ready ? color.white : color.faint} />
        </PressableSurface>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  field: {
    flex: 1,
    borderWidth: border,
    borderRadius: radius.lg,
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  input: {
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    paddingHorizontal: space[4],
    paddingTop: 12,
    paddingBottom: 12,
    // web: no focus ring, no resize grip
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : null),
  },
  sendFace: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
});
