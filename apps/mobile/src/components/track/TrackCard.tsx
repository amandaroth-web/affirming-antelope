import type { PathwayId } from '@antelope/core';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { getPathway, trackName } from '@/data/pathways';
import { CheckIcon, PressableSurface, StethoscopeIcon, Text, UsersThreeIcon, border, color, depth, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

/**
 * One big tactile track card: "Patients" (MI for Clinicians) or "Your team" (MI for
 * Leaders), with the pathway's tagline and audience from core. A radio in a group.
 *
 * Selecting it: the face presses down onto its shadow (PressableSurface, tick), the
 * edge and face cross into cobalt-on-periwinkle, the icon tile turns cobalt and hops
 * (anticipation dip, bouncy rise, settle), and the radio's check pops in. Deselecting
 * eases everything back without the hop. Reduced motion: colours cross-fade, nothing
 * travels or scales.
 */
export function TrackCard({
  id,
  selected,
  onSelect,
  current,
  compact,
  style,
}: {
  id: PathwayId;
  selected: boolean;
  onSelect: (id: PathwayId) => void;
  /** Me's switcher: marks the track you're on now. */
  current?: boolean;
  /** Tighter copy for sheets (no audience line). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const pathway = getPathway(id);
  const on = useSharedValue(selected ? 1 : 0);
  const hop = useSharedValue(0);
  const pop = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      on.value = withTiming(selected ? 1 : 0, { duration: FADE_MS });
      pop.value = withTiming(selected ? 1 : 0, { duration: FADE_MS });
      return;
    }
    on.value = withSpring(selected ? 1 : 0, spring.snappy);
    pop.value = selected ? withSequence(withTiming(0, { duration: 0 }), withSpring(1, spring.bouncy)) : withSpring(0, spring.snappy);
    if (selected) hop.value = withSequence(withTiming(3, { duration: 70 }), withSpring(-7, { ...spring.bouncy, stiffness: 520 }), withSpring(0, spring.bouncy));
  }, [selected, reduce, on, pop, hop]);

  const edge = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [color.line, color.primary]),
    backgroundColor: interpolateColor(on.value, [0, 1], [color.white, color.soft]),
  }));
  const tile = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [color.soft, color.primary]),
    transform: reduce ? [] : [{ translateY: hop.value }, { rotate: `${interpolate(hop.value, [-7, 0, 3], [-6, 0, 2])}deg` }],
  }));
  const glyphOff = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const glyphOn = useAnimatedStyle(() => ({ opacity: on.value }));
  const radio = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [color.line, color.primary]),
    backgroundColor: interpolateColor(on.value, [0, 1], [color.white, color.primary]),
  }));
  const check = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.6),
    transform: reduce ? [] : [{ scale: 0.4 + 0.6 * pop.value }],
  }));

  const Glyph = pathway.setting === 'clinical' ? StethoscopeIcon : UsersThreeIcon;
  const weeks = `${pathway.units.length} weeks`;

  return (
    <PressableSurface
      onPress={() => onSelect(id)}
      haptic="tick"
      pressScale={0.985}
      depth={depth.xl}
      radius={radius.surface}
      shadow={selected ? color.primaryShadow : color.shadow}
      edge="transparent"
      face={color.white}
      style={style}
      contentStyle={styles.face}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      // react-native-web 0.21 ignores accessibilityState; aria-checked is what the web build exposes
      aria-checked={selected}
      accessibilityLabel={`${trackName(id)}. ${pathway.title}, ${weeks}. ${pathway.tagline}${compact ? '' : ` For ${pathway.audience}.`}${current ? ' Your current track.' : ''}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.edge, edge]} pointerEvents="none" />
      <View style={styles.top}>
        <Animated.View style={[styles.tile, tile]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, glyphOff]}>
            <Glyph size={30} weight="bold" color={color.primary} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, glyphOn]}>
            <Glyph size={30} weight="fill" color={color.white} />
          </Animated.View>
        </Animated.View>
        <View style={styles.flex}>
          <Text variant="overline" color={color.primaryShadow}>
            {pathway.title} · {weeks}
          </Text>
          <Text variant="heading" style={styles.name}>
            {trackName(id)}
          </Text>
        </View>
        <Animated.View style={[styles.radio, radio]}>
          <Animated.View style={check}>
            <CheckIcon size={16} weight="bold" color={color.white} />
          </Animated.View>
        </Animated.View>
      </View>
      <Text variant="body" style={styles.tagline}>
        {pathway.tagline}
      </Text>
      {compact ? null : (
        <Text variant="caption" color={color.muted} style={styles.audience}>
          For {lowerFirst(pathway.audience)}
          {current ? ' · You’re on this track' : ''}
        </Text>
      )}
      {compact && current ? (
        <Text variant="caption" color={color.muted} style={styles.audience}>
          You’re on this track
        </Text>
      ) : null}
    </PressableSurface>
  );
}

function lowerFirst(s: string) {
  // "Managers and team leads" → "managers and team leads"; keep acronyms ("MI", "ICU") as they are
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  face: { padding: space[5] },
  // painted over the face's own (transparent) edge so the colours can cross-fade
  edge: { top: -border, left: -border, right: -border, bottom: -border, borderWidth: border, borderRadius: radius.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  tile: { width: 56, height: 56, borderRadius: radius.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { marginTop: 2 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: { marginTop: space[4] },
  audience: { marginTop: space[2] },
});
