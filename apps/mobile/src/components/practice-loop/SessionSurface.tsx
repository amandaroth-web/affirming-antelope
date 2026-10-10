import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { color, haptic } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { measure, takeLaunch, type HeroName, type Launch } from '@/motion/launch';

/**
 * The practice-screen container: every drill, role-play and lesson renders
 * inside one. Practice screens are transparent modals with no native
 * animation; this owns the whole transition so it can have continuity.
 *
 * Open, from a hero source (Home card, Practice tile)  ─ container transform (OPEN: ζ=1, k=80)
 *   0ms      the window IS the card: its rect, radius and face colour, opaque from frame one; the
 *            title and START proxies sit exactly on the source's, so nothing doubles or pops
 *   0-450    window grows from the card's rect on all sides to full screen (≈75% by 300ms); radius → 0;
 *            Home dims behind it (navy backdrop to 34%)
 *   30-320   face colour blends to white; the flying title turns from white to ink
 *   140-370  destination content fades in, its own staggered entrances already running
 *   0-450    title flies to the header; START surface morphs into its target (speech card / start button)
 *   190-330  the title hands off to the real header mid-flight (large-title style, no overlap)
 *   230-420  the target fills in under the arriving surface (no empty skeleton), surface fades out
 * Open, no source  ─ rises from the bottom on the OPEN spring (sheet semantics, matches swipe-down).
 * Open, replacing another practice screen  ─ already full screen; content swaps forward (in from the right).
 *
 * Close (X, Done, drag)  ─ collapses back into the source if it's still on screen (re-measured, so it lands
 * where the card is now), else slides down. Drag the header down: the screen follows the finger, shrinks a
 * touch and rounds its corners; a tick at the point of no return; release past it (or flick) and the exit
 * carries the finger's velocity. Every leg is a spring, so any of them can be interrupted by the next.
 *
 * Reduced motion: cross-fades only.
 */

// critically damped (ζ=1): 23% at 100ms, 54% at 200ms, 75% at 300ms, 91% at 450ms, so the growth reads
const OPEN = { damping: 18, stiffness: 80, mass: 1 };
const CLOSE = { damping: 32, stiffness: 340, mass: 1 };
const DISMISS_AT = 120;

interface SessionContext {
  /** Animate out, then leave the screen. Use instead of router.back(). */
  close: () => void;
  dismissGesture: PanGesture;
  /** Header title handed over by the source (e.g. the practice title), if any. */
  title?: string;
  launched: boolean;
  /** True when a flying piece of the source will land on this target. */
  hasPiece: (name: HeroName) => boolean;
  registerTarget: (name: HeroName, node: View | null, fontSize?: number, insetTop?: number) => void;
  targetStyles: Record<HeroName, TargetStyle>;
}

type TargetStyle = ReturnType<typeof useTargetStyle>;
function useTargetStyle(fn: () => { opacity: number }) {
  return useAnimatedStyle(fn);
}

const Ctx = createContext<SessionContext | null>(null);
export const useSession = () => useContext(Ctx);

/** Close the practice screen with its exit animation (falls back to router.back() outside a session). */
export function useSessionClose() {
  const s = useContext(Ctx);
  return s?.close ?? leave;
}

