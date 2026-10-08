import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { getSkillLevel, type SkillLevelNumber } from '@antelope/core';
import { STAGGER } from '@/motion/constants';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { color } from './tokens';

export interface LevelPipsProps {
  /** The level being worked on, 1..6. Levels below it are full. */
  level: SkillLevelNumber;
  /** 0..100 through the current level. 100 fills its pip. */
  percent: number;
  /** 'progress' = cobalt (learning); 'complete' = ochre (achieved); 'locked' = empty. */
  state?: 'progress' | 'complete' | 'locked';
  pipWidth?: number;
  height?: number;
  gap?: number;
  delay?: number;
}

/**
 * Six-step skill level: Recognize, Respond, Elicit, Sustain, Integrate, Advanced.
 * Pips fill left to right, 45ms apart, each on a settle spring.
 */
export function LevelPips({
  level,
  percent,
  state = 'progress',
  pipWidth = 14,
  height = 8,
  gap = 4,
  delay = 0,
}: LevelPipsProps) {
  const tint = state === 'complete' ? color.gold : color.primary;
  const name = getSkillLevel(level).name;
  return (
    <View
      style={[styles.row, { gap }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={state === 'locked' ? 'Locked' : `Level ${level} of 6, ${name}, ${percent}% through`}
    >
      {Array.from({ length: 6 }, (_, i) => {
        const n = i + 1;
        const fill = state === 'locked' ? 0 : n < level ? 1 : n === level ? percent / 100 : 0;
        return (
          <Pip
            key={i}
            fill={fill}
            tint={tint}
            width={pipWidth}
            height={height}
            delay={delay + i * STAGGER}
          />
        );
      })}
    </View>
  );
}

function Pip({ fill, tint, width, height, delay }: { fill: number; tint: string; width: number; height: number; delay: number }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = reduce ? withTiming(fill, { duration: 0 }) : withDelay(delay, withSpring(fill, spring.settle));
  }, [fill, reduce, delay, v]);
  const style = useAnimatedStyle(() => ({ width: Math.max(0, v.value) * width }));
  return (
    <View style={[styles.pip, { width, height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { backgroundColor: tint, borderRadius: height / 2 }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pip: { backgroundColor: color.line, overflow: 'hidden' },
  fill: { height: '100%' },
});
