import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowUpIcon, PressableSurface, border, color, font, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { useFocusWithoutScroll } from './webKeyboard';

const MIN_H = 48;

/** Where the last sent message left the composer (window coords), for the bubble's launch. */
let launchPad: LaunchPad | null = null;
export interface LaunchPad {
  x: number;
  y: number;
  width: number;
  height: number;
  at: number;
  /** `center`: the bubble grows out of the middle of a small source (the Talk mode mic). Default: left and bottom edges aligned (the field). */
  from?: 'field' | 'center';
}
/** Another source a learner bubble can launch from (the hold-to-talk mic). */
export function setLaunchPad(pad: Omit<LaunchPad, 'at'>) {
  launchPad = { ...pad, at: Date.now() };
}
export function takeLaunchPad() {
  const l = launchPad;
  launchPad = null;
  return l && Date.now() - l.at < 1500 ? l : null;
}
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
  // The text that was just sent, hidden while its bubble lifts off. Derived during
  // render (not reset in an effect on every keystroke): an effect that sets state
  // after each keystroke's commit tripped React's nested-update limit while typing
  // ("Maximum update depth exceeded"), which dropped characters on the web.
  const [liftedText, setLiftedText] = useState<string | null>(null);
  const lifted = liftedText !== null && liftedText === value;
  const ready = value.trim().length > 0 && !busy;
  const live = useSharedValue(ready ? 1 : 0);
  const pop = useSharedValue(1);
  const focus = useSharedValue(0);
  const fieldRef = useRef<View>(null);
  const inputRef = useRef<TextInput | null>(null);
  const setInput = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  // iOS web: tapping the field must not make Safari scroll the page (KeyboardColumn makes room)
  useFocusWithoutScroll(inputRef);

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
    // remember where the words leave from, so the bubble can launch out of the field
    const node = fieldRef.current;
    if (!node) return onSend();
    let sent = false;
    const go = () => {
      if (sent) return;
      sent = true;
      onSend();
    };
    node.measureInWindow((x, y, width, height) => {
      if (width > 0) launchPad = { x, y, width, height, at: Date.now() };
      // the words have left the field: hide them so they aren't on screen twice while the bubble lifts off
      setLiftedText(value);
      go();
    });
    setTimeout(go, 40);
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
      <Animated.View ref={fieldRef} collapsable={false} style={[styles.field, fieldStyle]}>
        {/* invisible mirror of the text: its height drives the field (TextInput contentSize isn't reliable here) */}
        <Text
          style={[styles.input, styles.mirror]}
          onLayout={(e) => {
            const next = Math.max(MIN_H, Math.min(MAX_H, Math.ceil(e.nativeEvent.layout.height)));
            setH((prev) => (Math.abs(next - prev) < 2 ? prev : next));
          }}
          maxFontSizeMultiplier={1.4}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {value || ' '}
          {value.endsWith('\n') ? ' ' : ''}
        </Text>
        <TextInput
          ref={setInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.muted}
          multiline
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyPress={onKeyPress}
          scrollEnabled={h >= MAX_H}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          style={[styles.input, { height: h }, lifted && styles.lifted]}
          textAlignVertical="top"
        />
      </Animated.View>
      <Animated.View style={sendStyle}>
        <PressableSurface
          tone={ready ? 'primary' : 'locked'}
          depth={4}
          radius={radius.lg}
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
  lifted: { color: 'transparent' },
  // Measuring only. On the web an absolutely positioned sibling paints above the
  // in-flow <textarea>, so without these the invisible mirror swallowed every tap
  // on the field and it could never be focused by touch or click.
  mirror: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0, zIndex: -1, pointerEvents: 'none' },
  sendFace: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
});