/** Plain JS function so worklets can schedule it (they can't capture the Keyboard module). */
function dismissKeyboard() {
  Keyboard.dismiss();
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

type RectSV = { x: SharedValue<number>; y: SharedValue<number>; w: SharedValue<number>; h: SharedValue<number>; on: SharedValue<number>; font: SharedValue<number> };

function useRectSV(): RectSV {
  return {
    x: useSharedValue(0),
    y: useSharedValue(0),
    w: useSharedValue(0),
    h: useSharedValue(0),
    on: useSharedValue(0),
    font: useSharedValue(0),
  };
}

export function SessionSurface({ children }: { children: ReactNode }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [launch] = useState<Launch | null>(() => takeLaunch());
  const hero = !!launch && launch.kind === 'hero' && !reduce;
  const replace = !!launch && launch.kind === 'replace';
  const mode: 'hero' | 'rise' | 'replace' | 'fade' = reduce ? 'fade' : hero ? 'hero' : replace ? 'replace' : 'rise';

  const p = useSharedValue(mode === 'replace' ? 1 : 0); // 0 = at the source / off-screen, 1 = full screen
  const swap = useSharedValue(mode === 'replace' ? 0 : 1); // replace: content forward swap
  const fade = useSharedValue(mode === 'fade' ? 0 : 1); // reduced motion
  const dy = useSharedValue(0); // dismiss drag
  const slide = useSharedValue(0); // 1 = exiting by sliding down rather than collapsing
  const closing = useSharedValue(0);
  const src = useRectSV();
  const title = useRectSV();
  const cta = useRectSV();
  const contentRef = useRef<View>(null);
  const leaving = useRef(false);

  const r = launch?.rect;
  useEffect(() => {
    if (r) {
      src.x.value = r.x;
      src.y.value = r.y;
      src.w.value = r.width;
      src.h.value = r.height;
    }
  }, [r, src]);

  useEffect(() => {
    if (mode === 'fade') fade.value = withTiming(1, { duration: FADE_MS });
    else if (mode === 'replace') swap.value = withSpring(1, spring.gentle);
    // one frame for destination targets to report their layout
    else p.value = withDelay(16, withSpring(1, OPEN));
  }, [mode, p, fade, swap]);

  const finish = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    leave();
  }, []);

  const close = useCallback(
    async (velocity = 0) => {
      if (leaving.current) return;
      Keyboard.dismiss();
      closing.value = 1;
      if (mode === 'fade' || mode === 'replace') {
        if (mode === 'replace') {
          // no source to return to: slide away
          slide.value = 1;
          dy.value = withSpring(H + 60, { ...CLOSE, velocity }, (f) => f && scheduleOnRN(finish));
          return;
        }
        fade.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (f) => f && scheduleOnRN(finish));
        return;
      }
      const at = mode === 'hero' ? await measure(launch?.source) : null;
      const visible = at && at.y + at.height > 0 && at.y < H;
      if (mode === 'hero' && visible) {
        src.x.value = at.x;
        src.y.value = at.y;
        src.w.value = at.width;
        src.h.value = at.height - (launch?.depth ?? 0);
        dy.value = withSpring(0, { ...CLOSE, velocity: velocity * 0.4 });
        p.value = withSpring(0, CLOSE, (f) => f && scheduleOnRN(finish));
      } else if (mode === 'rise' && dy.value === 0) {
        p.value = withSpring(0, CLOSE, (f) => f && scheduleOnRN(finish));
      } else {
        slide.value = 1;
        dy.value = withSpring(H + 60, { ...CLOSE, velocity }, (f) => f && scheduleOnRN(finish));
      }
    },
    [mode, launch, H, p, dy, slide, closing, src, fade, finish],
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  // ---- swipe the header down to dismiss
  const crossed = useSharedValue(0);
  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-18, 18])
        .onStart(() => {
          crossed.value = 0;
          scheduleOnRN(dismissKeyboard);
        })
        .onUpdate((e) => {
          const t = e.translationY;
          dy.value = t >= 0 ? t : -(1 - 1 / ((-t * 0.55) / 60 + 1)) * 60;
          const over = dy.value > DISMISS_AT ? 1 : 0;
          if (over !== crossed.value) {
            crossed.value = over;
            if (over) scheduleOnRN(haptic.tick);
          }
        })
        .onEnd((e) => {
          if (dy.value > DISMISS_AT || e.velocityY > 900) scheduleOnRN(close, e.velocityY);
          else dy.value = withSpring(0, { ...spring.release, velocity: e.velocityY });
        }),
    [dy, crossed, close],
  );

  // ---- hero targets in the destination register their rect relative to the content root
  const registerTarget = useCallback(
    (name: HeroName, node: View | null, fontSize?: number, insetTop = 0) => {
      const root = contentRef.current;
      // only claim a landing spot when the source actually sent that piece
      if (!node || !root || !hero || !launch?.pieces[name]) return;
      const t = name === 'title' ? title : cta;
      node.measureLayout(
        root,
        (x, y, w, h) => {
          t.x.value = x;
          t.y.value = y + insetTop;
          t.w.value = w;
          t.h.value = h - insetTop;
          t.font.value = fontSize ?? 0;
          t.on.value = 1;
        },
        () => {},
      );
    },
    [hero, launch, title, cta],
  );

  // ---- styles
  const backdrop = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, p.value));
    const drag = Math.min(1, dy.value / H);
    if (mode === 'fade') return { opacity: 0 };
    return { opacity: (mode === 'hero' ? 0.34 : 0.22) * Math.min(1, k * 1.6) * (1 - drag) * swap.value };
  });

  // worklets copy what they capture: never close over `launch` (it holds a ref to a native element)
  const srcRadius = launch?.radius ?? 0;
  const container = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, p.value));
    const d = dy.value;
    const shrink = 1 - Math.min(0.1, Math.max(0, d) / H * 0.35);
    const dragRadius = Math.min(32, Math.max(0, d) * 0.4);
    if (mode === 'hero') {
      const x = src.x.value * (1 - k);
      const y = src.y.value * (1 - k);
      return {
        left: x,
        top: y,
        width: src.w.value + (W - src.w.value) * k,
        height: src.h.value + (H - src.h.value) * k,
        borderRadius: Math.max(srcRadius * (1 - k), dragRadius),
        // opaque from frame one on the way in (it is the card); on the way back it fades over the real card
        opacity: slide.value || !closing.value ? 1 : interpolate(k, [0, 0.1], [0, 1], 'clamp'),
        transform: [{ translateY: d }, { scale: shrink }],
      };
    }
    if (mode === 'fade') return { left: 0, top: 0, width: W, height: H, opacity: fade.value };
    return {
      left: 0,
      top: 0,
      width: W,
      height: H,
      borderRadius: dragRadius,
      transform: [{ translateY: (1 - k) * H + d }, { scale: shrink }],
    };
  });

  const content = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, p.value));
    if (mode === 'hero') {
      return {
        left: -src.x.value * (1 - k),
        top: -src.y.value * (1 - k),
        // on the way back the screen stays visible longer, so you watch its window close onto the source
        opacity: closing.value ? interpolate(k, [0.12, 0.45], [0, 1], 'clamp') : interpolate(k, [0.35, 0.8], [0, 1], 'clamp'),
      };
    }
    if (mode === 'replace') return { left: 0, top: 0, opacity: swap.value, transform: [{ translateX: (1 - swap.value) * 28 }] };
    return { left: 0, top: 0 };
  });

  const face = useAnimatedStyle(() => ({
    opacity: closing.value ? interpolate(p.value, [0.1, 0.4], [1, 0], 'clamp') : interpolate(p.value, [0.1, 0.7], [1, 0], 'clamp'),
  }));

  // destination elements under a flying proxy stay hidden until the hand-off
  const titleTarget = useTargetStyle(() => {
    'worklet';
    return { opacity: mode === 'hero' && title.on.value && !closing.value ? interpolate(p.value, [0.7, 0.95], [0, 1], 'clamp') : 1 };
  });
  const ctaTarget = useTargetStyle(() => {
    'worklet';
    return { opacity: mode === 'hero' && cta.on.value && !closing.value ? interpolate(p.value, [0.6, 0.88], [0, 1], 'clamp') : 1 };
  });

  const ctx = useMemo<SessionContext>(
    () => ({
      close: () => close(),
      dismissGesture,
      title: hero || mode === 'fade' ? launch?.title : undefined,
      launched: hero,
      hasPiece: (name: HeroName) => hero && !!launch?.pieces[name],
      registerTarget,
      targetStyles: { title: titleTarget, cta: ctaTarget },
    }),
    [close, dismissGesture, hero, mode, launch, registerTarget, titleTarget, ctaTarget],
  );

  return (
    <GestureHandlerRootView style={styles.fill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
      <Animated.View style={[styles.container, container]}>
        <Animated.View ref={contentRef} collapsable={false} style={[styles.content, { width: W, height: H }, content]}>
          <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
        </Animated.View>
        {mode === 'hero' && launch ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: launch.face }, face]} /> : null}
      </Animated.View>
      {mode === 'hero' && launch?.pieces.title ? <TitleProxy launch={launch} p={p} t={title} closing={closing} /> : null}
      {mode === 'hero' && launch?.pieces.cta ? <CtaProxy launch={launch} p={p} t={cta} closing={closing} /> : null}
    </GestureHandlerRootView>
  );
}

