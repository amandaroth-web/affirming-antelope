import type { LearnerMove, Stance, Turn } from '@antelope/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { callName } from '@/components/practice-loop/names';
import { MoveMarker } from '@/components/practice-loop/MoveMarker';
import { FAMILY, MOVE, ZONE, moveLabel, stanceLabel, type MoveFamily, type ZoneKey } from '@/components/practice-loop/moves';
import { EmployeeBubble, LearnerBubble } from '@/components/practice-loop/Speech';
import { ChartLineIcon, ListBulletsIcon, Text, border, color, haptic, radius, space, zone as zoneTint, type AvatarIdentity } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface Exchange {
  /** 0 = the opening line; k = the k-th learner turn and the reply to it. */
  index: number;
  value: number;
  employee: Turn;
  employeeNote?: string;
  stance?: Stance;
  learner?: Turn;
  move?: LearnerMove;
  learnerNote?: string;
  keyMoment: boolean;
}

const LABEL_W = 66;
const PAD_X = 14;
const TOP = 8;
const PLOT_H = 184;
const AXIS_H = 24;
const H = TOP + PLOT_H + AXIS_H;
const CALLOUT_W = 300;

/** Zone boundaries in intensity units. */
const BANDS: { key: ZoneKey; from: number; to: number }[] = [
  { key: 'change', from: 2, to: 0.67 },
  { key: 'mixed', from: 0.67, to: -0.67 },
  { key: 'hold', from: -0.67, to: -2 },
];

type Pt = { x: number; y: number };

/** Monotone cubic (Fritsch–Carlson): smooth, never overshoots past ±2. */
function monotone(pts: Pt[]) {
  const n = pts.length;
  if (n < 2) return { d: n ? `M${pts[0].x},${pts[0].y}` : '', segs: [] as [Pt, Pt, Pt, Pt][] };
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const slope = pts.slice(1).map((p, i) => (p.y - pts[i].y) / dx[i]);
  const m = pts.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  const segs: [Pt, Pt, Pt, Pt][] = [];
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const c1 = { x: pts[i].x + h, y: pts[i].y + m[i] * h };
    const c2 = { x: pts[i + 1].x - h, y: pts[i + 1].y - m[i + 1] * h };
    segs.push([pts[i], c1, c2, pts[i + 1]]);
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return { d, segs };
}

