import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CodeInput, type CodeInputHandle, type CodeState } from '@/components/account/CodeInput';
import { FlowHeader, Notice, TextField, flowStyles } from '@/components/account/FlowChrome';
import { Mascot, type MascotHandle, type MascotMood } from '@/components/mascot';
import { Button, Text, TextLink, color, space } from '@/design';
import { emitFlowClosed } from '@/lib/flowEvents';
import { isLocalSupabase, supabase } from '@/lib/supabase';
import { Enter, useFades, useForwardSwap } from '@/motion';
import { renameSelf } from '@/sync/cloud';
import { EMAIL_RE, sendCode, verifyCode, type AuthFailure } from '@/sync/auth';
import { useAccount } from '@/state/account';

/**
 * Sign in or create an account: email → 6-digit code → (new accounts) your name.
 * Presented as a sheet over wherever the learner asked for it. `reason` tunes the
 * first line to what signing in unlocks and decides where the flow lands:
 *   welcome  first launch; finishing leaves the welcome for Home
 *   cohort   then straight on to Join cohort
 *   review   back to the debrief, where the review sheet carries on
 *   me       back to Me
 */
type Reason = 'welcome' | 'cohort' | 'review' | 'me';
type Step = 'email' | 'code' | 'name';

const LEDE: Record<Reason, string> = {
  welcome: 'Your progress follows you, and your trainer can see what you share.',
  cohort: 'Sign in to join your cohort and see what your trainer assigned.',
  review: 'Sign in to send this role-play to your trainer.',
  me: 'Your progress follows you, and your trainer can see what you share.',
};

const RESEND_S = 30;

const AUTH_COPY: Record<AuthFailure, string> = {
  offline: 'You might be offline. Check your connection, then try again.',
  'rate-limited': 'That’s a lot of codes in a row. Give it a minute, then send another.',
  // Supabase answers a wrong code and an old one the same way, so the copy covers both
  invalid: 'That code didn’t work. Check the newest email from us, or send a new code.',
  expired: 'That code didn’t work. Check the newest email from us, or send a new code.',
  error: 'Something went wrong on our side. Try again in a moment.',
};

