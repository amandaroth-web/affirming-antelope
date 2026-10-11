import { router, useIsFocused } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from '@/components/mascot';
import { Dock } from '@/components/practice-loop/SessionChrome';
import { Button, ChatsCircleIcon, LightningIcon, SealCheckIcon, Text, color, layout, radius, space } from '@/design';
import { track } from '@/lib/analytics';
import { Enter } from '@/motion';
import { useAccount } from '@/state/account';

/**
 * First launch only. Two ways in: try it as a guest (everything works on the
 * device, exactly as before accounts), or sign in. Existing guest installs never
 * see this (see sync/engine.ts › decideOnboarding).
 *
 * Choreography: the antelope pops in and waves; the headline, the three lines and
 * the actions rise in on the 45ms stagger. Reduced motion: fades, no wave.
 */
export default function Welcome() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tryIt = () => {
    track('onboarding_chosen', { choice: 'guest' });
    useAccount.getState().set({ onboarded: true });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space[6] }]} bounces={false}>
        <View style={styles.column}>
          <Enter from="scale" style={styles.stage}>
            <View style={styles.ground} pointerEvents="none">
              <View style={styles.hill} />
            </View>
            <Mascot pose="wave" size={164} greet paused={!focused} accessibilityLabel="The antelope coach, waving hello" style={styles.mascot} />
          </Enter>

          <Enter index={2}>
            <Text variant="overline" color={color.primaryShadow}>
              Affirming Antelope
            </Text>
            <Text variant="hero" accessibilityRole="header" style={styles.title}>
              Practice the conversations that matter.
            </Text>
            <Text variant="body" color={color.muted} style={styles.lede}>
              Motivational Interviewing for leaders and clinicians. A few minutes a day, with a coach in your corner.
            </Text>
          </Enter>

          <View style={styles.points}>
            <Point
              index={3}
              icon={<LightningIcon size={20} weight="fill" color={color.primary} />}
              title="Five-minute drills"
              detail="One skill at a time, most days."
            />
            <Point
              index={4}
              icon={<ChatsCircleIcon size={20} weight="fill" color={color.primary} />}
              title="Role-plays that push back"
              detail="Real ambivalence, not a script."
            />
            <Point
              index={5}
              icon={<SealCheckIcon size={20} weight="fill" color={color.primary} />}
              title="Feedback from your trainer"
              detail="Share a session when you choose to."
            />
          </View>
        </View>
      </ScrollView>

      <Enter index={6}>
        <Dock rule={false}>
          <Button label="Try it first" fullWidth onPress={tryIt} accessibilityHint="Practice as a guest. You can sign in later from Me." />
          <Button
            variant="secondary"
            label="Sign in"
            fullWidth
            onPress={() => {
              track('onboarding_chosen', { choice: 'sign_in' });
              router.push({
                pathname: '/sign-in',
                params: { reason: 'welcome' },
              });
            }}
            style={styles.second}
          />
          <Text variant="caption" color={color.muted} align="center" style={styles.foot}>
            Have a join code from your trainer? Sign in, then enter it.
          </Text>
        </Dock>
      </Enter>
    </View>
  );
}

function Point({ index, icon, title, detail }: { index: number; icon: ReactNode; title: string; detail: string }) {
  return (
    <Enter index={index} style={styles.point}>
      <View style={styles.pointIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color={color.muted}>
          {detail}
        </Text>
      </View>
    </Enter>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  scroll: { paddingHorizontal: layout.gutter, paddingBottom: space[6] },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  stage: { height: 184, justifyContent: 'flex-end', marginBottom: space[4] },
  // a soft rise of ground for the antelope to stand on: the top of a very wide circle
  ground: { position: 'absolute', left: -layout.gutter, right: -layout.gutter, bottom: 0, height: 96, overflow: 'hidden' },
  hill: { position: 'absolute', left: -250, width: 760, height: 760, borderRadius: 380, top: 26, backgroundColor: color.soft },
  mascot: { marginLeft: space[5], marginBottom: space[4] },
  title: { marginTop: space[2] },
  lede: { marginTop: space[3] },
  points: { marginTop: space[5], gap: space[3] },
  point: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.badge,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  second: { marginTop: space[3] },
  foot: { marginTop: space[3] },
});
