import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useLearner } from '@/state/store';

const enabled = () => Platform.OS !== 'web' && useLearner.getState().settings.haptics;
const safe = (p: Promise<void>) => p.catch(() => {});

/**
 * Haptics paired with visual peaks. Call at the moment the motion lands
 * (press-in, snap, fill complete), never on a timer.
 */
export const haptic = {
  /** Selection change: tabs, segmented control, chips. */
  tick: () => enabled() && safe(Haptics.selectionAsync()),
  /** A raised control bottoming out. */
  press: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heavier landing: sheet snap, card drop. */
  thud: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Locked or not-yet: gentle, not an error. */
  warn: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
