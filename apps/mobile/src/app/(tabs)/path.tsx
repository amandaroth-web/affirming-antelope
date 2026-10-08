import { MI_FOR_LEADERS, type PathUnit } from '@antelope/core';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  scrollTo,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { layoutBands, layoutTrail, NODE } from '@/components/path/geometry';
import { Landscape } from '@/components/path/Landscape';
import { Trail } from '@/components/path/Trail';
import { UnitSheet } from '@/components/path/UnitSheet';
import { WeekNode, type WeekNodeHandle } from '@/components/path/WeekNode';
import { Button, Card, FlagPennantIcon, Text, color, haptic, layout, space } from '@/design';
import { openActivity } from '@/data/routes';
import { Enter } from '@/motion';
import { TOTAL_WEEKS } from '@/state/selectors';
import { useLearner, weekStatus, type WeekStatus } from '@/state/store';

const HEADER = 76;
const BAND_COLORS = ['#F4F6FF', color.soft, '#FCF3E3', color.softDeep, '#F7F1E6', '#E9EDFD'];
const MASCOT_H = 104;

export default function PathScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, layout.maxWidth);
  const focused = useIsFocused();
  const currentWeek = useLearner((s) => s.currentWeek);
  const completed = useLearner((s) => s.completedActivityIds);
  const complete = currentWeek > TOTAL_WEEKS;

  const headerH = insets.top + HEADER;
  const intro = complete ? 300 : 0;
  const trail = useMemo(() => layoutTrail(width, TOTAL_WEEKS, headerH + 150 + intro), [width, headerH, intro]);
  const bands = useMemo(() => layoutBands(width, trail.height, BAND_COLORS), [width, trail.height]);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const currentIdx = Math.min(currentWeek, TOTAL_WEEKS) - 1;
  const walkedLen = complete ? trail.length : trail.nodeLen[currentIdx];

  // open on the current week
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || complete) return;
    didScroll.current = true;
    const y = Math.max(0, trail.nodes[currentIdx].y - winH * 0.45);
    const t = setTimeout(() => {
      scheduleOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, y, false);
      });
    }, 30);
    return () => clearTimeout(t);
  }, [complete, currentIdx, trail, winH, scrollRef]);

  // the coach turns to face you when the current week scrolls into view
  const mascot = useRef<MascotHandle>(null);
  const turn = () => mascot.current?.turn();
  const nodeY = trail.nodes[currentIdx].y;
  useAnimatedReaction(
    () => scrollY.value + winH * 0.85 > nodeY && scrollY.value + headerH < nodeY,
    (visible, prev) => {
      if (visible && prev === false) scheduleOnRN(turn);
    },
  );

  const [sheet, setSheet] = useState<{ unit: PathUnit; status: WeekStatus } | null>(null);
  const [hint, setHint] = useState<{ week: number; key: number } | null>(null);
  const nodeRefs = useRef<(WeekNodeHandle | null)[]>([]);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 2600);
    return () => clearTimeout(t);
  }, [hint]);

  const onNode = (unit: PathUnit, status: WeekStatus, i: number) => {
    if (status === 'locked') {
      haptic.warn();
      nodeRefs.current[i]?.shake();
      setHint({ week: unit.week, key: Date.now() });
      return;
    }
    setSheet({ unit, status });
  };

  const headerRule = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 24], [0, 1], 'clamp') }));

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + layout.tabBarHeight }}
      >
        <View style={{ width, height: trail.height }}>
          <Landscape bands={bands} width={width} height={trail.height} scrollY={scrollY} />
          <Trail layout={trail} walkedLen={walkedLen} scrollY={scrollY} viewportH={winH} />

          {complete && (
            <Enter style={[styles.done, { top: headerH + space[4] }]} from="scale">
              <Card tone="surface" padding={space[5]} contentStyle={styles.doneFace}>
                <Mascot pose="celebrate" mood="cheer" size={150} paused={!focused} accessibilityLabel="The antelope coach, celebrating" />
                <View style={styles.doneCopy}>
                  <Text variant="heading" align="center">
                    You’ve completed the MI for Leaders pathway.
                  </Text>
                  <Text variant="body" color={color.muted} align="center">
                    Keep practicing — everything is open.
                  </Text>
                </View>
                <Button label="Open practice" onPress={() => router.navigate('/practice')} fullWidth />
              </Card>
            </Enter>
          )}

          {MI_FOR_LEADERS.units.map((u, i) => {
            const p = trail.nodes[i];
            const status = weekStatus(u.week, currentWeek);
            const labelLeft = p.x > width / 2;
            const room = labelLeft ? p.x - NODE / 2 - 26 : width - p.x - NODE / 2 - 26;
            const isCurrent = status === 'current';
            const otherRoom = labelLeft ? width - p.x - NODE / 2 : p.x - NODE / 2;
            const mascotW = MASCOT_H * (674 / 978);
            const mascotSideRight = labelLeft ? otherRoom > mascotW + 6 : !(otherRoom > mascotW + 6);
            return (
              <View key={u.id}>
                {isCurrent && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.mascot,
                      {
                        top: p.y - MASCOT_H + NODE / 2 + 8,
                        left: mascotSideRight ? p.x + NODE / 2 - 2 : p.x - NODE / 2 - mascotW + 2,
                      },
                    ]}
                  >
                    <Mascot
                      ref={mascot}
                      pose="wave"
                      size={MASCOT_H}
                      flip={!mascotSideRight}
                      paused={!focused}
                      accessibilityLabel="The antelope coach, waiting at this week"
                    />
                  </View>
                )}
                <View style={[styles.node, { left: p.x - NODE / 2, top: p.y - NODE / 2 }]}>
                  <WeekNode
                    ref={(r) => {
                      nodeRefs.current[i] = r;
                    }}
                    week={u.week}
                    title={u.title}
                    status={status}
                    paused={!focused}
                    onPress={() => onNode(u, status, i)}
                  />
                </View>
                <View
                  pointerEvents="none"
                  style={[
                    styles.label,
                    { top: p.y - 26, maxWidth: Math.max(110, room) },
                    labelLeft ? { right: width - (p.x - NODE / 2 - 14), alignItems: 'flex-end' } : { left: p.x + NODE / 2 + 14 },
                    isCurrent && mascotSideRight === !labelLeft ? { top: p.y + NODE / 2 + 14 } : null,
                  ]}
                >
                  <Text
                    variant="overline"
                    color={status === 'complete' ? '#8A5A0B' : status === 'current' ? color.primaryShadow : color.muted}
                  >
                    Week {u.week}
                  </Text>
                  <Text
                    variant="subheading"
                    color={status === 'locked' ? color.muted : color.ink}
                    align={labelLeft ? 'right' : 'left'}
                    numberOfLines={2}
                    style={u.title.length > 16 ? styles.long : null}
                  >
                    {u.title}
                  </Text>
                  {isCurrent ? (
                    <Text variant="caption" color={color.muted} align={labelLeft ? 'right' : 'left'} style={styles.sub}>
                      {u.subtitle}
                    </Text>
                  ) : null}
                </View>
                {hint?.week === u.week && (
                  <Enter
                    key={hint.key}
                    from="scale"
                    style={[styles.hint, { top: p.y - NODE / 2 - 58, left: Math.min(Math.max(12, p.x - 110), width - 232) }]}
                  >
                    <Text variant="label" color={color.white} align="center">
                      Finish week {u.week - 1} to open {u.title}.
                    </Text>
                  </Enter>
                )}
              </View>
            );
          })}

          <View style={[styles.finish, { left: trail.finish.x - 30, top: trail.finish.y - 30 }]}>
            <View style={[styles.flag, complete && styles.flagDone]}>
              <FlagPennantIcon size={28} weight="fill" color={complete ? color.white : color.faint} />
            </View>
            <Text variant="caption" color={color.muted} align="center" style={styles.finishText}>
              {complete ? 'Pathway complete' : 'Finish line'}
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      <View style={[styles.header, { paddingTop: insets.top + space[3], height: headerH }]}>
        <View style={styles.headerInner}>
          <Text variant="subheading" accessibilityRole="header">
            {MI_FOR_LEADERS.title}
            <Text variant="subheading" color={color.muted}>
              {complete ? ' · Complete' : ` · Week ${currentWeek} of ${TOTAL_WEEKS}`}
            </Text>
          </Text>
          <View style={styles.bar} accessible accessibilityLabel={`${Math.min(currentWeek - 1, TOTAL_WEEKS)} of ${TOTAL_WEEKS} weeks complete`}>
            {MI_FOR_LEADERS.units.map((u) => {
              const s = weekStatus(u.week, currentWeek);
              return <View key={u.id} style={[styles.seg, s === 'complete' && styles.segDone, s === 'current' && styles.segNow]} />;
            })}
          </View>
        </View>
        <Animated.View style={[styles.rule, headerRule]} />
      </View>

      <UnitSheet
        unit={sheet?.unit ?? null}
        status={sheet?.status ?? 'current'}
        completed={completed}
        onClose={() => setSheet(null)}
        onStart={(activityId) => {
          const a = sheet?.unit.activities.find((x) => x.id === activityId);
          setSheet(null);
          if (a) setTimeout(() => openActivity(a, 'path'), 180);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: color.white,
    paddingHorizontal: layout.gutter,
  },
  headerInner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', gap: space[3] },
  bar: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line },
  segDone: { backgroundColor: color.gold },
  segNow: { backgroundColor: color.primary },
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: color.line },
  node: { position: 'absolute', width: NODE, height: NODE + 6 },
  label: { position: 'absolute' },
  sub: { marginTop: 2 },
  long: { fontSize: 16, lineHeight: 20 },
  mascot: { position: 'absolute' },
  hint: {
    position: 'absolute',
    width: 220,
    backgroundColor: color.navy,
    borderRadius: 14,
    paddingHorizontal: space[3],
    paddingVertical: space[2] + 2,
  },
  finish: { position: 'absolute', width: 60, alignItems: 'center' },
  flag: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.white,
    borderWidth: 2,
    borderColor: color.line,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagDone: { backgroundColor: color.gold, borderColor: color.goldShadow },
  finishText: { width: 120, marginTop: space[2] },
  done: { position: 'absolute', left: layout.gutter, right: layout.gutter },
  doneFace: { alignItems: 'center', gap: space[4] },
  doneCopy: { gap: space[1] },
});