/** The source title flying to the header: white on the source face, ink by the time it lands. */
function TitleProxy({ launch, p, t, closing }: { launch: Launch; p: SharedValue<number>; t: RectSV; closing: SharedValue<number> }) {
  const piece = launch.pieces.title!;
  const s = piece.rect;
  const srcFont = piece.textStyle?.fontSize ?? 28;
  const srcInk = (piece.textStyle?.color as string) ?? color.white;
  const style = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, p.value));
    const has = t.on.value === 1;
    const scale = has ? 1 + ((t.font.value ? t.font.value / srcFont : t.h.value / s.height) - 1) * k : 1;
    const cx = s.x + s.width / 2 + (has ? (t.x.value + t.w.value / 2 - (s.x + s.width / 2)) * k : 0);
    const cy = s.y + s.height / 2 + (has ? (t.y.value + t.h.value / 2 - (s.y + s.height / 2)) * k : 0);
      const vis = closing.value ? 0 : has ? interpolate(k, [0.45, 0.7], [1, 0], 'clamp') : interpolate(k, [0, 0.4], [1, 0], 'clamp');
    return {
      opacity: vis,
      color: interpolateColor(k, [0.1, 0.5], [srcInk, color.ink]),
      transform: [{ translateX: cx - s.width / 2 }, { translateY: cy - s.height / 2 }, { scale }],
    };
  });
  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.proxy, piece.textStyle, { width: s.width, transformOrigin: 'center' }, style]}
      allowFontScaling={false}
    >
      {piece.text}
    </Animated.Text>
  );
}

