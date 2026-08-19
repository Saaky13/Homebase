import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  getCat,
  getCatGrid,
  PALETTES,
  type Direction,
} from '../constants/catSprites';
import { gridToPaths, type PixelPalette, type PixelPaths } from '../utils/pixelSvg';
import { PixelSprite } from './PixelSprite';

/**
 * Draws a roster cat in an ordinary layout — no canvas, no Skia, no measuring.
 *
 * The café and the town map rasterise these grids onto a canvas; this is the
 * React path, used by the shelter's collection, the adoption reveal and the
 * almanac. It draws through `PixelSprite` (real <Path> elements) rather than
 * the SVG data-URI it used to use, because a data-URI in a React Native
 * <Image> renders nothing at all on iOS and Android — see the note in
 * `utils/pixelSvg.ts`.
 */

/**
 * Locked cats render as a flat two-tone silhouette rather than a faded version
 * of the real thing. A cat's coat is most of its personality, so showing it at
 * low opacity gives the surprise away while still refusing to name it — the
 * shape alone is a better tease, and it pairs with the "???" on the card.
 */
const SILHOUETTE: PixelPalette = {
  B: '#D9D2CB',
  S: '#D9D2CB',
  C: '#D9D2CB',
  W: '#D9D2CB',
  E: '#D9D2CB',
  H: '#D9D2CB',
  P: '#D9D2CB',
  K: '#D9D2CB',
  O: '#B9AFA6',
};

// Built once per cat/direction/state and kept. A collection screen is 36
// sprites, and walking a thousand-cell grid on every scroll frame would be
// wasteful for art that never changes.
const pathCache = new Map<string, PixelPaths | null>();

export function getCatPaths(
  catId: string,
  direction: Direction = 'front',
  locked = false
): PixelPaths | null {
  const key = `${catId}:${direction}:${locked ? 'locked' : 'lit'}`;

  const cached = pathCache.get(key);
  if (cached !== undefined) return cached;

  const spec = getCat(catId);
  if (!spec) {
    pathCache.set(key, null);
    return null;
  }

  const paths = gridToPaths(
    getCatGrid(spec, direction),
    locked ? SILHOUETTE : PALETTES[spec.palette]
  );

  pathCache.set(key, paths);
  return paths;
}

export function CatSprite({
  catId,
  size = 64,
  direction = 'front',
  locked = false,
  style,
}: {
  catId: string;
  /** Rendered width in points; height follows the sprite's own aspect ratio. */
  size?: number;
  direction?: Direction;
  locked?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const paths = getCatPaths(catId, direction, locked);
  if (!paths) return null;

  return (
    <PixelSprite
      paths={paths}
      width={size}
      label={locked ? 'undiscovered cat' : (getCat(catId)?.name ?? 'cat')}
      style={style}
    />
  );
}
