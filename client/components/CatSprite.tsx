import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

import {
  getCat,
  getCatGrid,
  PALETTES,
  type Direction,
} from '../constants/catSprites';
import { gridToSvgUri, type PixelPalette } from '../utils/pixelSvg';

/**
 * Draws a roster cat as a plain <Image>.
 *
 * The café and the town map rasterise these grids onto a canvas; React has had
 * no way to show one until now. Routing the grid through the same SVG data-URI
 * trick the currency icons use means a cat can sit in an ordinary layout with
 * no canvas, no Skia, and no measuring.
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

type Sprite = { uri: string; width: number; height: number };

// Built once per cat/direction/state and kept. A full collection screen is 36
// sprites, and re-encoding a few hundred rects on every scroll frame would be
// wasteful for art that never changes.
const spriteCache = new Map<string, Sprite | null>();

export function getCatSprite(
  catId: string,
  direction: Direction = 'front',
  locked = false
): Sprite | null {
  const key = `${catId}:${direction}:${locked ? 'locked' : 'lit'}`;

  const cached = spriteCache.get(key);
  if (cached !== undefined) return cached;

  const spec = getCat(catId);
  if (!spec) {
    spriteCache.set(key, null);
    return null;
  }

  const grid = getCatGrid(spec, direction);
  const sprite: Sprite = {
    uri: gridToSvgUri(grid, locked ? SILHOUETTE : PALETTES[spec.palette]),
    width: grid[0]?.length ?? 0,
    height: grid.length,
  };

  spriteCache.set(key, sprite);
  return sprite;
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
  style?: StyleProp<ImageStyle>;
}) {
  const sprite = getCatSprite(catId, direction, locked);
  if (!sprite || !sprite.width) return null;

  // Cat grids are taller than they are wide (28x37). Deriving the height from
  // the grid rather than assuming a square keeps them from being squashed.
  const height = Math.round(size * (sprite.height / sprite.width));

  return (
    <Image
      source={{ uri: sprite.uri }}
      style={[{ width: size, height }, style]}
      accessibilityLabel={locked ? 'undiscovered cat' : (getCat(catId)?.name ?? 'cat')}
    />
  );
}
