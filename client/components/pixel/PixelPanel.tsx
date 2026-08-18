/**
 * A bevelled surface — the hub's one container.
 *
 * Replaces the old `sectionCard`/`tileFace`, which used a 24-28px border radius
 * plus a translucent white gloss bar. Both are impossible marks in pixel art:
 * the radius is a 12-art-pixel curve at PX = 2, and the gloss is a gradient in
 * a room where every other mark is a flat filled rect.
 *
 * Volume is modelled the way `cafeRender` models it — a light edge on the top
 * and left, a dark edge on the bottom and right, nothing in between.
 */

import { View, ViewProps, ViewStyle } from 'react-native';
import { BEVEL, PX, PixelMaterial } from '../../constants/pixelTheme';

export interface PixelPanelProps extends ViewProps {
  material: PixelMaterial;
  /** Invert the bevel so the surface reads pressed in rather than raised. */
  sunken?: boolean;
  /** Use the darker face, for wells and inset rows. */
  inset?: boolean;
  /**
   * The colour behind this panel. Corners are bitten out with four squares of
   * it — the pixel-art way to round something, and the reason this takes a
   * colour instead of a border radius. Omit to leave corners square.
   */
  behind?: string;
  bevel?: number;
}

export function PixelPanel({
  material,
  sunken,
  inset,
  behind,
  bevel = BEVEL,
  style,
  children,
  ...rest
}: PixelPanelProps) {
  const lt = sunken ? material.faceDk : material.faceLt;
  const dk = sunken ? material.faceLt : material.faceDk;

  const face: ViewStyle = {
    backgroundColor: inset ? material.sunk : material.face,
    borderTopWidth: bevel,
    borderLeftWidth: bevel,
    borderBottomWidth: bevel,
    borderRightWidth: bevel,
    borderTopColor: lt,
    borderLeftColor: lt,
    borderBottomColor: dk,
    borderRightColor: dk,
    // Explicitly square. A pixel panel never rounds; it bites.
    borderRadius: 0,
  };

  return (
    <View {...rest} style={[face, style]}>
      {children}
      {behind ? <CornerBite color={behind} /> : null}
    </View>
  );
}

/**
 * Four single-art-pixel squares in the parent's colour, one per corner. Drawn
 * over the children so a panel whose content runs to the edge still gets its
 * corners taken off.
 */
function CornerBite({ color }: { color: string }) {
  const dot: ViewStyle = {
    position: 'absolute',
    width: PX,
    height: PX,
    backgroundColor: color,
  };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 } as ViewStyle}>
      <View style={[dot, { top: 0, left: 0 }]} />
      <View style={[dot, { top: 0, right: 0 }]} />
      <View style={[dot, { bottom: 0, left: 0 }]} />
      <View style={[dot, { bottom: 0, right: 0 }]} />
    </View>
  );
}
