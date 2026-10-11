import type { PathwayId } from '@antelope/core';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { TrackCard } from '@/components/track/TrackCard';
import { Dock } from '@/components/practice-loop/SessionChrome';
import {
  Button,
  CaretLeftIcon,
  ChatsCircleIcon,
  IconButton,
  LightningIcon,
  SealCheckIcon,
  Text,
  color,
  haptic,
  layout,
  radius,
  space,
} from '@/design';
import { PATHWAY_IDS } from '@/data/pathways';
import { track } from '@/lib/analytics';
import { onFlowClosed } from '@/lib/flowEvents';
import { supabaseConfigured } from '@/lib/supabase';
import { launchPathwayHint } from '@/lib/launchHint';
import { Enter, useForwardSwap } from '@/motion';
import { useAccount } from '@/state/account';
import { useLearner } from '@/state/store';

/**
 * First launch: two steps.
 *
 *   intro  what the app does; try it as a guest (everything works on the device) or sign in.
 *   track  "What conversations do you want to practice?": Patients (MI for Clinicians) or
 *          Your team (MI for Leaders). Never skipped; a website CTA's `src` (or a guide's
 *          deep-linked drill) only preselects. CONTINUE picks the track and hands over to Home.
 *
 * Existing installs that still need a track (an untouched demo seed reset to fresh) start
 * at the track step, as does anyone already signed in. Sign-in returns here, and the
 * account's own track is preselected.
 *
 * Choreography: the antelope pops in and waves; the headline, the three lines and the
 * actions rise in on the 45ms stagger. Intro → track is a forward swap. On the track step
 * the head-pose coach listens, hops at the first pick and nods at a change of mind.
 * Reduced motion: fades, no wave or hop.
 */
export default function Welcome() {
  const already = useAccount((s) => s.onboarded === true || s.status === 'signed-in');
  const [step, setStep] = useState<'intro' | 'track'>(already ? 'track' : 'intro');
  const [fromIntro, setFromIntro] = useState(false);
  const swap = useForwardSwap();

  // back from sign-in, signed in: on to the track
  useEffect(
    () =>
      onFlowClosed((flow) => {
        if (flow === 'sign-in' && useAccount.getState().status === 'signed-in') {
          setFromIntro(false);
          setStep('track');
        }
      }),
    [],
  );

  return (
    <View style={styles.root}>
      {step === 'intro' ? (
        <Animated.View key="intro" style={styles.root} exiting={swap.exiting}>
          <Intro
            onTry={() => {
              track('onboarding_chosen', { choice: 'guest' });
              setFromIntro(true);
              setStep('track');
            }}
          />
        </Animated.View>
      ) : (
        <Animated.View key="track" style={styles.root} entering={fromIntro ? swap.entering : undefined}>
          <TrackStep onBack={fromIntro ? () => setStep('intro') : undefined} />
        </Animated.View>
      )}
    </View>
  );
}

function Intro({ onTry }: { onTry: () => void }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tryIt = onTry;

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
          <Button
            label={supabaseConfigured ? 'Try it first' : 'Get started'}
            fullWidth
            onPress={tryIt}
            accessibilityHint={supabaseConfigured ? 'Practice as a guest. You can sign in later from Me.' : undefined}
          />
          {supabaseConfigured ? (
            <>
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
            </>
          ) : null}
        </Dock>
      </Enter>
    </View>
  );
}

/**
 * The track step. Two big radio cards; the first pick makes the coach hop, a change of
 * mind gets a nod. CONTINUE is disabled until a track is picked (a hint preselects one).
 */
function TrackStep({ onBack }: { onBack?: () => void }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const coach = useRef<MascotHandle>(null);
  const picked = useRef(false);
  const [choice, setChoice] = useState<PathwayId | null>(() => {
    const s = useLearner.getState();
    // signed in to an account that already picked one
    return s.pathwayChosenAt ? s.activePathwayId : null;
  });

  useEffect(() => {
    let live = true;
    void launchPathwayHint.then((hint) => {
      if (live && hint) setChoice((c) => c ?? hint);
    });
    return () => {
      live = false;
    };
  }, []);

  const select = (id: PathwayId) => {
    if (id === choice) return;
    setChoice(id);
    if (!picked.current) coach.current?.hop();
    else coach.current?.nod();
    picked.current = true;
  };

  const go = () => {
    if (!choice) return;
    haptic.success();
    useLearner.getState().choosePathway(choice, 'onboarding');
    useAccount.getState().set({ onboarded: true });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space[3] }]} bounces={false}>
        <View style={styles.column}>
          {onBack ? (
            <View style={styles.trackTop}>
              <IconButton onPress={onBack} label="Back" icon={<CaretLeftIcon size={26} weight="bold" color={color.muted} />} />
            </View>
          ) : null}
          <Enter from="scale" style={styles.coachRow}>
            <Mascot
              ref={coach}
              pose="head"
              mood={choice ? 'idle' : 'listening'}
              size={84}
              paused={!focused}
              accessibilityLabel="The antelope coach"
            />
          </Enter>
          <Enter index={1}>
            <Text variant="overline" color={color.primaryShadow}>
              Your track
            </Text>
            <Text variant="title" accessibilityRole="header" style={styles.title}>
              What conversations do you want to practice?
            </Text>
          </Enter>
          <View accessibilityRole="radiogroup" style={styles.cards}>
            {PATHWAY_IDS.map((id, i) => (
              <Enter key={id} index={2 + i}>
                <TrackCard id={id} selected={choice === id} onSelect={select} />
              </Enter>
            ))}
          </View>
        </View>
      </ScrollView>

      <Enter index={4}>
        <Dock rule={false}>
          <Button label="Continue" fullWidth disabled={!choice} onPress={go} accessibilityHint="Starts your first week on this track." />
          <Text variant="caption" color={color.muted} align="center" style={styles.foot}>
            You can switch tracks any time in Me. Progress on each one is kept.
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
  ground: {
    position: 'absolute',
    left: -layout.gutter,
    right: -layout.gutter,
    bottom: 0,
    height: 96,
    overflow: 'hidden',
  },
  hill: {
    position: 'absolute',
    left: -250,
    width: 760,
    height: 760,
    borderRadius: 380,
    top: 26,
    backgroundColor: color.soft,
  },
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
  trackTop: {
    height: 44,
    marginLeft: -space[3],
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  coachRow: { alignItems: 'flex-start', marginBottom: space[3] },
  cards: { marginTop: space[6], gap: space[4] },
  second: { marginTop: space[3] },
  foot: { marginTop: space[3] },
});