function bez([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function segLen(seg: [Pt, Pt, Pt, Pt], to = 1) {
  let len = 0;
  let prev = seg[0];
  const steps = 24;
  for (let k = 1; k <= steps; k++) {
    const p = bez(seg, (k / steps) * to);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/**
 * The conversation replay. The employee's openness per reply, drawn as a
 * smooth line that traces itself left to right over plain-language bands.
 * Your moves sit on the line between replies, shaped and coloured by family;
 * each pops as the line reaches it. Drag (or tap) along the chart to replay an
 * exchange: a guide and callout follow your finger on springs, with a soft
 * haptic per point. A list view carries the same content for screen readers.
 */
export function ReplayChart({
  exchanges,
  name,
  avatar,
  play = true,
  settled,
}: {
  exchanges: Exchange[];
  name: string;
  avatar: AvatarIdentity;
  /** Hold the trace until the chart is on screen and it's its turn. */
  play?: boolean;
  /** Already seen: draw it finished. */
  settled?: boolean;
}) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const [asList, setAsList] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const n = exchanges.length;

  const geo = useMemo(() => {
    if (!w || !n) return null;
    const left = LABEL_W + PAD_X;
    const right = w - PAD_X;
    const step = n > 1 ? (right - left) / (n - 1) : 0;
    const yOf = (v: number) => TOP + ((2 - Math.max(-2, Math.min(2, v))) / 4) * PLOT_H;
    const pts = exchanges.map((e, i) => ({ x: n > 1 ? left + i * step : (left + right) / 2, y: yOf(e.value) }));
    const { d, segs } = monotone(pts);
    const lens = segs.map((s) => segLen(s));
    const cum = [0];
    lens.forEach((l, i) => cum.push(cum[i] + l));
    const total = cum[cum.length - 1] || 1;
    // learner move k sits halfway along segment k-1
    const marks = exchanges.slice(1).map((e, k) => ({ ...bez(segs[k], 0.5), at: cum[k] + segLen(segs[k], 0.5), e }));
    return { pts, d, total, cum, marks, step, left, yOf };
  }, [w, n, exchanges]);

  const drawn = useSharedValue(0);
  const selX = useSharedValue(0);
  const selY = useSharedValue(0);
  const selOn = useSharedValue(0);
  const cur = useSharedValue(-1);
  // haptics only for a trace the learner is watching, never for an instant redraw
  const quiet = useSharedValue(1);
  const traced = useRef(!!settled);

  useEffect(() => {
    if (!geo || !play) return;
    const instant = reduce || traced.current;
    traced.current = true;
    quiet.value = instant ? 1 : 0;
    drawn.value = 0;
    drawn.value = instant ? geo.total : withDelay(150, withTiming(geo.total, { duration: 1300 + n * 90, easing: Easing.inOut(Easing.cubic) }));
    // after the trace lands, settle on the first key moment so the replay invites a touch
    const first = exchanges.findIndex((e) => e.keyMoment);
    const t = setTimeout(() => select(first > 0 ? first : n - 1, false), instant ? 0 : 1650 + n * 90);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, reduce, play]);

  const select = (i: number, feel = true) => {
    if (!geo || i < 0 || i >= n) return;
    cur.value = i;
    const p = geo.pts[i];
    if (reduce) {
      selX.value = p.x;
      selY.value = p.y;
      selOn.value = withTiming(1, { duration: FADE_MS });
    } else {
      selX.value = withSpring(p.x, spring.snappy);
      selY.value = withSpring(p.y, spring.snappy);
      selOn.value = withSpring(1, spring.gentle);
    }
    setSel(i);
    if (feel) haptic.press();
  };

  const left = geo?.left ?? 0;
  const step = geo?.step ?? 1;
  const xs = geo?.pts.map((p) => p.x) ?? [];
  const ys = geo?.pts.map((p) => p.y) ?? [];

  const pick = (x: number) => {
    'worklet';
    if (n === 0) return;
    const i = n > 1 ? Math.max(0, Math.min(n - 1, Math.round((x - left) / step))) : 0;
    if (i === cur.value) return;
    cur.value = i;
    selX.value = withSpring(xs[i], spring.snappy);
    selY.value = withSpring(ys[i], spring.snappy);
    selOn.value = withSpring(1, spring.gentle);
    scheduleOnRN(setSel, i);
    scheduleOnRN(haptic.press);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart((e) => pick(e.x))
    .onUpdate((e) => pick(e.x));
  const tap = Gesture.Tap().onEnd((e) => pick(e.x));
  const gesture = Gesture.Race(pan, tap);

  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: (geo?.total ?? 0) - drawn.value }));
  const guide = useAnimatedStyle(() => ({ opacity: selOn.value * 0.9, transform: [{ translateX: selX.value - 1 }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: selOn.value,
    transform: [{ translateX: selX.value - 13 }, { translateY: selY.value - 13 }, { scale: 0.6 + 0.4 * selOn.value }],
  }));
  const cw = Math.min(CALLOUT_W, w);
  const callout = useAnimatedStyle(() => {
    const l = Math.min(Math.max(selX.value - cw / 2, 0), Math.max(0, w - cw));
    return { opacity: selOn.value, transform: [{ translateX: l }, { translateY: (1 - selOn.value) * 8 }] };
  });
  const caret = useAnimatedStyle(() => {
    const l = Math.min(Math.max(selX.value - cw / 2, 0), Math.max(0, w - cw));
    return { transform: [{ translateX: Math.max(14, Math.min(cw - 30, selX.value - l - 8)) }, { rotate: '45deg' }] };
  });

  const families = Array.from(new Set(exchanges.filter((e) => e.move).map((e) => MOVE[e.move!].family)));
  const first = exchanges[0];
  const lastEx = exchanges[n - 1];
  const summary = n
    ? `${callName(name)} started ${stanceLabel(first.stance, first.value).toLowerCase()} and ended ${stanceLabel(lastEx.stance, lastEx.value).toLowerCase()}, over ${n - 1} ${n - 1 === 1 ? 'exchange' : 'exchanges'}.`
    : '';
  const s = sel !== null ? exchanges[sel] : null;

  return (
    <View>
      <View style={styles.toggleRow}>
        <Text variant="caption" color={color.muted} style={styles.flex}>
          {asList ? 'Each exchange, in order.' : `How open ${callName(name)} was after each of your replies.`}
        </Text>
        <Pressable
          onPress={() => setAsList((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={asList ? 'Show as chart' : 'Show as list'}
          hitSlop={8}
          style={styles.toggle}
        >
          {asList ? <ChartLineIcon size={16} weight="bold" color={color.primary} /> : <ListBulletsIcon size={16} weight="bold" color={color.primary} />}
          <Text variant="label" color={color.primary}>
            {asList ? 'Chart' : 'List'}
          </Text>
        </Pressable>
      </View>

      {asList ? (
        <ExchangeList exchanges={exchanges} avatar={avatar} name={name} />
      ) : (
        <>
          <GestureDetector gesture={gesture}>
            <View
              style={styles.plot}
              onLayout={(e) => setW(e.nativeEvent.layout.width)}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Conversation replay chart. ${summary} Switch to list for each exchange.`}
            >
              {geo ? (
                <>
                  <Svg width={w} height={H} style={StyleSheet.absoluteFill}>
                    {BANDS.map((b) => (
                      <Rect
                        key={b.key}
                        x={LABEL_W}
                        y={geo.yOf(b.from)}
                        width={w - LABEL_W}
                        height={geo.yOf(b.to) - geo.yOf(b.from)}
                        fill={zoneTint[b.key]}
                      />
                    ))}
                    <Line x1={LABEL_W} x2={w} y1={geo.yOf(0)} y2={geo.yOf(0)} stroke={color.line} strokeWidth={1.5} strokeDasharray="4 5" />
                    <AnimatedPath
                      d={geo.d}
                      stroke={color.primary}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeDasharray={`${geo.total} ${geo.total}`}
                      animatedProps={pathProps}
                    />
                  </Svg>
                  {BANDS.map((b) => (
                    <View key={b.key} style={[styles.bandLabel, { top: geo.yOf(b.from), height: geo.yOf(b.to) - geo.yOf(b.from) }]} pointerEvents="none">
                      <Text variant="caption" color={b.key === 'change' ? color.primaryShadow : b.key === 'hold' ? zoneTint.holdInk : color.muted} style={styles.bandText}>
                        {ZONE[b.key].label}
                      </Text>
                    </View>
                  ))}
                  <Animated.View style={[styles.guide, { top: TOP, height: PLOT_H }, guide]} pointerEvents="none" />
                  {geo.pts.map((p, i) => (
                    <PopIn key={`p${i}`} x={p.x} y={p.y} at={Math.max(1, geo.cum[i] ?? geo.total)} drawn={drawn} size={12}>
                      <View style={[styles.point, { borderColor: exchanges[i].value >= 0.67 ? color.primaryShadow : exchanges[i].value <= -0.67 ? zoneTint.holdInk : color.muted }]} />
                    </PopIn>
                  ))}
                  {geo.marks.map((m, k) => (
                    <PopIn key={`m${k}`} x={m.x} y={m.y} at={m.at} drawn={drawn} size={16} feel={m.e.keyMoment} quiet={quiet}>
                      <MoveMarker family={m.e.move ? MOVE[m.e.move].family : 'neutral'} size={16} ring={m.e.keyMoment ? color.gold : undefined} />
                    </PopIn>
                  ))}
                  <Animated.View style={[styles.halo, halo]} pointerEvents="none" />
                  {exchanges.map((e, i) => (
                    <Text key={`x${i}`} variant="caption" color={sel === i ? color.primary : color.faint} style={[styles.axis, { left: geo.pts[i].x - 20, top: TOP + PLOT_H + 4 }]}>
                      {i === 0 ? 'Start' : i}
                    </Text>
                  ))}
                </>
              ) : null}
            </View>
          </GestureDetector>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.point, styles.legendPoint]} />
              <Text variant="caption" color={color.muted}>
                {callName(name)}’s replies
              </Text>
            </View>
            {families.map((f) => (
              <View key={f} style={styles.legendItem}>
                <MoveMarker family={f as MoveFamily} size={13} />
                <Text variant="caption" color={color.muted}>
                  {FAMILY[f as MoveFamily].label}
                </Text>
              </View>
            ))}
            {exchanges.some((e) => e.keyMoment) ? (
              <View style={styles.legendItem}>
                <View style={styles.keyRing} />
                <Text variant="caption" color={color.muted}>
                  Key moment
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.calloutZone}>
            {s ? (
              <Animated.View style={[styles.callout, { width: cw }, callout]} accessibilityLiveRegion="polite">
                <Animated.View style={[styles.caret, caret]} />
                <ExchangeDetail e={s} avatar={avatar} name={name} />
              </Animated.View>
            ) : (
              <Text variant="caption" color={color.muted} align="center" style={styles.hint}>
                Drag along the line to replay each exchange.
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function PopIn({
  x,
  y,
  at,
  drawn,
  size,
  feel,
  quiet,
  children,
}: {
  x: number;
  y: number;
  at: number;
  drawn: SharedValue<number>;
  size: number;
  /** A key moment: a light haptic as the line reaches it. */
  feel?: boolean;
  quiet?: SharedValue<number>;
  children: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  const s = useSharedValue(0);
  useAnimatedReaction(
    () => drawn.value >= at - 0.5,
    (on, prev) => {
      if (on && !prev && feel && quiet && !quiet.value) scheduleOnRN(haptic.press);
      if (on && !prev) s.value = reduce || (quiet && quiet.value) ? withTiming(1, { duration: reduce ? FADE_MS : 0 }) : withSpring(1, spring.bouncy);
      if (!on && prev) s.value = 0;
    },
  );
  const style = useAnimatedStyle(() => (reduce ? { opacity: s.value } : { opacity: Math.min(1, s.value * 2), transform: [{ scale: s.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {children}
    </Animated.View>
  );
}

function ExchangeDetail({ e, avatar, name }: { e: Exchange; avatar: AvatarIdentity; name: string }) {
  const first = callName(name);
  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <Text variant="overline" color={color.primaryShadow}>
          {e.index === 0 ? `${first} opens` : `Exchange ${e.index}`}
        </Text>
        <Text variant="caption" color={color.muted}>
          {stanceLabel(e.stance, e.value)}
        </Text>
      </View>
      {e.learner ? (
        <>
          <View style={styles.moveRow}>
            <MoveMarker family={e.move ? MOVE[e.move].family : 'neutral'} size={12} ring={e.keyMoment ? color.gold : undefined} />
            <Text variant="caption" color={color.ink}>
              You · {moveLabel(e.move)}
            </Text>
          </View>
          <LearnerBubble text={e.learner.text} compact />
        </>
      ) : null}
      <EmployeeBubble text={e.employee.text} avatar={avatar} name={name} compact />
      {e.learnerNote || e.employeeNote ? (
        <Text variant="caption" color={color.muted} style={styles.note}>
          {[e.learnerNote, e.employeeNote].filter(Boolean).join(' ')}
        </Text>
      ) : null}
    </View>
  );
}

function ExchangeList({ exchanges, avatar, name }: { exchanges: Exchange[]; avatar: AvatarIdentity; name: string }) {
  return (
    <View style={styles.list}>
      {exchanges.map((e) => (
        <View key={e.index} style={styles.listItem}>
          <ExchangeDetail e={e} avatar={avatar} name={name} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4 },
  plot: { height: H, borderRadius: radius.md, overflow: 'hidden' },
  bandLabel: { position: 'absolute', left: 0, width: LABEL_W - 8, justifyContent: 'center' },
  bandText: { fontSize: 12, lineHeight: 15 },
  guide: { position: 'absolute', left: 0, width: 2, borderRadius: 1, backgroundColor: color.primaryTint },
  // the employee's replies: hollow rings, so they never read as one of your (filled) moves
  point: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: color.white },
  halo: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: color.primary,
    backgroundColor: 'rgba(79,107,237,0.12)',
  },
  axis: { position: 'absolute', width: 40, textAlign: 'center', fontSize: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4], rowGap: space[2], marginTop: space[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendPoint: { borderColor: color.muted },
  keyRing: { width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: color.gold },
  calloutZone: { marginTop: space[4], minHeight: 60 },
  callout: {
    backgroundColor: color.white,
    borderRadius: radius.surface,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 5,
    borderBottomColor: color.shadow,
    padding: space[4],
  },
  caret: {
    position: 'absolute',
    top: -9,
    left: 0,
    width: 16,
    height: 16,
    backgroundColor: color.white,
    borderLeftWidth: border,
    borderTopWidth: border,
    borderColor: color.line,
    borderTopLeftRadius: 3,
  },
  hint: { paddingVertical: space[4] },
  detail: { gap: space[2] },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
  note: { marginTop: 2 },
  list: { gap: space[3] },
  listItem: { borderWidth: border, borderColor: color.line, borderRadius: radius.surface, padding: space[4] },
});
