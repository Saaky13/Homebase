import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { vesselGrid } from '../constants/vessels';
import { CUP_PALETTES, DRINKS, type DrinkId } from '../constants/drinks';
import { gridToPaths, type PixelPaths } from '../utils/pixelSvg';
import { PixelSprite } from './PixelSprite';

/**
 * A drink, drawn as its cup.
 *
 * The same relationship `CatSprite` has to the cat grids: the café rasterises
 * these onto a Skia canvas, this is the React path used by the recipe rail,
 * the almanac and the inspect card. It draws real <Path> elements through
 * `PixelSprite` rather than an SVG data-URI, which renders nothing on device —
 * see convention 12.
 */

/** Fill is quantised so a scrolling rail reuses four path sets, not forty. */
const FILL_STEPS = 4;

const cache = new Map<string, PixelPaths>();

function getCupPaths(drink: DrinkId, fillStep: number): PixelPaths {
  const key = `${drink}:${fillStep}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const paths = gridToPaths(
    vesselGrid(DRINKS[drink].vessel, fillStep / FILL_STEPS),
    CUP_PALETTES[drink]
  );
  cache.set(key, paths);
  return paths;
}

export interface CupSpriteProps {
  drink: DrinkId;
  /** 0–1. Quantised to quarters — the cup empties as it is handed over. */
  fill?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}

export function CupSprite({ drink, fill = 1, width = 34, style }: CupSpriteProps) {
  const step = Math.max(0, Math.min(FILL_STEPS, Math.round(fill * FILL_STEPS)));
  return (
    <PixelSprite
      paths={getCupPaths(drink, step)}
      width={width}
      label={DRINKS[drink].name}
      style={style}
    />
  );
}

export default CupSprite;
