import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Text, border, color, depth, font, haptic, radius, space } from '@/design';
import { FADE_MS, STAGGER, spring, useReduceMotion } from '@/motion';

/**
 * Segmented code input: the 6-digit sign-in code, and the 4-character cohort code
 * after a fixed "MIL" prefix.
 *
 * One real TextInput sits invisibly over the cells, so the system does the hard
 * parts: iOS one-time-code autofill from Mail (`textContentType="oneTimeCode"`),
 * Android SMS/email autofill, paste of "123 456" or "MIL-DEMO", and the keyboard.
 * The cells only draw what's in it.
 *
 * Motion: a typed character pops into its cell (bouncy, with a tick); the active
 * cell carries a blinking cobalt caret. `busy` runs a soft wave across the cells
 * while the code is checked. `error` is a system notice, not a judgement on the
 * learner: the row shakes once with a warn haptic and the cells turn warm, until
 * the next keystroke. `success` fills the cells cobalt left to right and lands on
 * a success haptic. Reduced motion: no pops, wave or shake; colours cross-fade.
 */

export type CodeState = 'idle' | 'busy' | 'error' | 'success';

export interface CodeInputHandle {
  focus: () => void;
  blur: () => void;
}

export interface CodeInputProps {
  length: number;
  value: string;
  onChange: (v: string) => void;
  /** Fires once each time the code becomes complete. */
  onComplete?: (v: string) => void;
  charset?: 'digits' | 'alnum';
  /** Fixed lead-in shown before the cells (not part of the value), e.g. "MIL". */
  prefix?: string;
  state?: CodeState;
  autoFocus?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function sanitizeCode(raw: string, length: number, charset: 'digits' | 'alnum', prefix?: string): string {
  if (charset === 'digits') return raw.replace(/\D/g, '').slice(0, length);
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const p = prefix?.toUpperCase();
  if (p) {
    // a pasted "MIL-DEMO" (or "MILDEMO") drops its prefix
    if (s.startsWith(p) && s.length > length) s = s.slice(p.length);
    // typing the prefix by hand, one key at a time: "MI" and then "L" are swallowed
    // (the prefix is already on screen, and join codes never contain I or L)
    else if (s.length >= 2 && s.length < p.length && p.startsWith(s)) s = '';
    else if (s.length < p.length && p.endsWith(s)) s = '';
  }
  return s.slice(0, length);
}

export const CodeInput = forwardRef<CodeInputHandle, CodeInputProps>(function CodeInput(
  { length, value, onChange, onComplete, charset = 'digits', prefix, state = 'idle', autoFocus, accessibilityLabel, style },
  ref,
) {
  const input = useRef<TextInput>(null);
  const reduce = useReduceMotion();
  const [focused, setFocused] = useState(false);
  const shake = useSharedValue(0);
  const tone = useSharedValue(0); // 0 idle, 1 error
  const wave = useSharedValue(0);
  const lastComplete = useRef<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      blur: () => input.current?.blur(),
    }),
    [],
  );

  useEffect(() => {
    if (state === 'error') {
      haptic.warn();
      tone.value = withTiming(1, { duration: reduce ? FADE_MS : 90 });
      if (!reduce) {
        // one decaying shake: the system saying "not that one", not a buzzer
        shake.value = withSequence(
          withTiming(-9, { duration: 45, easing: Easing.out(Easing.quad) }),
          withTiming(8, { duration: 70 }),
          withTiming(-6, { duration: 65 }),
          withTiming(4, { duration: 60 }),
          withSpring(0, spring.release),
        );
      }
    } else {
      tone.value = withTiming(0, { duration: FADE_MS });
    }
    if (state === 'busy' && !reduce) {
      wave.value = 0;
      wave.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1);
    } else {
      wave.value = withTiming(0, { duration: 120 });
    }
  }, [state, reduce, shake, tone, wave]);

  useEffect(() => {
    if (state === 'success') {
      // land on the last cell's fill
      const t = setTimeout(() => haptic.success(), reduce ? 0 : length * STAGGER + 120);
      return () => clearTimeout(t);
    }
  }, [state, reduce, length]);

  // after a code that didn't work, the field is ready again: the next character starts a fresh code
  // (refs, not props: fast typing and autofill can deliver several events before a re-render)
  const errored = useRef(false);
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    errored.current = state === 'error';
    if (state === 'error') {
      const t = setTimeout(() => input.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [state]);

  const set = (raw: string) => {
    const prev = current.current;
    const fresh = errored.current && raw.length > prev.length;
    if (fresh) errored.current = false;
    const next = sanitizeCode(fresh ? raw.slice(prev.length) : raw, length, charset, prefix);
    if (next !== prev) {
      if (next.length > prev.length) haptic.tick();
      current.current = next;
      onChange(next);
    }
    if (next.length === length) {
      if (lastComplete.current !== next) {
        lastComplete.current = next;
        onComplete?.(next);
      }
    } else lastComplete.current = null;
  };

  const row = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  const busy = state === 'busy';
  const activeIndex = focused && state !== 'success' && !busy ? Math.min(value.length, length - 1) : -1;

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false} style={style}>
      <Animated.View style={[styles.row, row]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {prefix ? (
          <View style={styles.prefix}>
            <Text variant="subheading" color={color.primaryShadow}>
              {prefix}
            </Text>
            <Text variant="subheading" color={color.faint}>
              –
            </Text>
          </View>
        ) : null}
        {Array.from({ length }, (_, i) => (
          <Cell
            key={i}
            index={i}
            char={value[i] ?? ''}
            active={i === activeIndex}
            full={value.length === length && i === length - 1 && focused}
            state={state}
            tone={tone}
            wave={wave}
            reduce={reduce}
            gapAfter={length === 6 && i === 2}
          />
        ))}
      </Animated.View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={set}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        editable={!busy && state !== 'success'}
        keyboardType={charset === 'digits' ? 'number-pad' : 'default'}
        autoCapitalize={charset === 'digits' ? 'none' : 'characters'}
        autoCorrect={false}
        spellCheck={false}
        textContentType={charset === 'digits' ? 'oneTimeCode' : 'none'}
        autoComplete={charset === 'digits' ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : 'off'}
        importantForAutofill={charset === 'digits' ? 'yes' : 'no'}
        // the typed text is drawn by the cells; this field only catches input
        caretHidden
        contextMenuHidden={false}
        selection={{ start: value.length, end: value.length }}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          text: value ? value.split('').join(' ') : 'empty',
        }}
        style={styles.hidden}
      />
    </Pressable>
  );
});

