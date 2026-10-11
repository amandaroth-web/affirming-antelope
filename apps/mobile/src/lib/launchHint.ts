import { getDrill, getScenario, type PathwayId } from '@antelope/core';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { pathwayForSetting } from '@/data/pathways';

/**
 * Which track to preselect in the welcome, from how the app was opened. The website's
 * CTAs carry `?src=<location>` (apps/web/src/lib/site.ts › appHref): `audience_clinicians`
 * and `audience_leaders` on the /for/* pages (`for_clinicians` / `for_leaders` are
 * accepted too), and guides deep-link one drill (`/drill/<id>?src=guide_<slug>`), whose
 * own setting tells us the track. Read once at launch, before the router can normalise
 * the URL; works whether or not analytics is on. A hint only preselects: the learner
 * still sees the choice.
 */

function fromUrl(raw: string | null | undefined): PathwayId | null {
  if (!raw) return null;
  try {
    const { path, queryParams } = Linking.parse(raw);
    const src = typeof queryParams?.src === 'string' ? queryParams.src.toLowerCase() : '';
    if (/^(audience|for)_clinicians?$/.test(src) || src.includes('clinician')) return 'mi-for-clinicians';
    if (/^(audience|for)_leaders?$/.test(src) || src.includes('leader')) return 'mi-for-leaders';
    const [kind, id] = (path ?? '').replace(/^\/+/, '').split('/');
    if (kind === 'drill' && id) {
      const d = getDrill(decodeURIComponent(id));
      if (d) return pathwayForSetting(d.setting);
    }
    if (kind === 'roleplay' && id) {
      const s = getScenario(decodeURIComponent(id));
      if (s) return pathwayForSetting(s.setting);
    }
  } catch {
    // not a URL we understand: no hint
  }
  return null;
}

const webHref = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;

/** Resolves once: the hinted track for this launch, or null. */
export const launchPathwayHint: Promise<PathwayId | null> =
  Platform.OS === 'web' ? Promise.resolve(fromUrl(webHref)) : Linking.getInitialURL().then(fromUrl, () => null);
