/**
 * A section icon, rendered as an SVG data-URI `<Image>`.
 *
 * Goes through `utils/pixelSvg` rather than an inline `<svg>`, per convention
 * 11 — inline SVG doesn't exist on native. The grid carries two colour keys and
 * the palette is built per accent here, so one 12x12 grid serves any section.
 */

import { Image, ImageStyle } from 'react-native';
import { gridToSvgUri } from '../../utils/pixelSvg';
import { ICON_SIZE, SECTION_ICONS, SectionIconKey } from '../../constants/pixelIcons';
import { ACCENT_FILLS, ACCENT_INKS, AccentKey } from '../../constants/pixelTheme';

export interface PixelIconProps {
  name: SectionIconKey;
  /** Defaults to the accent of the same name, which is the usual pairing. */
  accent?: AccentKey;
  /** Drawn size. A multiple of 12 keeps every art pixel square. */
  size?: number;
  style?: ImageStyle;
}

export function PixelIcon({ name, accent, size = ICON_SIZE * 2, style }: PixelIconProps) {
  const key = (accent ?? name) as AccentKey;
  const uri = gridToSvgUri(SECTION_ICONS[name], {
    a: ACCENT_INKS[key],
    b: ACCENT_FILLS[key],
  });

  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      // The grid is authored at 12x12; anything else must not be smoothed.
      resizeMode="stretch"
    />
  );
}
