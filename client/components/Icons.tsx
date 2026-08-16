import React from 'react';
import { Image } from 'react-native';

/**
 * Pixel-art icons for the café currencies and popularity.
 *
 * Each icon is a small grid of colour keys rendered into an SVG data-URI at
 * module load time. `shape-rendering="crispEdges"` keeps the pixel look sharp
 * at any display size.
 */

type Grid = string[];
type Palette = Record<string, string>;

function gridToSvgUri(grid: Grid, palette: Palette): string {
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  let rects = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x];
      if (ch !== '.' && palette[ch]) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[ch]}"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges">${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

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

// Pre-compute the URIs once at module load
const COIN_URI = gridToSvgUri(COIN_GRID, COIN_PALETTE);
const PEARL_URI = gridToSvgUri(PEARL_GRID, PEARL_PALETTE);
const STAR_URI = gridToSvgUri(STAR_GRID, STAR_PALETTE);

// ── Exported components ───────────────────────────────────────────────

export function CoinIcon({ size = 14 }: { size?: number }) {
  return (
    <Image
      source={{ uri: COIN_URI }}
      style={{ width: size, height: size }}
      accessibilityLabel="coin"
    />
  );
}

export function PearlIcon({ size = 14 }: { size?: number }) {
  return (
    <Image
      source={{ uri: PEARL_URI }}
      style={{ width: size, height: size }}
      accessibilityLabel="pearl"
    />
  );
}

export function PopularityIcon({ size = 14 }: { size?: number }) {
  return (
    <Image
      source={{ uri: STAR_URI }}
      style={{ width: size, height: size }}
      accessibilityLabel="popularity"
    />
  );
}
