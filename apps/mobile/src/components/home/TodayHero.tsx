import { getSkill, type DemoTodaysPractice } from '@antelope/core';
import { StyleSheet, View } from 'react-native';
import { ArrowRightIcon, Button, Chip, Raised, Text, color, radius, space } from '@/design';

const KIND: Record<DemoTodaysPractice['kind'], string> = { drill: 'Drill', roleplay: 'Role-play', learn: 'Lesson' };

/** The one unmistakable next action: a cobalt card whose only control is START. */
export function TodayHero({ practice, onStart }: { practice: DemoTodaysPractice; onStart: () => void }) {
  return (
    <Raised tone="primary" depth={6} radius={radius.lg} contentStyle={styles.face}>
      <Text variant="overline" color="rgba(255,255,255,0.82)">
        Today’s practice
      </Text>
      <Text variant="hero" color={color.white} style={styles.title}>
        {practice.title}
      </Text>
      <View style={styles.chips}>
        <Chip tone="onPrimary" label={getSkill(practice.skill).name} />
        <Chip tone="onPrimary" label={KIND[practice.kind]} />
        <Chip tone="onPrimary" label={`~${practice.minutes} min`} />
      </View>
      <Text variant="body" color="rgba(255,255,255,0.9)" style={styles.why}>
        {practice.why}
      </Text>
      <Button
        variant="onPrimary"
        label="Start"
        onPress={onStart}
        fullWidth
        icon={<ArrowRightIcon size={20} weight="bold" color={color.primary} />}
        accessibilityLabel={`Start ${practice.title}`}
      />
    </Raised>
  );
}

const styles = StyleSheet.create({
  face: { padding: space[5], paddingTop: space[5] + 2 },
  title: { marginTop: space[2], maxWidth: 300 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  why: { marginTop: space[3], marginBottom: space[5] },
});
