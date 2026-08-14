import type { Tile } from '../town/map';
import type { RoofColor, RoofKey, TownPalette } from '../town/palette';

/**
 * Shared contract between the web (<canvas>) and native (Skia) town surfaces.
 * Both receive the same already-computed grid and palette, so the two paths
 * can never drift on what they draw — only on how they draw it.
 */
export interface TownSurfaceProps {
  grid: Tile[][];
  palette: TownPalette;
  roofs: Record<RoofKey, RoofColor>;
  isNight: boolean;
  /** Fit factor for narrow screens; the art is authored at MAP_PX_W wide. */
  scale: number;
}
