import type { Drill } from '@antelope/core';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CheckIcon, PressableSurface, Text, color, radius, space } from '@/design';
import { Enter, FADE_MS, spring, useReduceMotion } from '@/motion';

type Choice = NonNullable<Drill['choices']>[number];

/**
 * Level-1 drills: tappable answer tiles, evaluated locally. Select (soft face,
 * cobalt edge, letter badge fills), then reveal: the tile the drill asked for
 * turns ochre with a check that pops, the others settle, and every tile opens
 * its explanation on a stagger. Nothing is marked "wrong".
 */
export function ChoiceTiles({
  choices,
  selected,
  revealed,
  multi,
  onSelect,
}: {
  choices: Choice[];
  selected: number[];
  revealed: boolean;
  /** More than one tile is what the drill asks for: tiles toggle. */
  multi?: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={styles.list} accessibilityRole={multi ? 'list' : 'radiogroup'}>
      {choices.map((c, i) => (
        <Enter key={i} index={i} delay={420}>
          <Tile
            choice={c}
            i={i}
            multi={!!multi}
            selected={selected.includes(i)}
            revealed={revealed}
            order={revealOrder(i, selected, choices)}
            onPress={() => onSelect(i)}
          />
        </Enter>
      ))}
    </View>
  );
}

/** The learner's picks resolve first, then the targets, then the rest. */
function revealOrder(i: number, selected: number[], choices: Choice[]) {
  if (selected.includes(i)) return selected.indexOf(i) * 0.5;
  if (choices[i].isTarget) return 1;
  return 2 + i;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function Tile({
  choice,
  i,
  multi,
  selected,
  revealed,
  order,
  onPress,
}: {
  choice: Choice;
  i: number;
  multi: boolean;
  selected: boolean;
  revealed: boolean;
  order: number;
  onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  const dim = useSharedValue(1);
  const target = revealed && choice.isTarget;
  const quiet = revealed && !choice.isTarget && !selected;

  useEffect(() => {
    if (reduce) return;
    if (selected && !revealed) pop.value = withSequence(withSpring(1.18, spring.snappy), withSpring(1, spring.bouncy));
    if (target) pop.value = withDelay(order * 90, withSequence(withSpring(1.35, spring.snappy), withSpring(1, spring.bouncy)));
  }, [selected, revealed, target, order, reduce, pop]);

  useEffect(() => {
    dim.value = withTiming(quiet ? 0.78 : 1, { duration: reduce ? FADE_MS : 260 });
  }, [quiet, reduce, dim]);

  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: dim.value }));

  const face = target ? color.goldTint : selected ? color.soft : color.white;
  const edge = target ? color.gold : selected ? color.primary : color.line;
  const shadow = target ? color.goldShadow : selected ? color.primary : color.shadow;
  const badgeBg = target ? color.gold : selected ? color.primary : color.white;
  const badgeInk = target || selected ? color.white : color.muted;

  return (
    <Animated.View style={fade}>
      <PressableSurface
        onPress={onPress}
        disabled={revealed}
        haptic={revealed ? false : 'tick'}
        face={face}
        edge={edge}
        shadow={shadow}
        depth={4}
        radius={radius.surface}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={multi ? { checked: selected, disabled: revealed } : { selected, disabled: revealed }}
        accessibilityLabel={`${LETTERS[i]}. ${choice.text}${revealed ? (choice.isTarget ? '. What the drill asked for.' : '') + ' ' + choice.explanation : ''}`}
        contentStyle={styles.face}
      >
        <View style={styles.row}>
          <Animated.View style={[styles.badge, { backgroundColor: badgeBg, borderColor: target ? color.goldShadow : selected ? color.primaryShadow : color.line }, badge]}>
            {target ? (
              <CheckIcon size={16} weight="bold" color={color.white} />
            ) : (
              <Text variant="label" color={badgeInk}>
                {LETTERS[i]}
              </Text>
            )}
          </Animated.View>
          <Text variant="bodyStrong" style={styles.text}>
            {choice.text}
          </Text>
        </View>
        {revealed ? (
          <Enter delay={120 + order * 110} style={styles.explain}>
            {target ? (
              <Text variant="overline" color="#8A5A0B" style={styles.tag}>
                {selected ? 'Your pick · what the drill asked for' : 'What the drill asked for'}
              </Text>
            ) : selected ? (
              <Text variant="overline" color={color.primaryShadow} style={styles.tag}>
                Your pick
              </Text>
            ) : null}
            <Text variant="body" color={color.ink} style={styles.explainText}>
              {choice.explanation}
            </Text>
          </Enter>
        ) : null}
      </PressableSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3] },
  face: { padding: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  explain: { marginTop: space[3], paddingTop: space[3], borderTopWidth: 2, borderTopColor: 'rgba(10,40,78,0.06)' },
  tag: { marginBottom: 4 },
  explainText: { fontSize: 15, lineHeight: 21 },
});
