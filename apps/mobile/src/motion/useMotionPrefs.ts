import { useReducedMotion } from 'react-native-reanimated';
import { useLearner } from '@/state/store';

/** True when the OS asks for reduced motion or the learner turned it on in Me > Settings. */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const pref = useLearner((s) => s.settings.motion);
  return system || pref === 'reduce';
}
