import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import {
  IconButton,
  KeyboardIcon,
  MicrophoneIcon,
  PressableSurface,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  Text,
  color,
  radius,
  space,
} from '@/design';
import { FADE_MS, useReduceMotion } from '@/motion';

/**
 * The persona's header portrait while they talk: a soft cobalt ring pulses behind it.
 * With a playback level (iOS) the ring follows their voice; otherwise it breathes on a
 * gentle 900ms loop. Reduced motion: the ring just fades in and stays.
 */
export function SpeakingRing({ active, level, size, children }: { active: boolean; level: SharedValue<number>; size: number; children: ReactNode }) {
  const reduce = useReduceMotion();
  const on = useSharedValue(0);
  const loop = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: active ? 160 : 260 });
    if (active && !reduce) loop.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    else {
      cancelAnimation(loop);
      loop.value = withTiming(0, { duration: 200 });
    }
  }, [active, reduce, on, loop]);
  const ring = useAnimatedStyle(() => {
    if (reduce) return { opacity: on.value * 0.9, transform: [{ scale: 1.22 }] };
    const lv = level.value;
    const pulse = lv > 0.02 ? lv : loop.value * 0.55;
    return { opacity: on.value * (0.55 + 0.45 * pulse), transform: [{ scale: 1 + on.value * (0.12 + 0.2 * pulse) }] };
  });
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, ring]} />
      <View style={styles.above}>{children}</View>
    </View>
  );
}

/** Header toggle in Talk mode: captions keep going, the voice stops. */
export function MuteToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <IconButton
      onPress={onToggle}
      label={muted ? 'Unmute voice' : 'Mute voice'}
      icon={muted ? <SpeakerSlashIcon size={24} weight="bold" color={color.muted} /> : <SpeakerHighIcon size={24} weight="bold" color={color.primary} />}
    />
  );
}

export type ReplyMode = 'talk' | 'type';

/**
 * The brief's "How you'll reply": Talk or Type, two raised radio tiles. The picked one
 * presses onto a cobalt edge on periwinkle (tick haptic); the choice is remembered.
 */
export function ModeChoice({ mode, onMode, talkNote }: { mode: ReplyMode; onMode: (m: ReplyMode) => void; talkNote?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="How you’ll reply" style={styles.choice}>
      <ModeTile
        picked={mode === 'talk'}
        disabled={!!talkNote}
        icon={<MicrophoneIcon size={20} weight={mode === 'talk' ? 'fill' : 'bold'} color={talkNote ? color.faint : mode === 'talk' ? color.white : color.primary} />}
        label="Talk"
        hint={talkNote ?? 'Hold to speak'}
        onPress={() => onMode('talk')}
      />
      <ModeTile
        picked={mode === 'type'}
        icon={<KeyboardIcon size={20} weight={mode === 'type' ? 'fill' : 'bold'} color={mode === 'type' ? color.white : color.primary} />}
        label="Type"
        hint="Write replies"
        onPress={() => onMode('type')}
      />
    </View>
  );
}

function ModeTile({ picked, disabled, icon, label, hint, onPress }: { picked: boolean; disabled?: boolean; icon: ReactNode; label: string; hint: string; onPress: () => void }) {
  const fade = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    fade.value = withTiming(picked ? 1 : 0, { duration: FADE_MS });
  }, [picked, fade]);
  const box = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <PressableSurface
      tone={picked ? 'soft' : 'surface'}
      edge={picked ? color.primary : undefined}
      shadow={picked ? color.primaryTint : undefined}
      depth={3}
      radius={radius.md}
      haptic="tick"
      disabled={disabled}
      onPress={picked ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: picked, disabled: !!disabled }}
      // react-native-web 0.21 ignores accessibilityState; aria-checked is what the web build exposes
      aria-checked={picked}
      accessibilityLabel={`${label}. ${hint}`}
      style={styles.tile}
      contentStyle={styles.tileFace}
    >
      <View style={[styles.icon, !picked && styles.iconIdle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.iconOn, box]} />
        {icon}
      </View>
      <View style={styles.tileCopy}>
        <Text variant="label" color={disabled ? color.faint : picked ? color.primaryShadow : color.ink}>
          {label}
        </Text>
        <Text variant="caption" color={color.muted} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', left: 0, top: 0, backgroundColor: color.primaryTint, zIndex: 0 },
  above: { zIndex: 1 },
  choice: { flexDirection: 'row', gap: space[3], marginBottom: space[3] },
  tile: { flex: 1 },
  // flexGrow 0: the face hugs its content
  tileFace: { flexGrow: 0, flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingHorizontal: space[3], paddingVertical: space[2] },
  icon: { width: 36, height: 36, borderRadius: radius.badge, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconIdle: { backgroundColor: color.soft },
  iconOn: { backgroundColor: color.primary, zIndex: -1 },
  tileCopy: { flex: 1, minWidth: 0 },
});
