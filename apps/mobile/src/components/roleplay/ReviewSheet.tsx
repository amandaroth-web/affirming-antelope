import { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Avatar, BottomSheet, Button, CheckIcon, LockSimpleIcon, Text, border, color, font, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { useKeyboardHeight } from '@/components/practice-loop/useKeyboardHeight';

/**
 * Opt-in trainer review for this one session. Says exactly what's shared and
 * what isn't, takes an optional note, then confirms with a check pop.
 */
export function ReviewSheet({
  open,
  onClose,
  trainer,
  turnCount,
  feeling,
  sent,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  trainer: { name: string; role: string };
  turnCount: number;
  feeling: string;
  sent: boolean;
  onSend: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const kb = useKeyboardHeight();
  const first = trainer.name.replace(/^Dr\.\s*/, '').split(' ')[0];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight={0.94} accessibilityLabel="Submit for trainer review">
      {sent ? (
        <Sent trainer={trainer} onDone={onClose} />
      ) : (
        <View>
          <View style={styles.head}>
            <Avatar seed="rosa-lin-trainer" size={48} accessibilityLabel={trainer.name} />
            <View style={styles.flex}>
              <Text variant="heading" accessibilityRole="header">
                Share this session with {trainer.name}?
              </Text>
            </View>
          </View>
          <Text variant="body" color={color.muted} style={styles.lede}>
            Only this conversation. {first} will review it before your next group session.
          </Text>

          {/* while typing the note the keyboard needs the room; the list was just read */}
          <View style={[styles.list, kb > 0 && styles.hidden]}>
            <Text variant="overline" color={color.primaryShadow}>
              What’s shared
            </Text>
            <Row text={`The full transcript (${turnCount} turns)`} />
            <Row text="The coach feedback you just read" />
            <Row text={`Your reflection (“${feeling}”) and anything you wrote`} />
            <View style={styles.notShared}>
              <LockSimpleIcon size={16} weight="bold" color={color.muted} />
              <Text variant="caption" color={color.muted} style={styles.flex}>
                Not shared: your other practice, streak, or skill levels.
              </Text>
            </View>
          </View>

          <Text variant="label" style={styles.noteLabel}>
            Note to {first} (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={`e.g. “I got stuck after he mentioned the template.”`}
            placeholderTextColor={color.faint}
            multiline
            maxFontSizeMultiplier={1.4}
            style={styles.note}
            accessibilityLabel={`Note to ${trainer.name}, optional`}
          />

          <View style={styles.actions}>
            <Button
              label="Send for review"
              fullWidth
              onPress={() => {
                onSend(note.trim());
                haptic.success();
              }}
            />
            {kb > 0 ? null : <Button variant="secondary" label="Not now" fullWidth onPress={onClose} />}
          </View>
          <View style={{ height: kb }} />
        </View>
      )}
    </BottomSheet>
  );
}

function Row({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.tick}>
        <CheckIcon size={12} weight="bold" color={color.white} />
      </View>
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

function Sent({ trainer, onDone }: { trainer: { name: string }; onDone: () => void }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSequence(withSpring(1.2, spring.snappy), withSpring(1, spring.bouncy));
  }, [reduce, s]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: Math.min(1, s.value * 2) }));
  return (
    <View style={styles.sent} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.sentBadge, pop]}>
        <CheckIcon size={34} weight="bold" color={color.white} />
      </Animated.View>
      <Text variant="title" align="center">
        Sent to {trainer.name}
      </Text>
      <Text variant="body" color={color.muted} align="center">
        You’ll see her notes here once she’s reviewed it.
      </Text>
      <Button label="Done" fullWidth onPress={onDone} style={styles.sentBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  lede: { marginTop: space[3] },
  list: { marginTop: space[5], gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  notShared: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingLeft: 3 },
  noteLabel: { marginTop: space[5], marginBottom: space[2] },
  note: {
    minHeight: 72,
    maxHeight: 120,
    borderWidth: border,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : null),
  },
  actions: { marginTop: space[5], gap: space[3] },
  sent: { alignItems: 'center', gap: space[3], paddingTop: space[2] },
  sentBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.gold,
    borderBottomWidth: 5,
    borderBottomColor: color.goldShadow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  sentBtn: { marginTop: space[4] },
});
