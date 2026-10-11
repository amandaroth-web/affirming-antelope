import type { SelfReflection } from '@antelope/core';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Mascot, type MascotHandle, type MascotMood, type MascotPose } from '@/components/mascot';
import { callName } from '@/components/practice-loop/names';
import { Dock, KeyboardColumn, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { Button, CheckIcon, CloudRainIcon, CloudSunIcon, PressableSurface, SunIcon, Text, border, color, font, radius, space } from '@/design';
import { Enter, FADE_MS, spring, useReduceMotion } from '@/motion';

type Feeling = SelfReflection['feeling'];

const OPTIONS: { value: Feeling; label: string; icon: (c: string) => ReactNode; pose: MascotPose; mood: MascotMood; line: string }[] = [
  {
    value: 'rough',
    label: 'Rough',
    icon: (c) => <CloudRainIcon size={30} weight="bold" color={c} />,
    pose: 'head',
    mood: 'listening',
    line: 'Thanks for being honest. The rough ones usually teach the most.',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    icon: (c) => <CloudSunIcon size={30} weight="bold" color={c} />,
    pose: 'head',
    mood: 'idle',
    line: 'Mixed is a fair read. Most real conversations are.',
  },
  {
    value: 'solid',
    label: 'Solid',
    icon: (c) => <SunIcon size={30} weight="bold" color={c} />,
    pose: 'wave',
    mood: 'idle',
    line: 'Good. Let’s look at what made it work, so you can do it again.',
  },
];

/**
 * Self-reflection comes before any AI feedback. Three tactile choices; the
 * antelope reacts to each (pose and line change), then an optional
 * "what would you do differently?" and SUBMIT.
 */
export function Reflection({
  name,
  initial,
  onSubmit,
  onClose,
}: {
  name: string;
  initial?: SelfReflection | null;
  onSubmit: (r: SelfReflection) => void;
  onClose: () => void;
}) {
  const focused = useIsFocused();
  const mascot = useRef<MascotHandle>(null);
  const [feeling, setFeeling] = useState<Feeling | null>(initial?.feeling ?? null);
  const [text, setText] = useState(initial?.text ?? '');
  const opt = OPTIONS.find((o) => o.value === feeling);
  const first = callName(name);

  const choose = (f: Feeling) => {
    setFeeling(f);
    if (f === 'solid') setTimeout(() => mascot.current?.wave(), 380);
    else if (f === 'mixed') setTimeout(() => mascot.current?.hop(), 300);
  };

  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={onClose}
        closeLabel="Close without feedback"
        center={
          <Text variant="overline" color={color.muted}>
            Before your feedback
          </Text>
        }
      />
      <KeyboardColumn>
        <ScrollView contentContainerStyle={[sessionStyles.scroll, styles.content]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={sessionStyles.column}>
            <Enter from="scale" style={styles.coach}>
              <Mascot ref={mascot} pose={opt?.pose ?? 'head'} mood={opt?.mood ?? 'listening'} size={110} paused={!focused} accessibilityLabel="The antelope coach" />
              <CoachLine text={opt ? opt.line : `Your read comes first. How did that feel, talking with ${first}?`} />
            </Enter>

            <Enter index={1}>
              <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>
                How do you think that went?
              </Text>
            </Enter>

            <Enter index={2} style={styles.options}>
              <View style={styles.row} accessibilityRole="radiogroup">
                {OPTIONS.map((o) => (
                  <FeelingTile key={o.value} label={o.label} icon={o.icon} selected={feeling === o.value} onPress={() => choose(o.value)} />
                ))}
              </View>
            </Enter>

            <Enter index={3} style={styles.block}>
              <Text variant="label">What would you do differently?</Text>
              <Text variant="caption" color={color.muted} style={styles.optional}>
                Optional. A sentence is plenty.
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Next time I’d…"
                placeholderTextColor={color.faint}
                multiline
                maxFontSizeMultiplier={1.4}
                style={styles.input}
                accessibilityLabel="What would you do differently? Optional"
              />
            </Enter>
          </View>
        </ScrollView>
        <Dock>
          <Button label="Submit" fullWidth disabled={!feeling} onPress={() => feeling && onSubmit({ feeling, text: text.trim() })} />
        </Dock>
      </KeyboardColumn>
    </View>
  );
}

/** Coach's line under the mascot; cross-fades when it changes. */
function CoachLine({ text }: { text: string }) {
  const o = useSharedValue(1);
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (text === shown) return;
    o.value = withSequence(withTiming(0, { duration: 120 }), withTiming(1, { duration: 200 }));
    const t = setTimeout(() => setShown(text), 120);
    return () => clearTimeout(t);
  }, [text, shown, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.bubble, style]} accessibilityLiveRegion="polite">
      <View style={styles.tail} />
      <Text variant="body" align="center">
        {shown}
      </Text>
    </Animated.View>
  );
}

function FeelingTile({ label, icon, selected, onPress }: { label: string; icon: (c: string) => ReactNode; selected: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(selected ? 1 : 0);
  const lift = useSharedValue(0);
  useEffect(() => {
    pop.value = reduce
      ? withTiming(selected ? 1 : 0, { duration: FADE_MS })
      : selected
        ? withSequence(withSpring(1.25, spring.snappy), withSpring(1, spring.bouncy))
        : withSpring(0, spring.snappy);
    if (selected && !reduce) lift.value = withSequence(withSpring(-6, spring.snappy), withSpring(0, spring.bouncy));
  }, [selected, reduce, pop, lift]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: Math.min(1, pop.value * 2) }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const ink = selected ? color.primary : color.muted;
  return (
    <PressableSurface
      onPress={onPress}
      haptic="tick"
      tone={selected ? 'soft' : 'surface'}
      edge={selected ? color.primary : undefined}
      shadow={selected ? color.primary : undefined}
      depth={5}
      radius={radius.surface}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.tile}
      contentStyle={styles.tileFace}
    >
      <Animated.View style={iconStyle}>{icon(ink)}</Animated.View>
      <Text variant="subheading" color={selected ? color.primaryShadow : color.ink}>
        {label}
      </Text>
      <Animated.View style={[styles.badge, badge]} pointerEvents="none">
        <CheckIcon size={12} weight="bold" color={color.white} />
      </Animated.View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space[2], paddingBottom: space[6] },
  coach: { alignItems: 'center', gap: space[3] },
  bubble: {
    backgroundColor: color.white,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 5,
    borderBottomColor: color.shadow,
    borderRadius: radius.surface,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    maxWidth: 320,
    minHeight: 52,
    justifyContent: 'center',
  },
  tail: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    width: 16,
    height: 16,
    backgroundColor: color.white,
    borderLeftWidth: border,
    borderTopWidth: border,
    borderColor: color.line,
    transform: [{ rotate: '45deg' }],
    borderTopLeftRadius: 3,
  },
  title: { marginTop: space[6] },
  options: { marginTop: space[5] },
  row: { flexDirection: 'row', gap: space[3] },
  tile: { flex: 1 },
  tileFace: { alignItems: 'center', justifyContent: 'center', gap: space[2], paddingVertical: space[5], minHeight: 112 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { marginTop: space[6] },
  optional: { marginTop: 2, marginBottom: space[2] },
  input: {
    minHeight: 96,
    borderWidth: border,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : null),
  },
});