export default function SignIn() {
  const params = useLocalSearchParams<{ reason?: Reason }>();
  const reason: Reason = params.reason ?? 'me';
  const focused = useIsFocused();
  const swap = useForwardSwap();
  const fades = useFades(180, 120);
  const [step, setStep] = useState<Step>('email');
  const [back, setBack] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState<CodeState>('idle');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [mood, setMood] = useState<MascotMood>('idle');
  const coach = useRef<MascotHandle>(null);
  const codeRef = useRef<CodeInputHandle>(null);
  const nameRef = useRef<TextInput>(null);
  // whoever handed off to this flow (the review sheet) picks up again once it's gone
  useEffect(() => () => emitFlowClosed('sign-in'), []);

  // resend countdown: a label, ticked once a second while the code step is up
  useEffect(() => {
    if (step !== 'code') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);
  const wait = Math.max(0, RESEND_S - Math.floor((now - sentAt) / 1000));

  const go = (next: Step, reverse = false) => {
    setBack(reverse);
    setStep(next);
  };

  // Opened directly (e.g. a web reload on /sign-in) there's nothing to go back to.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const finish = () => {
    if (reason === 'cohort' && useAccount.getState().cohorts.length === 0) {
      router.replace('/join');
      return;
    }
    close();
    // first launch: once the sheet is down, the welcome hands over to Home
    if (reason === 'welcome') setTimeout(() => useAccount.getState().set({ onboarded: true }), 360);
  };

  const submitEmail = async () => {
    const e = email.trim();
    if (!EMAIL_RE.test(e)) {
      setEmailError('That doesn’t look like an email address yet.');
      return;
    }
    setSending(true);
    setEmailError(null);
    setMood('thinking');
    const res = await sendCode(e);
    setSending(false);
    setMood('idle');
    if (!res.ok) {
      setEmailError(AUTH_COPY[res.reason === 'invalid' ? 'error' : res.reason]);
      return;
    }
    setSentAt(Date.now());
    setNow(Date.now());
    setCode('');
    setCodeState('idle');
    setCodeError(null);
    go('code');
  };

  const resend = async () => {
    setCodeError(null);
    setCodeState('idle');
    setCode('');
    const res = await sendCode(email);
    if (!res.ok) {
      setCodeError(AUTH_COPY[res.reason === 'invalid' ? 'error' : res.reason]);
      return;
    }
    setSentAt(Date.now());
    setNow(Date.now());
    codeRef.current?.focus();
  };

  const submitCode = async (token: string) => {
    setCodeState('busy');
    setCodeError(null);
    setMood('thinking');
    const res = await verifyCode(email, token);
    if (!res.ok) {
      setMood('idle');
      setCodeState('error');
      setCodeError(AUTH_COPY[res.reason]);
      return;
    }
    setCodeState('success');
    setMood('cheer');
    coach.current?.hop();
    // new accounts keep a default name until the learner picks one (profiles.display_name_set)
    const { data } = await supabase.from('profiles').select('display_name_set').eq('id', res.userId).single();
    const needsName = data?.display_name_set === false;
    setTimeout(() => {
      setMood('idle');
      if (needsName) go('name');
      else finish();
    }, 900);
  };

  const saveName = async () => {
    const n = name.trim();
    if (!n) {
      setNameError('Add the name you’d like your trainer to see.');
      return;
    }
    setSaving(true);
    setNameError(null);
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const ok = uid ? await renameSelf(uid, n) : false;
    setSaving(false);
    if (!ok) {
      setNameError('That didn’t save. Check your connection and try again.');
      return;
    }
    coach.current?.nod();
    setTimeout(finish, 300);
  };

  const transition = back ? fades : swap;
  const editCodeChange = (v: string) => {
    setCode(v);
    if (codeState === 'error') {
      setCodeState('idle');
      setCodeError(null);
    }
  };

  return (
    <View style={flowStyles.root}>
      <FlowHeader
        onClose={step === 'code' ? undefined : close}
        onBack={step === 'code' ? () => go('email', true) : undefined}
        center={<Steps step={step} />}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} bounces={false}>
        <View style={flowStyles.body}>
          <Enter style={styles.coachRow}>
            <Mascot ref={coach} pose="head" mood={mood} size={76} paused={!focused} accessibilityLabel="The antelope coach" />
          </Enter>

          {step === 'email' ? (
            <Animated.View key="email" entering={transition.entering} exiting={undefined}>
              <Enter index={1}>
                <Text variant="title" accessibilityRole="header">
                  Sign in or create an account
                </Text>
                <Text variant="body" color={color.muted} style={styles.lede}>
                  {LEDE[reason]} We’ll email you a 6-digit code. No password.
                </Text>
              </Enter>
              <Enter index={2}>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (emailError) setEmailError(null);
                  }}
                  onFocus={() => setMood('listening')}
                  onBlur={() => setMood('idle')}
                  placeholder="you@yourwork.org"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="send"
                  onSubmitEditing={submitEmail}
                  invalid={!!emailError}
                  style={styles.field}
                />
                <Notice text={emailError} />
              </Enter>
              <Enter index={3} style={styles.actions}>
                <Button label={sending ? 'Sending…' : 'Send code'} fullWidth disabled={sending || !email.trim()} onPress={submitEmail} />
              </Enter>
            </Animated.View>
          ) : null}

          {step === 'code' ? (
            <Animated.View key="code" entering={transition.entering}>
              <Text variant="title" accessibilityRole="header">
                Check your email
              </Text>
              <Text variant="body" color={color.muted} style={styles.lede}>
                Enter the 6-digit code we sent to{' '}
                <Text variant="bodyStrong" color={color.ink}>
                  {email.trim()}
                </Text>
                .
              </Text>
              <CodeInput
                ref={codeRef}
                length={6}
                value={code}
                onChange={editCodeChange}
                onComplete={submitCode}
                state={codeState}
                autoFocus
                accessibilityLabel="6-digit code"
                style={styles.code}
              />
              <Notice text={codeError} />
              <View style={styles.resend}>
                {wait > 0 ? (
                  <Text variant="caption" color={color.muted} accessibilityLiveRegion="none">
                    Didn’t get it? Send a new code in 0:
                    {String(wait).padStart(2, '0')}
                  </Text>
                ) : (
                  <TextLink label="Send a new code" onPress={resend} />
                )}
                <TextLink label="Use a different email" onPress={() => go('email', true)} />
              </View>
              {isLocalSupabase ? (
                <Text variant="caption" color={color.muted} style={styles.dev}>
                  Local dev: codes land in Mailpit, http://127.0.0.1:54324
                </Text>
              ) : null}
            </Animated.View>
          ) : null}

          {step === 'name' ? (
            <Animated.View key="name" entering={transition.entering}>
              <Text variant="title" accessibilityRole="header">
                What should we call you?
              </Text>
              <Text variant="body" color={color.muted} style={styles.lede}>
                Your trainer sees this name next to anything you share.
              </Text>
              <TextField
                ref={nameRef}
                label="Your name"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (nameError) setNameError(null);
                }}
                placeholder="e.g. Amanda Reyes"
                textContentType="name"
                autoComplete="name"
                autoCapitalize="words"
                autoFocus
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={saveName}
                invalid={!!nameError}
                style={styles.field}
              />
              <Notice text={nameError} />
              <View style={styles.actions}>
                <Button label={saving ? 'Saving…' : 'Save'} fullWidth disabled={saving || !name.trim()} onPress={saveName} />
                <TextLink label="Skip for now" onPress={finish} style={styles.skip} />
              </View>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Three short bars: where you are in the flow. The current one is cobalt and longer. */
function Steps({ step }: { step: Step }) {
  const i = step === 'email' ? 0 : step === 'code' ? 1 : 2;
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${i + 1} of 3`} accessible>
      {[0, 1, 2].map((k) => (
        <Animated.View key={k} style={[styles.stepBar, k === i && styles.stepOn, k < i && styles.stepDone]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space[10] },
  coachRow: {
    alignItems: 'flex-start',
    marginTop: space[2],
    marginBottom: space[3],
  },
  lede: { marginTop: space[2] },
  field: { marginTop: space[6] },
  code: { marginTop: space[6] },
  actions: { marginTop: space[6], gap: space[2] },
  skip: { alignSelf: 'center' },
  resend: {
    marginTop: space[5],
    gap: space[1],
    alignItems: 'flex-start',
    minHeight: 44,
  },
  dev: { marginTop: space[4] },
  steps: { flexDirection: 'row', gap: 6 },
  stepBar: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.softDeep,
  },
  stepOn: { width: 28, backgroundColor: color.primary },
  stepDone: { backgroundColor: color.primaryTint },
});
