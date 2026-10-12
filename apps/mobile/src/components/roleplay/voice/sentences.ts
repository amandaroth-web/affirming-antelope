/** The speak endpoint takes at most 600 characters (docs/voice.md). */
export const MAX_SPOKEN = 560;
/** Lines shorter than this wait to join the next one ("Okay." alone is a wasted request and a choppy beat). */
const MIN_SPOKEN = 18;

/**
 * Cuts streamed reply text into sentences as they complete, so each can be spoken
 * while the rest is still arriving. A sentence ends at . ! ? or … followed by
 * whitespace (closing quotes and brackets stay with it). Very short sentences are
 * held back to join the next; anything longer than the speak limit is split at the
 * last comma or space before it. `end()` flushes whatever is left.
 */
export function sentenceSplitter(onSentence: (text: string) => void) {
  let buffer = '';
  let held = '';

  const emit = (s: string, final = false) => {
    const text = `${held}${held ? ' ' : ''}${s.trim()}`.trim();
    if (!text) return;
    if (!final && text.length < MIN_SPOKEN) {
      held = text;
      return;
    }
    held = '';
    for (const piece of capped(text)) onSentence(piece);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const re = /[.!?…]+["'”’)\]]*\s+/g;
      let cut = 0;
      for (let m = re.exec(buffer); m; m = re.exec(buffer)) {
        emit(buffer.slice(cut, m.index + m[0].length));
        cut = m.index + m[0].length;
      }
      buffer = buffer.slice(cut);
      // a run-on with no sentence end yet: speak the part that can't grow any further
      while (buffer.length > MAX_SPOKEN) {
        const [head, rest] = splitAt(buffer);
        emit(head);
        buffer = rest;
      }
    },
    end() {
      emit(buffer, true);
      buffer = '';
      if (held) emit('', true);
    },
  };
}

function capped(text: string): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_SPOKEN) {
    const [head, tail] = splitAt(rest);
    out.push(head);
    rest = tail;
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

/** Split before MAX_SPOKEN at the last comma, else the last space, else hard. */
function splitAt(text: string): [string, string] {
  const window = text.slice(0, MAX_SPOKEN);
  let at = window.lastIndexOf(', ');
  if (at < MAX_SPOKEN / 2) at = window.lastIndexOf(' ');
  if (at <= 0) at = MAX_SPOKEN;
  else at += 1;
  return [text.slice(0, at).trim(), text.slice(at).trimStart()];
}
