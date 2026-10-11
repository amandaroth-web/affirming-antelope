import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MicrophoneIcon, PauseIcon, PlayIcon, PressableSurface, Raised, Text, TextLink, color, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

/**
 * The trainer's voice note. A cobalt play button and a waveform scrubber.
 *
 * - The waveform is drawn twice (idle tint and cobalt) and the cobalt copy is
 *   clipped to the playhead, so progress is one animated width on the UI thread.
 *   Between the player's status updates (every 250ms) the playhead glides linearly,
 *   so it never steps.
 * - Drag or tap anywhere on the waveform to scrub: the playhead follows the finger
 *   1:1 (tick on touch-down), the knob swells while held, and the player seeks on release.
 * - Plays through the silent switch, like a voicemail.
 * Reduced motion: the playhead still tracks time (it's information), but the knob
 * doesn't swell and the play icon doesn't pop.
 */

const BARS = 40;
const TICK_MS = 250;

function bars(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (i + 1), 2246822507) >>> 0;
    const noise = (h % 1000) / 1000;
    // speech-like: louder in phrases, quieter between
    const phrase = 0.55 + 0.45 * Math.abs(Math.sin((i / BARS) * Math.PI * 3.2 + 0.6));
    return Math.max(0.18, Math.min(1, 0.25 + noise * 0.75 * phrase));
  });
}

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export function VoiceNote({
  url,
  seed,
  trainerFirst,
  error,
  onRetry,
}: {
  url: string | null;
  seed: string;
  trainerFirst: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  const player = useAudioPlayer(url ? { uri: url } : null, {
    updateInterval: TICK_MS,
  });
  const status = useAudioPlayerStatus(player);
  const reduce = useReduceMotion();
  const heights = useMemo(() => bars(seed), [seed]);
  const width = useSharedValue(0);
  const head = useSharedValue(0); // 0..1
  const dragging = useSharedValue(0);
  const pop = useSharedValue(1);
  const [w, setW] = useState(0);
  const lastFinish = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const duration = status.duration || 0;
  const ready = !!url && status.isLoaded && duration > 0;

  // the playhead follows the player; glide to where it will be at the next update
  useEffect(() => {
    if (!duration || dragging.value) return;
    const at = Math.min(1, status.currentTime / duration);
    if (status.playing) {
      const ahead = Math.min(1, (status.currentTime + TICK_MS / 1000) / duration);
      head.value = at;
      head.value = withTiming(ahead, {
        duration: TICK_MS,
        easing: Easing.linear,
      });
    } else head.value = withTiming(at, { duration: 120 });
  }, [status.currentTime, status.playing, duration, head, dragging]);

  useEffect(() => {
    if (status.didJustFinish && !lastFinish.current) {
      lastFinish.current = true;
      player.pause();
      void player.seekTo(0);
      head.value = withTiming(0, { duration: 260 });
    } else if (!status.didJustFinish) lastFinish.current = false;
  }, [status.didJustFinish, player, head]);

  const toggle = () => {
    if (!ready) return;
    if (!reduce) {
      pop.value = 0.82;
      pop.value = withSpring(1, spring.bouncy);
    }
    if (status.playing) player.pause();
    else player.play();
  };

  const seek = (f: number) => {
    if (!duration) return;
    void player.seekTo(f * duration);
  };

  const scrub = Gesture.Pan()
    .minDistance(0)
    .enabled(ready)
    .onBegin((e) => {
      dragging.value = 1;
      const W = width.value || 1;
      head.value = Math.max(0, Math.min(1, e.x / W));
      scheduleOnRN(haptic.tick);
    })
    .onUpdate((e) => {
      const W = width.value || 1;
      head.value = Math.max(0, Math.min(1, e.x / W));
    })
    .onFinalize(() => {
      dragging.value = 0;
      scheduleOnRN(seek, head.value);
    });

  const fill = useAnimatedStyle(() => ({ width: head.value * width.value }));
  const knob = useAnimatedStyle(() => ({
    transform: [
      { translateX: head.value * width.value - KNOB / 2 },
      {
        scale: reduce ? 1 : withSpring(dragging.value ? 1.35 : 1, spring.snappy),
      },
    ],
    opacity: withTiming(ready ? 1 : 0, { duration: FADE_MS }),
  }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    setW(e.nativeEvent.layout.width);
  };

  const label = error ? 'Couldn’t load the voice note' : !ready ? 'Loading voice note…' : status.playing ? 'Playing' : `Voice note, ${clock(duration)}`;

  return (
    <Raised contentStyle={styles.face}>
      <View style={styles.head}>
        <MicrophoneIcon size={16} weight="bold" color={color.primaryShadow} />
        <Text variant="overline" color={color.primaryShadow}>
          Voice note from {trainerFirst}
        </Text>
      </View>
      <View style={styles.row}>
        <PressableSurface
          tone="primary"
          depth={4}
          radius={radius.pill}
          onPress={toggle}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
          contentStyle={[styles.play, !ready && styles.playIdle]}
          style={styles.playWrap}
        >
          <Animated.View style={icon}>
            {status.playing ? (
              <PauseIcon size={26} weight="fill" color={color.white} />
            ) : (
              <PlayIcon size={26} weight="fill" color={color.white} style={styles.playGlyph} />
            )}
          </Animated.View>
        </PressableSurface>

        <View style={styles.track}>
          <GestureDetector gesture={scrub}>
            <View
              style={styles.wave}
              onLayout={onLayout}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Playback position"
              accessibilityValue={{
                text: `${clock(status.currentTime)} of ${clock(duration)}`,
              }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => {
                if (!duration) return;
                const step = e.nativeEvent.actionName === 'increment' ? 5 : -5;
                void player.seekTo(Math.max(0, Math.min(duration, status.currentTime + step)));
              }}
            >
              <Bars heights={heights} tint={ready ? color.primaryTint : color.softDeep} />
              <Animated.View style={[styles.fill, fill]} pointerEvents="none">
                <View style={{ width: w }}>
                  <Bars heights={heights} tint={color.primary} />
                </View>
              </Animated.View>
              <Animated.View style={[styles.knob, knob]} pointerEvents="none" />
            </View>
          </GestureDetector>
          <View style={styles.times}>
            <Text variant="caption" color={color.muted}>
              {ready ? clock(status.currentTime) : label}
            </Text>
            {ready ? (
              <Text variant="caption" color={color.muted}>
                {clock(duration)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      {error && onRetry ? <TextLink label="Try loading it again" onPress={onRetry} style={styles.retry} /> : null}
    </Raised>
  );
}

function Bars({ heights, tint }: { heights: number[]; tint: string }) {
  return (
    <View style={styles.bars}>
      {heights.map((h, i) => (
        <View key={i} style={[styles.bar, { height: `${Math.round(h * 100)}%`, backgroundColor: tint }]} />
      ))}
    </View>
  );
}

const KNOB = 14;
const WAVE_H = 40;

const styles = StyleSheet.create({
  face: { padding: space[4], gap: space[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  playWrap: { flexGrow: 0 },
  play: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
  },
  playIdle: { opacity: 0.6 },
  playGlyph: { marginLeft: 3 },
  track: { flex: 1 },
  wave: { height: WAVE_H + 8, justifyContent: 'center' },
  bars: {
    height: WAVE_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: { width: 3, borderRadius: 2 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 4,
    height: WAVE_H,
    overflow: 'hidden',
  },
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: color.white,
    borderWidth: 3,
    borderColor: color.primary,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  retry: { alignSelf: 'flex-start' },
});
