// Dev-only: jump straight onto a track (renders nothing in release builds).
//   antelope://dev/track?id=mi-for-clinicians&to=/path&week=3&demo=0
// Skips the welcome, picks the track (keeping its progress), optionally sets the week, then opens `to`.
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { getPathway, isPathwayId } from '@/data/pathways';
import { useAccount } from '@/state/account';
import { useLearner } from '@/state/store';

export default function DevTrack() {
  const p = useLocalSearchParams<{ id?: string; to?: string; week?: string; demo?: string }>();
  useEffect(() => {
    if (!__DEV__) return;
    const s = useLearner.getState();
    if (p.demo === '1') s.setDemo(true);
    else if (p.demo === '0') s.setDemo(false);
    const id = isPathwayId(p.id) ? p.id : s.activePathwayId;
    useLearner.getState().choosePathway(id, 'me');
    const week = Number(p.week);
    if (week >= 1) {
      const pathway = getPathway(id);
      const earlier = pathway.units.filter((u) => u.week < week).flatMap((u) => u.activities.map((a) => a.id));
      useLearner.setState((st) => ({
        progress: { ...st.progress, [id]: { currentWeek: week, completedActivityIds: earlier, pathSeenWeek: week } },
      }));
    }
    useAccount.getState().set({ onboarded: true });
    // after the guard flips (the tabs are mounted again)
    setTimeout(() => router.replace((p.to || '/') as Href), 50);
  }, [p.id, p.week, p.demo, p.to]);
  return __DEV__ ? <View /> : null;
}