/** The source's call-to-action surface morphing into its counterpart (speech card, start button). */
function CtaProxy({ launch, p, t, closing }: { launch: Launch; p: SharedValue<number>; t: RectSV; closing: SharedValue<number> }) {
  const piece = launch.pieces.cta!;
  const s = piece.rect;
  const r0 = piece.radius ?? 16;
  const style = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, p.value));
    const has = t.on.value === 1;
    const x = s.x + (has ? (t.x.value - s.x) * k : 0);
    const y = s.y + (has ? (t.y.value - s.y) * k : 0);
    const w = s.width + (has ? (t.w.value - s.width) * k : 0);
    const h = s.height + (has ? (t.h.value - s.height) * k : 0);
    return {
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: r0 + (20 - r0) * k,
      opacity: closing.value ? 0 : has ? interpolate(k, [0.7, 0.93], [1, 0], 'clamp') : interpolate(k, [0, 0.35], [1, 0], 'clamp'),
    };
  });
  const label = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.22], [1, 0], 'clamp') }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ctaProxy, { backgroundColor: piece.face ?? color.white }, style]}>
      {piece.label ? (
        <Animated.Text style={[piece.labelStyle, label]} allowFontScaling={false}>
          {piece.label}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

/**
 * Marks an element in a practice screen as the landing spot for a flying
 * piece of the source. Hidden until the hand-off, then cross-fades in.
 * `fontSize` (title) lets the flying text scale to the right size.
 */
export function HeroTarget({
  name,
  fontSize,
  insetTop,
  children,
  style,
}: {
  name: HeroName;
  fontSize?: number;
  /** Part of the target's top that the proxy should not cover (e.g. a speech tail). */
  insetTop?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useContext(Ctx);
  const ref = useRef<View>(null);
  const onLayout = () => s?.registerTarget(name, ref.current, fontSize, insetTop);
  return (
    <Animated.View ref={ref} collapsable={false} onLayout={s?.launched ? onLayout : undefined} style={[style, s?.launched ? s.targetStyles[name] : null]}>
      {children}
    </Animated.View>
  );
}

/** Wrap a drag handle area (the session header) so pulling it down dismisses the screen. */
export function DismissZone({ children }: { children: ReactNode }) {
  const s = useContext(Ctx);
  if (!s) return <>{children}</>;
  return (
    <GestureDetector gesture={s.dismissGesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'transparent' },
  backdrop: { backgroundColor: color.navy },
  container: { position: 'absolute', overflow: 'hidden', backgroundColor: color.white },
  content: { position: 'absolute', backgroundColor: color.white },
  proxy: { position: 'absolute', left: 0, top: 0 },
  ctaProxy: { position: 'absolute', borderWidth: 2, borderColor: color.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