function Cell({
  index,
  char,
  active,
  full,
  state,
  tone,
  wave,
  reduce,
  gapAfter,
}: {
  index: number;
  char: string;
  active: boolean;
  full: boolean;
  state: CodeState;
  tone: SharedValue<number>;
  wave: SharedValue<number>;
  reduce: boolean;
  gapAfter: boolean;
}) {
  const pop = useSharedValue(char ? 1 : 0);
  const caret = useSharedValue(0);
  const ring = useSharedValue(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    if (!char) {
      pop.value = withTiming(0, { duration: 90 });
      return;
    }
    if (reduce) {
      pop.value = withTiming(1, { duration: FADE_MS });
      return;
    }
    pop.value = 0.35;
    pop.value = withSpring(1, spring.bouncy);
  }, [char, reduce, pop]);

  useEffect(() => {
    ring.value = withTiming(active || full ? 1 : 0, { duration: 120 });
    if (active && !char) {
      caret.value = 1;
      // authored loop: a steady blink, like the system caret
      caret.value = withRepeat(withSequence(withDelay(480, withTiming(0, { duration: 90 })), withDelay(380, withTiming(1, { duration: 90 }))), -1);
    } else caret.value = withTiming(0, { duration: 80 });
  }, [active, full, char, caret, ring]);

  useEffect(() => {
    if (state === 'success') {
      fill.value = reduce ? withTiming(1, { duration: FADE_MS }) : withDelay(index * STAGGER, withSpring(1, spring.snappy));
    } else fill.value = withTiming(0, { duration: FADE_MS });
  }, [state, reduce, index, fill]);

  const face = useAnimatedStyle(() => {
    // busy: a soft crest travels left to right
    const phase = (wave.value * 1.6 - index * 0.12 + 1) % 1;
    const crest = wave.value === 0 ? 0 : Math.max(0, 1 - Math.abs(phase - 0.5) * 4);
    const edge = interpolateColor(tone.value, [0, 1], [color.line, color.notice]);
    const active = interpolateColor(ring.value, [0, 1], [edge, color.primary]);
    return {
      backgroundColor:
        fill.value > 0
          ? interpolateColor(fill.value, [0, 1], [color.white, color.primary])
          : interpolateColor(tone.value, [0, 1], [color.white, color.noticeTint]),
      borderColor: fill.value > 0 ? interpolateColor(fill.value, [0, 1], [active, color.primaryShadow]) : active,
      borderBottomColor: fill.value > 0 ? color.primaryShadow : tone.value > 0.5 ? color.notice : ring.value > 0.5 ? color.primary : color.shadow,
      transform: [{ translateY: -crest * 4 }, { scale: 1 + 0.04 * Math.sin(Math.min(1, fill.value) * Math.PI) }],
    };
  });
  const glyph = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5),
    transform: reduce ? [] : [{ scale: 0.6 + 0.4 * pop.value }, { translateY: (1 - Math.min(1, pop.value)) * 6 }],
  }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));
  const onFill = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <Animated.View style={[styles.cell, gapAfter && styles.gapAfter, face]}>
      <Animated.View style={glyph}>
        <Text variant="number" color={color.ink} align="center">
          {char || ' '}
        </Text>
      </Animated.View>
      {/* the white glyph rides over the ink one as the cell fills */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, onFill]} pointerEvents="none">
        <Text variant="number" color={color.white} align="center">
          {char || ' '}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.caret, caretStyle]} pointerEvents="none" />
    </Animated.View>
  );
}

const CELL_H = 60;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: CELL_H,
    paddingHorizontal: space[3],
    marginRight: space[1],
    borderRadius: radius.md,
    backgroundColor: color.soft,
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: CELL_H,
    borderRadius: radius.md,
    borderWidth: border,
    borderBottomWidth: border + depth.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
  },
  gapAfter: { marginRight: space[3] },
  center: { alignItems: 'center', justifyContent: 'center' },
  caret: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    width: 2.5,
    height: 28,
    borderRadius: 2,
    backgroundColor: color.primary,
    top: (CELL_H - border * 2 - depth.md - 28) / 2,
  },
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // not 0: iOS ignores fully transparent fields for autofill
    opacity: 0.015,
    color: 'transparent',
    fontFamily: font.body,
    fontSize: 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', caretColor: 'transparent' } as object) : null),
  },
});
