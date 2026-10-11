import { useEffect, useSyncExternalStore, type RefObject } from 'react';
import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * The on-screen keyboard on the web build (mostly iOS Safari), for the practice
 * screens. Native uses NativeKeyboardColumn instead; everything here is a no-op there.
 *
 * Safari doesn't resize the page for the keyboard: it shrinks the visual viewport
 * and scrolls the whole document to bring the focused field into view. Our layout
 * is pinned to the window (body overflow hidden), so that scroll pushed the session
 * header, the prompt and the speech card off the top, left the composer under the
 * status bar and showed the empty page below the session as a grey band. So on a
 * practice screen:
 *  - the document stays at the top (`usePinnedDocument`),
 *  - a tap on the composer focuses it without Safari's scroll (`useFocusWithoutScroll`),
 *  - the session keeps the full layout height and `KeyboardColumn` pads by the
 *    keyboard's overlap (`useWebViewport().keyboard`), on a curve close to the
 *    keyboard's own, so the composer docks right above it.
 *
 * One set of listeners is shared by every subscriber and read at most once per
 * frame; subscribers only hear about a change in the rounded values, so neither
 * scrolling nor the keyboard's animation can start an update loop.
 */

export interface WebViewport {
  /** Layout viewport height (stable while the keyboard is up), px. */
  height: number;
  /** How much of the bottom of the layout viewport the keyboard covers, px. */
  keyboard: number;
}

/** Close to iOS's keyboard animation (~250ms, fast out, long settle). */
export const KEYBOARD_MS = 250;
export const KEYBOARD_EASING = Easing.bezier(0.38, 0.7, 0.125, 1);

const web = Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
const NONE: WebViewport = { height: 0, keyboard: 0 };

/**
 * Safari reports the keyboard going away only once it has finished sliding down.
 * When a field loses focus to something that isn't a field, the keyboard is on its
 * way out, so the layout follows it from the start instead (until Safari catches
 * up, or a moment passes and we re-read whatever is really there).
 */
let closingUntil = 0;
const CLOSING_MS = 700;

function read(): WebViewport {
  const height = document.documentElement.clientHeight || window.innerHeight;
  const vv = window.visualViewport;
  // pinch zoom shrinks the visual viewport in CSS px but not on screen; compare at scale 1
  const visible = vv ? vv.height * vv.scale : height;
  const keyboard = Math.max(0, Math.round(height - visible));
  if (keyboard < 2 || performance.now() < closingUntil) return { height, keyboard: 0 };
  return { height, keyboard };
}

let snap: WebViewport = web ? read() : NONE;
const listeners = new Set<() => void>();
let pins = 0;
let frame = 0;
let attached = false;

const editable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);

function focusOut(e: Event) {
  if (editable((e as FocusEvent).relatedTarget)) return;
  closingUntil = performance.now() + CLOSING_MS;
  schedule();
  setTimeout(schedule, CLOSING_MS + 20);
}

function caughtUp() {
  closingUntil = 0;
  schedule();
}

function tick() {
  frame = 0;
  const vv = window.visualViewport;
  // Safari scrolled the document to reveal the focused field: put it back (not while pinch-zoomed)
  if (pins > 0 && window.scrollY !== 0 && (!vv || vv.scale < 1.01)) window.scrollTo(0, 0);
  const next = read();
  if (next.height === snap.height && next.keyboard === snap.keyboard) return;
  snap = next;
  listeners.forEach((l) => l());
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function sync() {
  const want = listeners.size > 0 || pins > 0;
  if (want === attached) return;
  attached = want;
  const vv = window.visualViewport;
  const op = want ? 'addEventListener' : 'removeEventListener';
  vv?.[op]('resize', caughtUp);
  vv?.[op]('scroll', schedule);
  window[op]('resize', schedule);
  window[op]('scroll', schedule);
  document[op]('focusin', caughtUp);
  document[op]('focusout', focusOut);
  if (!want && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

function subscribe(listener: () => void) {
  if (!web) return () => {};
  listeners.add(listener);
  sync();
  schedule(); // catch up on anything that changed while nobody was listening
  return () => {
    listeners.delete(listener);
    sync();
  };
}

const getSnapshot = () => snap;

/** Layout height and keyboard overlap on the web; zeros on native. */
export function useWebViewport(): WebViewport {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Web: keep the document scrolled to the top while mounted (practice screens). */
export function usePinnedDocument() {
  useEffect(() => {
    if (!web) return;
    pins += 1;
    sync();
    schedule();
    return () => {
      pins -= 1;
      sync();
    };
  }, []);
}

const iosWeb =
  web && (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

/**
 * iOS web: a tap on an unfocused field focuses it with `preventScroll`, so Safari
 * doesn't scroll the page up to clear the keyboard (the layout makes room itself).
 * Drags, long presses and taps on an already focused field keep their native
 * behaviour (scrolling, the loupe, moving the caret).
 */
export function useFocusWithoutScroll(ref: RefObject<unknown>) {
  useEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!iosWeb || !el || typeof el.addEventListener !== 'function') return;
    let start: { x: number; y: number; at: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, at: e.timeStamp } : null;
    };
    const up = (e: TouchEvent) => {
      const s = start;
      start = null;
      const t = e.changedTouches[0];
      if (!s || !t || !e.cancelable || document.activeElement === el) return;
      if (Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10 || e.timeStamp - s.at > 500) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchend', up, { passive: false });
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchend', up);
    };
  }, [ref]);
}
