import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color, moveColor } from '@/design/tokens';
import { FAMILY, type MoveFamily } from './moves';

/**
 * The shape that stands for a move family everywhere: replay chart markers,
 * the chart legend and the tally rows. Shape + colour, so it never relies on
 * colour alone.
 */
export function MoveMarker({ family, size = 14, ring }: { family: MoveFamily; size?: number; ring?: string }) {
  const tint = moveColor[family];
  const shape = FAMILY[family].shape;
  const s = size;
  if (shape === 'triangle') {
    return (
      <Svg width={s} height={s} viewBox="0 0 14 14">
        {ring ? <Path d="M7 0.2 L13.8 12.6 L0.2 12.6 Z" fill={ring} /> : null}
        <Path d="M7 1.6 L12.6 11.8 L1.4 11.8 Z" fill={tint} stroke={color.white} strokeWidth={1.2} strokeLinejoin="round" />
      </Svg>
    );
  }
  const base = { width: s, height: s, backgroundColor: tint, borderWidth: 2, borderColor: ring ?? color.white };
  if (shape === 'diamond') {
    const d = s * 0.78;
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[base, { width: d, height: d, borderRadius: 2.5, transform: [{ rotate: '45deg' }] }]} />
      </View>
    );
  }
  if (shape === 'square') return <View style={[base, { borderRadius: 3.5 }]} />;
  if (shape === 'dot') {
    const d = s * 0.72;
    return (
      <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[base, { width: d, height: d, borderRadius: d / 2 }]} />
      </View>
    );
  }
  return <View style={[base, { borderRadius: s / 2 }]} />;
}
