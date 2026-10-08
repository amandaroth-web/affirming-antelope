import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { color, radius } from './tokens';

type ChipTone = 'soft' | 'primary' | 'gold' | 'neutral' | 'locked' | 'onPrimary';

const TONES: Record<ChipTone, { bg: string; ink: string; edge?: string }> = {
  soft: { bg: color.soft, ink: color.primaryShadow },
  primary: { bg: color.primary, ink: color.white },
  gold: { bg: color.goldTint, ink: '#8A5A0B' },
  neutral: { bg: color.white, ink: color.muted, edge: color.line },
  locked: { bg: color.soft, ink: color.muted },
  onPrimary: { bg: 'rgba(255,255,255,0.16)', ink: color.white },
};

/** Small label pill: durations, levels, "Coming soon". Not interactive. */
export function Chip({
  label,
  tone = 'soft',
  icon,
  style,
}: {
  label: string;
  tone?: ChipTone;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: t.bg, borderColor: t.edge ?? t.bg },
        style,
      ]}
    >
      {icon}
      <Text variant="caption" color={t.ink} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm - 2,
    borderWidth: 2,
  },
  label: { fontFamily: 'Nunito_800ExtraBold' },
});
