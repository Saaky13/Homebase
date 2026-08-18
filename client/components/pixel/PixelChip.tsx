/**
 * A small bevelled label — counts, streaks, filters.
 *
 * Replaces the `borderRadius: 999` pills. A capsule has no pixel-art spelling:
 * at PX = 2 a fully rounded end is a staircase pretending to be a curve, which
 * is exactly the mismatch this kit exists to remove.
 */

import { View, ViewStyle } from 'react-native';
import { BEVEL_THIN, PX, PixelMaterial } from '../../constants/pixelTheme';
import { PixelText } from './PixelText';

export interface PixelChipProps {
  label: string;
  material: PixelMaterial;
  /** Fills the chip face — use for a selected filter or an accent count. */
  tint?: string;
  color?: string;
  style?: ViewStyle;
}

export function PixelChip({ label, material, tint, color, style }: PixelChipProps) {
  return (
    <View
      style={[
        {
          backgroundColor: tint ?? material.face,
          borderWidth: BEVEL_THIN,
          borderTopColor: material.faceLt,
          borderLeftColor: material.faceLt,
          borderBottomColor: material.faceDk,
          borderRightColor: material.faceDk,
          borderRadius: 0,
          paddingHorizontal: PX * 3,
          paddingVertical: PX,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <PixelText size="small" color={color ?? material.ink}>
        {label}
      </PixelText>
    </View>
  );
}
