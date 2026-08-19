/**
 * A section icon, drawn as real SVG paths.
 *
 * It used to go through `utils/pixelSvg` into an `<Image>`, which meant every
 * tile icon in the hub was blank on a phone — React Native's `<Image>` cannot
 * decode SVG. `PixelSprite` draws the same grid as `<Path>` elements instead,
 * which works on every platform. The grid carries two colour keys and the
 * palette is built per accent here, so one 12x12 grid serves any section.
 */

import type { ViewStyle } from 'react-native';
import { gridToPaths, type PixelPaths } from '../../utils/pixelSvg';
import { PixelSprite } from '../PixelSprite';
import { ICON_SIZE, SECTION_ICONS, SectionIconKey } from '../../constants/pixelIcons';
import { ACCENT_FILLS, ACCENT_INKS, AccentKey } from '../../constants/pixelTheme';

export interface PixelIconProps {
  name: SectionIconKey;
  /** Defaults to the accent of the same name, which is the usual pairing. */
  accent?: AccentKey;
  /** Drawn size. A multiple of 12 keeps every art pixel square. */
  size?: number;
  style?: ViewStyle;
}

// One grid per name/accent pair, built once. The hub mounts nine of these and
// re-renders them on every material change.
const iconCache = new Map<string, PixelPaths>();

function iconPaths(name: SectionIconKey, key: AccentKey): PixelPaths {
  const cacheKey = `${name}:${key}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const paths = gridToPaths(SECTION_ICONS[name], {
    a: ACCENT_INKS[key],
    b: ACCENT_FILLS[key],
  });
  iconCache.set(cacheKey, paths);
  return paths;
}

export function PixelIcon({ name, accent, size = ICON_SIZE * 2, style }: PixelIconProps) {
  const key = (accent ?? name) as AccentKey;

  return (
    <PixelSprite
      paths={iconPaths(name, key)}
      width={size}
      height={size}
      label={name}
      style={style}
    />
  );
}
