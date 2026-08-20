import React from 'react';
import { gridToPaths } from '../utils/pixelSvg';
import { PixelSprite } from './PixelSprite';

/**
 * Pixel-art icons for the café currencies and popularity.
 *
 * Each icon is a small grid of colour keys walked into SVG paths once at module
 * load and drawn by `PixelSprite` — real `<Path>` elements, not a data-URI in an
 * `<Image>`. The data-URI is what these used to be, and it renders nothing at
 * all on iOS and Android: React Native's `<Image>` decodes PNG/JPEG/GIF/WebP,
 * not SVG. It only ever worked because `<Image>` becomes a browser `<img>` on
 * web. This is the mechanical fix convention 12 asks for, and it matters more
 * here than anywhere: these three are the app's currency marks, and the menu,
 * the top bar and every price row lean on them.
 */

type Grid = string[];
type Palette = Record<string, string>;

// ── Coin ──────────────────────────────────────────────────────────────
// A round gold coin with a top-left highlight and bottom-right shadow.

const COIN_GRID: Grid = [
  '...OOOO...',
  '..OggggO..',
  '.OgHHgggO.',
  'OgHHgggggO',
  'OgHggggggO',
  'OgggggggSO',
  'OggggggSSO',
  '.OggggSSO.',
  '..OggggO..',
  '...OOOO...',
];

const COIN_PALETTE: Palette = {
  O: '#B8882D',   // dark gold outline
  g: '#F5D273',   // gold fill
  H: '#FFF5D6',   // highlight
  S: '#C49A3A',   // shadow
};

// ── Pearl ─────────────────────────────────────────────────────────────
// A lustrous purple pearl with a white sparkle.

const PEARL_GRID: Grid = [
  '...OOOO...',
  '..OppppO..',
  '.OpHHpppO.',
  'OpHWHppppO',
  'OpHHpppppO',
  'OpppppppsO',
  'OppppppssO',
  '.OppppssO.',
  '..OppppO..',
  '...OOOO...',
];

const PEARL_PALETTE: Palette = {
  O: '#9B6BAD',   // dark purple outline
  p: '#E0B8E8',   // lavender fill
  H: '#F0E0F6',   // light highlight
  W: '#FFFFFF',   // sparkle
  s: '#C89DD0',   // shadow
};

// ── Popularity star ───────────────────────────────────────────────────
// A five-pointed star in warm coral. Highlight at the tip for shine.

const STAR_GRID: Grid = [
  '....O....',
  '...OHO...',
  '..OOHOO..',
  'OFFFFFFFO',
  '.OFFFFFO.',
  '..OFFFO..',
  '..OF.FO..',
  '.OF...FO.',
  'OO.....OO',
];

const STAR_PALETTE: Palette = {
  O: '#C45E5E',   // dark coral outline
  F: '#E88973',   // coral fill
  H: '#FFB5A0',   // highlight
};

// Walked once at module load. Three 10x10 grids, and they mount and unmount
// on every price row in the app.
const COIN_PATHS = gridToPaths(COIN_GRID, COIN_PALETTE);
const PEARL_PATHS = gridToPaths(PEARL_GRID, PEARL_PALETTE);
const STAR_PATHS = gridToPaths(STAR_GRID, STAR_PALETTE);

// ── Exported components ───────────────────────────────────────────────

export function CoinIcon({ size = 14 }: { size?: number }) {
  return <PixelSprite paths={COIN_PATHS} width={size} height={size} label="coin" />;
}

export function PearlIcon({ size = 14 }: { size?: number }) {
  return <PixelSprite paths={PEARL_PATHS} width={size} height={size} label="pearl" />;
}

export function PopularityIcon({ size = 14 }: { size?: number }) {
  return <PixelSprite paths={STAR_PATHS} width={size} height={size} label="popularity" />;
}
