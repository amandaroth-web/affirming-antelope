import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 uuid. Every practice record gets one as its `client_id` when it's created. */
export function uuid(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Not reachable on supported platforms; keeps a broken native module from losing a record.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);
