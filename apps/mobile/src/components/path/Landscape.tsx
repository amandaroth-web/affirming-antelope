import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { color } from '@/design';
import { BAND_GAP, ridgeLag, SKY_LAG, type Band } from './geometry';

const LIFT = 60; // room above each ridge for the hill crests

/**
 * Flat, banded savanna in brand tints. Ridges lag behind the trail more the
 * higher they sit on screen (the horizon is up), and the sun lags most, so it
 * sinks behind the first ridge as you set off (see `ridgeLag`). Navy appears
 * only as tiny accents: a few birds, a few acacias.
 */
export const Landscape = memo(function Landscape({
  bands,
  width,
  height,
  scrollY,
  viewportH,
}: {
  bands: Band[];
  width: number;
  height: number;
  scrollY: SharedValue<number>;
  viewportH: number;
}) {
  const sky = useAnimatedStyle(() => ({ transform: [{ translateY: Math.min(Math.max(scrollY.value, 0), 600) * SKY_LAG }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, sky]}>
        <Sky width={width} />
      </Animated.View>
      {bands.map((b, i) => (
        <BandLayer key={i} band={b} width={width} index={i} scrollY={scrollY} viewportH={viewportH} />
      ))}
    </View>
  );
});

function Sky({ width }: { width: number }) {
  return (
    <Svg width={width} height={260} style={StyleSheet.absoluteFill}>
      <Circle cx={width * 0.8} cy={150} r={46} fill={color.gold} opacity={0.16} />
      <Circle cx={width * 0.8} cy={150} r={28} fill={color.gold} opacity={0.22} />
      <Birds x={width * 0.18} y={170} />
    </Svg>
  );
}

function Birds({ x, y }: { x: number; y: number }) {
  return (
    <G stroke={color.navy} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.55}>
      <Path d={`M${x} ${y} q5 -5 10 0 q5 -5 10 0`} />
      <Path d={`M${x + 26} ${y - 14} q4 -4 8 0 q4 -4 8 0`} />
    </G>
  );
}

function Acacia({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`} opacity={0.85}>
      <Path d="M0 0 L0 -18 M0 -12 L-7 -22 M0 -10 L6 -21" stroke={color.navy} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M-20 -22 C-14 -31 14 -31 20 -22 C12 -19 -12 -19 -20 -22 Z" fill={color.navy} />
    </G>
  );
}

function BandLayer({
  band,
  width,
  index,
  scrollY,
  viewportH,
}: {
  band: Band;
  width: number;
  index: number;
  scrollY: SharedValue<number>;
  viewportH: number;
}) {
  const bandY = band.y;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ridgeLag(bandY, scrollY.value, viewportH) }] }));
  const h = BAND_GAP * 2.4 + LIFT;
  return (
    <Animated.View style={[styles.band, { top: band.y - LIFT, width, height: h }, style]}>
      <Svg width={width} height={h}>
        <G transform={`translate(0 ${LIFT})`}>
          <Path d={band.d} fill={band.fill} />
          {index % 3 === 1 && <Acacia x={width * 0.07} y={-4} s={0.75} />}
          {index % 4 === 2 && <Acacia x={width * 0.94} y={-8} s={0.65} />}
          {index % 5 === 3 && <Birds x={width * 0.62} y={-70} />}
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0 },
});
