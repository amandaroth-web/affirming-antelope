import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTickSwap } from '@/motion';

/** Wait after Home regains focus before showing what changed, so the practice screen is out of the way first. */
export const SEEN_DELAY = 360;

/**
 * Hold a value while the screen is hidden and release it shortly after the
 * screen is back in view. Home updates underneath the practice screens; this
 * makes the change animate where the learner can see it, once, instead of
 * finishing invisibly. Compares by JSON, so pass plain data.
 */
export function useSeen<T>(value: T, visible: boolean, delay = SEEN_DELAY): T {
  const key = JSON.stringify(value);
  const [shown, setShown] = useState<{ key: string; value: T }>(() => ({ key, value }));
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (!visible || key === shown.key) return;
    // one-shot release, not an animation loop
    const t = setTimeout(() => setShown({ key, value: latest.current }), delay);
    return () => clearTimeout(t);
  }, [visible, key, shown.key, delay]);

  return shown.value;
}

/** Run `fn(prev, next)` when `value` changes after mount. Never on mount. */
export function useOnChange<T>(value: T, fn: (prev: T, next: T) => void) {
  const prev = useRef(value);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    const p = prev.current;
    prev.current = value;
    cb.current(p, value);
  }, [value]);
}

/**
 * Text (or any small block) that ticks over when `value` changes: the new
 * content rises in. Nothing animates on first mount (the screen entrance owns
 * that). The old content leaves at once so the block never doubles in height.
 */
export function TickSwap({ value, children, style }: { value: string | number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const tick = useTickSwap();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <Animated.View key={String(value)} entering={mounted.current ? tick.entering : undefined} style={style}>
      {children}
    </Animated.View>
  );
}
