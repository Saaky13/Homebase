import type { Tile } from '../town/map';
import type { RoofColor, RoofKey, TownPalette } from '../town/palette';

/**
 * Shared contract between the web (<canvas>) and native (Skia) town surfaces.
 * Both receive the same already-computed grid, palette and cast, so the two
 * paths can only ever differ in how they paint — never in what they paint.
 */
export interface TownSurfaceProps {
  grid: Tile[][];
  palette: TownPalette;
  roofs: Record<RoofKey, RoofColor>;
  isNight: boolean;
  /** Ids of the cats currently out walking. */
  catIds: string[];
  /** Fit factor for narrow screens; the art is authored at MAP_PX_W wide. */
  scale: number;
}
