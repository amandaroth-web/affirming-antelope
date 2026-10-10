import { getSkill, type DemoTodaysPractice } from '@antelope/core';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRightIcon, Button, Chip, Raised, Text, color, radius, space, type as typeScale } from '@/design';
import { launchFrom } from '@/motion/launch';

const KIND: Record<DemoTodaysPractice['kind'], string> = { drill: 'Drill', roleplay: 'Role-play', learn: 'Lesson' };
const DEPTH = 6;

/**
 * The one unmistakable next action: a cobalt card whose only control is START.
 * It's also the hero source for the practice screen: START measures the card,
 * its title and the button, and the drill opens out of them (SessionSurface).
 */
export function TodayHero({ practice, onStart }: { practice: DemoTodaysPractice; onStart: () => void }) {
  const card = useRef<View>(null);
  const title = useRef<View>(null);
  const cta = useRef<View>(null);
  const start = () =>
    launchFrom(
      {
        container: card,
        depth: DEPTH,
        face: color.primary,
        radius: radius.lg,
        title: { ref: title, text: practice.title, style: { ...typeScale.hero, color: color.white } },
        cta: { ref: cta, face: color.white, radius: radius.md, label: 'START', labelStyle: { ...typeScale.button, color: color.primary } },
      },
      onStart,
    );
  return (
    <View ref={card} collapsable={false}>
      <Raised tone="primary" depth={DEPTH} radius={radius.lg} contentStyle={styles.face}>
        <Text variant="overline" color="rgba(255,255,255,0.82)">
          Today’s practice
        </Text>
        <View ref={title} collapsable={false} style={styles.title}>
          <Text variant="hero" color={color.white}>
            {practice.title}
          </Text>
        </View>
        <View style={styles.chips}>
          <Chip tone="onPrimary" label={getSkill(practice.skill).name} />
          <Chip tone="onPrimary" label={KIND[practice.kind]} />
          <Chip tone="onPrimary" label={`~${practice.minutes} min`} />
        </View>
        <Text variant="body" color="rgba(255,255,255,0.9)" style={styles.why}>
          {practice.why}
        </Text>
        <View ref={cta} collapsable={false}>
          <Button
            variant="onPrimary"
            label="Start"
            onPress={start}
            fullWidth
            icon={<ArrowRightIcon size={20} weight="bold" color={color.primary} />}
            accessibilityLabel={`Start ${practice.title}`}
          />
        </View>
      </Raised>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { padding: space[5], paddingTop: space[5] + 2 },
  title: { marginTop: space[2], maxWidth: 300, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  why: { marginTop: space[3], marginBottom: space[5] },
});
