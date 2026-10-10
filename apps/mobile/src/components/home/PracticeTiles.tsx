import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, PressableSurface, Text, color, radius, space } from '@/design';

export interface PracticeTile {
  key: string;
  title: string;
  detail: string;
  icon: ReactNode;
  onPress?: () => void;
  soon?: boolean;
}

/** 2x2 grid of ways to practice outside today's plan. */
export function PracticeTiles({ tiles }: { tiles: PracticeTile[] }) {
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <PressableSurface
          key={t.key}
          onPress={t.onPress}
          disabled={t.soon}
          tone="surface"
          depth={5}
          radius={radius.surface}
          style={styles.tile}
          contentStyle={[styles.face, t.soon && styles.soonFace]}
          accessibilityLabel={`${t.title}, ${t.detail}${t.soon ? ', coming soon' : ''}`}
        >
          <View style={[styles.icon, t.soon && styles.iconSoon]}>{t.icon}</View>
          <Text variant="subheading" color={t.soon ? color.muted : color.ink} style={styles.title}>
            {t.title}
          </Text>
          {t.soon ? (
            <Chip label="Coming soon" tone="neutral" style={styles.chip} />
          ) : (
            <Text variant="caption" color={color.muted}>
              {t.detail}
            </Text>
          )}
        </PressableSurface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { width: '48%', flexGrow: 1 },
  face: { padding: space[4], minHeight: 138 },
  soonFace: { borderStyle: 'dashed', backgroundColor: color.white },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.badge,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  iconSoon: { backgroundColor: color.white, borderWidth: 2, borderColor: color.line },
  title: { marginBottom: 2 },
  chip: { marginTop: 4 },
});
