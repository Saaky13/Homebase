import type { SkImage } from '@shopify/react-native-skia';

import { rasteriseGrid } from './pixelImage';
import { buildPlantSprite, droopGrid, type PlantStage } from '../constants/plants';

/**
 * Every plant sprite, rasterised once and kept.
 *
 * Same bargain as `catImageCache`: a 28x36 grid is ~1,000 cells, and the
 * greenhouse can have twelve pots on screen. Building the grid is cheap but
 * painting it as individual rects is not, so each species/stage/state combo
 * becomes an SkImage the first time it's asked for and is reused thereafter.
 *
 * There are nine species times five stages times two water states, so the
 * cache tops out at ninety entries — small enough to never evict.
 */
const cache = new Map<string, SkImage | null>();

export function getPlantSkImage(
  species: string,
  stage: PlantStage,
  wilting = false
): SkImage | null {
  const key = `${species}:${stage}:${wilting ? 'dry' : 'wet'}`;

  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const sprite = buildPlantSprite(species, stage, wilting);
  // Wilting droops as well as dulls — the plant sinks a row into its pot.
  const grid = wilting && stage !== 'husk' ? droopGrid(sprite.grid) : sprite.grid;

  const image = rasteriseGrid(grid, sprite.palette);
  cache.set(key, image);
  return image;
}
