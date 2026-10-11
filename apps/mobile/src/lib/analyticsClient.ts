import type { AnalyticsClient } from './analyticsTypes';

/**
 * Fallback only (Metro always picks `.web.ts` or `.native.ts`; TypeScript resolves this
 * file). Also what any other platform gets: analytics off.
 */
export const client: AnalyticsClient = {
  start: () => false,
  launch: async () => ({ entry: 'direct' }),
  capture: () => {},
  screen: () => {},
  identify: () => {},
  setPerson: () => {},
  register: () => {},
  reset: () => {},
};
