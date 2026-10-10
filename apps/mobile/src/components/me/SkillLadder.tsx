import { SKILL_LEVELS, skillLevelQuestion, type DemoSkillProgress, type Skill } from '@antelope/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CaretDownIcon, CheckIcon, LevelPips, Text, color, haptic, space } from '@/design';
import { Enter, spring } from '@/motion';

/** One skill: its current level question, expanding to the full six-rung ladder. */
export function SkillLadder({ skill, progress, last }: { skill: Skill; progress: DemoSkillProgress; last: boolean }) {
  const [open, setOpen] = useState(false);
  const rot = useSharedValue(0);
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));
  const fresh = progress.status === 'locked';
  const level = SKILL_LEVELS[progress.level - 1];

  return (
    <View style={[styles.wrap, !last && styles.rule]}>
      <Pressable
        onPress={() => {
          haptic.tick();
          rot.value = withSpring(open ? 0 : 1, spring.snappy);
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${skill.name}. ${fresh ? 'Not started' : `Level ${progress.level}, ${level.name}`}`}
        accessibilityHint="Shows all six levels"
        style={styles.head}
      >
        <View style={styles.headCopy}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" style={styles.name}>
              {skill.name}
            </Text>
            <LevelPips
              level={progress.level}
              percent={progress.percent}
              state={fresh ? 'locked' : progress.status === 'complete' ? 'complete' : 'progress'}
              pipWidth={10}
              height={6}
              gap={3}
            />
          </View>
          <Text variant="caption" color={color.muted} numberOfLines={open ? undefined : 2}>
            {fresh ? 'Not started yet' : `Level ${progress.level} — ${level.name}: ${skillLevelQuestion(skill.id, progress.level)}`}
          </Text>
        </View>
        <Animated.View style={caret}>
          <CaretDownIcon size={18} weight="bold" color={color.faint} />
        </Animated.View>
      </Pressable>

      {open && (
        <View style={styles.ladder}>
          {SKILL_LEVELS.map((l, i) => {
            const done = !fresh && (l.level < progress.level || (l.level === progress.level && progress.percent >= 100));
            const now = !fresh && l.level === progress.level && !done;
            return (
              <Enter key={l.level} index={i} style={styles.rung}>
                <View style={styles.rail}>
                  <View style={[styles.dot, done && styles.dotDone, now && styles.dotNow]}>
                    {done ? (
                      <CheckIcon size={12} weight="bold" color={color.navy} />
                    ) : (
                      <Text variant="caption" color={now ? color.white : color.muted} style={styles.dotNum} maxScale={1}>
                        {l.level}
                      </Text>
                    )}
                  </View>
                  {i < 5 && <View style={[styles.line, done && styles.lineDone]} />}
                </View>
                <View style={styles.rungCopy}>
                  <Text variant="label" color={now ? color.primaryShadow : done ? color.ink : color.muted}>
                    {l.name}
                    {now ? "  ·  You're here" : ''}
                  </Text>
                  <Text variant="caption" color={now ? color.ink : color.muted}>
                    {skillLevelQuestion(skill.id, l.level)}
                  </Text>
                </View>
              </Enter>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space[1] },
  rule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], minHeight: 56 },
  headCopy: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  name: { flexShrink: 1 },
  ladder: { paddingBottom: space[3], paddingLeft: 2 },
  rung: { flexDirection: 'row', gap: space[3] },
  rail: { alignItems: 'center', width: 24 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.line,
    backgroundColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: color.gold, borderColor: color.goldShadow },
  dotNow: { backgroundColor: color.primary, borderColor: color.primaryShadow },
  dotNum: { fontFamily: 'Nunito_900Black', fontSize: 11, lineHeight: 13 },
  line: { flex: 1, width: 2, backgroundColor: color.line, marginVertical: 2, minHeight: 14 },
  lineDone: { backgroundColor: color.gold },
  rungCopy: { flex: 1, paddingBottom: space[3] },
});
