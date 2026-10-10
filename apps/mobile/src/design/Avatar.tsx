import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { color } from './tokens';

/**
 * Deterministic illustrated persona from a seed (Persona.avatarSeed).
 * Flat shapes with the mascot's navy contour, on a soft brand-tint disc.
 * Same seed, same person, everywhere.
 */

const INK = color.navy;
const BACKDROPS = [color.soft, color.goldTint, '#E2F0E8', '#FCE5D8', '#DDEEF8', '#F1ECE2'];
const SKIN = ['#F7D7BE', '#EDBE98', '#D9A273', '#B97E52', '#8F5D3B', '#5F3D27'];
const HAIR = ['#1E1916', '#3A2A1F', '#5E4129', '#8C6239', '#C79A5B', '#9A9AA2'];
const TOPS = [color.primary, color.navy, '#2E8C7E', '#D9704E', '#6A7896', color.gold, '#3F6FB5'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export interface AvatarTraits {
  backdrop: string;
  skin: string;
  hair: string;
  top: string;
  hairStyle: 'crop' | 'part' | 'long' | 'bun' | 'curls' | 'buzz' | 'bob';
  collar: 'crew' | 'scrubs' | 'collar' | 'lanyard';
  glasses: boolean;
  earrings: boolean;
}

/** Tuned once so the demo cast reads as a varied group of people. Changing it reshuffles everyone. */
const SALT = 39;

/** Each trait draws from its own hash so traits don't correlate. */
function trait(seed: string, key: string) {
  return rng(hash(`${SALT}:${key}:${seed}`))();
}

export function traitsFor(seed: string): AvatarTraits {
  const p = <T,>(key: string, xs: readonly T[]) => xs[Math.floor(trait(seed, key) * xs.length)];
  return {
    backdrop: p('backdrop', BACKDROPS),
    skin: p('skin', SKIN),
    hair: p('hair', HAIR),
    top: p('top', TOPS),
    hairStyle: p('style', ['crop', 'part', 'long', 'bun', 'curls', 'buzz', 'bob'] as const),
    collar: p('collar', ['crew', 'scrubs', 'collar', 'lanyard'] as const),
    glasses: trait(seed, 'glasses') < 0.3,
    earrings: trait(seed, 'earrings') < 0.3,
  };
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const rr = f((n >> 16) & 255), gg = f((n >> 8) & 255), bb = f(n & 255);
  return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

const SW = 2; // contour, matches the mascot's outline weight at 64pt

function HairBack({ t }: { t: AvatarTraits }) {
  if (t.hairStyle === 'long')
    return <Path d="M17 30c0-11 6-18 15-18s15 7 15 18v17c0 3-3 4-6 4H23c-3 0-6-1-6-4V30Z" fill={t.hair} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />;
  if (t.hairStyle === 'bob')
    return <Path d="M18 30c0-10 6-17 14-17s14 7 14 17v8c0 3-2 5-5 5H23c-3 0-5-2-5-5v-8Z" fill={t.hair} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />;
  if (t.hairStyle === 'bun') return <Circle cx={32} cy={11} r={6} fill={t.hair} stroke={INK} strokeWidth={SW} />;
  if (t.hairStyle === 'curls')
    return (
      <G fill={t.hair} stroke={INK} strokeWidth={SW}>
        <Circle cx={20} cy={24} r={6} />
        <Circle cx={44} cy={24} r={6} />
        <Circle cx={22} cy={34} r={5} />
        <Circle cx={42} cy={34} r={5} />
      </G>
    );
  return null;
}

function HairFront({ t }: { t: AvatarTraits }) {
  const p = { fill: t.hair, stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const };
  switch (t.hairStyle) {
    case 'crop':
      return <Path d="M19.5 28c-1-9 5-15 12.5-15S45.5 19 44.5 28c-2-4-6-6-12.5-6S21.5 24 19.5 28Z" {...p} />;
    case 'part':
      return <Path d="M19.5 29c-1.5-10 4.5-16 12.5-16 8 0 14 5 12.5 15-4-1-8-4-10-8-3 5-9 8-15 9Z" {...p} />;
    case 'long':
    case 'bob':
      return <Path d="M19.5 30c-1-10 5-17 12.5-17s13.5 7 12.5 17c-5-2-9-6-11-10-2 5-8 9-14 10Z" {...p} />;
    case 'bun':
      return <Path d="M19.5 28c-1-9 5-14 12.5-14s13.5 5 12.5 14c-3-4-7-6-12.5-6S22.5 24 19.5 28Z" {...p} />;
    case 'curls':
      return (
        <G {...p}>
          <Circle cx={24} cy={18} r={6} />
          <Circle cx={32} cy={15} r={6.5} />
          <Circle cx={40} cy={18} r={6} />
          <Circle cx={20} cy={24} r={4.5} />
          <Circle cx={44} cy={24} r={4.5} />
        </G>
      );
    case 'buzz':
      return <Path d="M20 26c0-7 5-12 12-12s12 5 12 12c-3-2-7-3-12-3s-9 1-12 3Z" {...p} />;
  }
}

function Top({ t }: { t: AvatarTraits }) {
  const dark = shade(t.top, 0.78);
  return (
    <G>
      <Path d="M8 66c0-12 10-19 24-19s24 7 24 19" fill={t.top} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      {t.collar === 'scrubs' && <Path d="M26 48l6 8 6-8" fill="none" stroke={dark} strokeWidth={SW + 0.5} strokeLinecap="round" strokeLinejoin="round" />}
      {t.collar === 'collar' && (
        <G fill={color.white} stroke={INK} strokeWidth={1.6} strokeLinejoin="round">
          <Path d="M24.5 48l7.5 6-4 4-5-6Z" />
          <Path d="M39.5 48l-7.5 6 4 4 5-6Z" />
        </G>
      )}
      {t.collar === 'lanyard' && (
        <G>
          <Path d="M25 48l7 11 7-11" fill="none" stroke={color.gold} strokeWidth={2.4} strokeLinecap="round" />
          <Rect x={28.5} y={58} width={7} height={6} rx={1.5} fill={color.white} stroke={INK} strokeWidth={1.4} />
        </G>
      )}
    </G>
  );
}

export interface AvatarProps {
  seed: string;
  size?: number;
  /** Ring in a brand colour, e.g. for the speaking persona. */
  ring?: string;
  accessibilityLabel?: string;
}

export const Avatar = memo(function Avatar({ seed, size = 48, ring, accessibilityLabel }: AvatarProps) {
  const t = traitsFor(seed);
  const skinShade = shade(t.skin, 0.86);
  const clipId = `av-${hash(seed).toString(36)}`;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={32} cy={32} r={31} />
          </ClipPath>
        </Defs>
        <Circle cx={32} cy={32} r={31} fill={t.backdrop} />
        <G clipPath={`url(#${clipId})`}>
          <HairBack t={t} />
          <Rect x={27} y={39} width={10} height={11} rx={3} fill={skinShade} stroke={INK} strokeWidth={SW} />
          <Top t={t} />
          {/* ears */}
          <Ellipse cx={19.6} cy={31} rx={2.6} ry={3.4} fill={t.skin} stroke={INK} strokeWidth={SW} />
          <Ellipse cx={44.4} cy={31} rx={2.6} ry={3.4} fill={t.skin} stroke={INK} strokeWidth={SW} />
          {t.earrings && (
            <G fill={color.gold} stroke={INK} strokeWidth={1}>
              <Circle cx={19.4} cy={36} r={1.6} />
              <Circle cx={44.6} cy={36} r={1.6} />
            </G>
          )}
          <Ellipse cx={32} cy={29.5} rx={12.5} ry={14} fill={t.skin} stroke={INK} strokeWidth={SW} />
          <HairFront t={t} />
          {/* face */}
          <Circle cx={27.3} cy={31} r={1.7} fill={INK} />
          <Circle cx={36.7} cy={31} r={1.7} fill={INK} />
          <Ellipse cx={25} cy={35.4} rx={2.1} ry={1.3} fill="#F29A84" opacity={0.45} />
          <Ellipse cx={39} cy={35.4} rx={2.1} ry={1.3} fill="#F29A84" opacity={0.45} />
          <Path d="M28.6 36.6c1.9 1.8 4.9 1.8 6.8 0" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
          {t.glasses && (
            <G fill="none" stroke={INK} strokeWidth={1.5}>
              <Circle cx={27.3} cy={31} r={3.9} />
              <Circle cx={36.7} cy={31} r={3.9} />
              <Path d="M31.2 31h1.6" />
            </G>
          )}
        </G>
        {ring ? <Circle cx={32} cy={32} r={30.5} fill="none" stroke={ring} strokeWidth={2.5} /> : null}
      </Svg>
    </View>
  );
});
