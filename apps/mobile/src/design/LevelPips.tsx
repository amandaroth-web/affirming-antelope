import { StyleSheet, View } from 'react-native';
import { getSkillLevel, type SkillLevelNumber } from '@antelope/core';
import { STAGGER } from '@/motion/constants';
import { Pip } from './Pip';
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
      accessibilityLabel={state === 'locked' ? 'Locked' : `Level ${level} of 6, ${name}`}
    >
      {Array.from({ length: 6 }, (_, i) => {
        const n = i + 1;
        const fill = state === 'locked' ? 0 : n < level ? 1 : n === level ? percent / 100 : 0;
        return (
          <Pip key={i} fill={fill} tint={tint} width={pipWidth} height={height} delay={delay + i * STAGGER} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
