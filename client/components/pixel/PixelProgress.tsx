/**
 * A progress bar with hard edges.
 *
 * The old one was a rounded track with a rounded fill, which at small widths
 * meant the first few percent rendered as a lozenge rather than as progress.
 * This is a sunken well with a flat fill, and the fill is snapped to whole art
 * pixels so it advances in visible steps instead of creeping sub-pixel.
 */

import { View, ViewStyle } from 'react-native';
import { BEVEL_THIN, PX, PixelMaterial } from '../../constants/pixelTheme';

export interface PixelProgressProps {
  /** 0..1, clamped. */
  value: number;
  material: PixelMaterial;
  fill: string;
  height?: number;
  style?: ViewStyle;
}

export function PixelProgress({
  value,
  material,
  fill,
  height = PX * 5,
  style,
}: PixelProgressProps) {
  const clamped = Math.max(0, Math.min(1, value));
  // Whole percentage points land on the art grid closely enough at these
  // widths, and keep the fill from animating through fractional pixels.
  const pct = `${Math.round(clamped * 100)}%` as const;

  return (
    <View
      style={[
        {
          height,
          backgroundColor: material.track,
          borderWidth: BEVEL_THIN,
          borderTopColor: material.trackEdge,
          borderLeftColor: material.trackEdge,
          borderBottomColor: material.faceLt,
          borderRightColor: material.faceLt,
          borderRadius: 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View style={{ height: '100%', width: pct, backgroundColor: fill }} />
    </View>
  );
}
