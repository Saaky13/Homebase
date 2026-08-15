/**
 * Draws the town.
 *
 * Every mark on this map is a filled axis-aligned rectangle — no paths, no
 * curves, no images. That is deliberate: it means porting to Skia is one
 * implementation of `Painter`, not a rewrite. Canvas2D lives in
 * `canvasPainter.ts`; a Skia painter would be about thirty lines beside it.
 */

import {
  BUILDINGS, BuildingSpec, DoorKind, EMPTY_PLOTS, FOUNTAIN, GREENHOUSE,
  KEY_TREE, MAP_H, MAP_W, RoofStyle, TILE, Tile, TreeKind, WindowKind, noise,
} from './map';
import { dimForNight, RoofColor, RoofKey, TownPalette } from './palette';
import { getCat, getMiniCatGrid, PALETTES } from '../constants/catSprites';
import { Roamer } from './roam';

/** The only drawing operation the town needs. */
export interface Painter {
  rect(x: number, y: number, w: number, h: number, color: string): void;
}

interface Ctx {
  p: Painter;
  pal: TownPalette;
  roofs: Record<RoofKey, RoofColor>;
  grid: Tile[][];
}

/* ------------------------------- terrain ------------------------------- */

const TREES: Record<TreeKind, (c: Ctx, x: number, y: number) => void> = {
  round(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 3, y + 4, 2, 4, pal.trunk);
    p.rect(x, y - 3, 8, 8, pal.leafDk);
    p.rect(x + 1, y - 4, 6, 8, pal.leaf);
    p.rect(x + 2, y - 3, 3, 3, pal.leafLt);
  },
  blossom(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 3, y + 4, 2, 4, pal.trunk);
    p.rect(x, y - 3, 8, 8, pal.pinkDk);
    p.rect(x + 1, y - 4, 6, 8, pal.pink);
    p.rect(x + 2, y - 3, 3, 3, pal.pinkLt);
    p.rect(x + 5, y - 1, 1, 1, pal.fl4);
  },
  pine(c, x, y) {
    const { p, pal } = c;
    // Trunk runs up into the canopy rather than floating beneath it.
    p.rect(x + 3, y + 1, 2, 7, pal.trunkDk);
    p.rect(x + 2, y - 9, 4, 3, pal.pineDk);
    p.rect(x + 1, y - 7, 6, 3, pal.pine);
    p.rect(x + 2, y - 7, 3, 1, pal.pineLt);
    p.rect(x + 1, y - 5, 6, 4, pal.pineDk);
    p.rect(x + 2, y - 5, 4, 2, pal.pine);
    p.rect(x, y - 2, 8, 4, pal.pineDk);
    p.rect(x + 1, y - 2, 5, 2, pal.pine);
  },
  bushy(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 6, y + 4, 3, 4, pal.trunk);
    p.rect(x - 2, y - 4, 15, 9, pal.leafDk);
    p.rect(x - 1, y - 6, 13, 9, pal.leaf);
    p.rect(x + 1, y - 5, 5, 3, pal.leafLt);
  },
  willow(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 3, y + 3, 2, 5, pal.trunk);
    p.rect(x, y - 4, 8, 6, pal.leafDk);
    p.rect(x + 1, y - 5, 6, 6, pal.leafLt);
    p.rect(x, y + 1, 1, 4, pal.leaf);
    p.rect(x + 3, y + 2, 1, 4, pal.leaf);
    p.rect(x + 7, y + 1, 1, 3, pal.leaf);
  },
  fruit(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 3, y + 4, 2, 4, pal.trunk);
    p.rect(x, y - 3, 8, 8, pal.leafDk);
    p.rect(x + 1, y - 4, 6, 8, pal.leaf);
    p.rect(x + 2, y - 2, 2, 2, pal.berry);
    p.rect(x + 5, y + 1, 2, 2, pal.berry);
  },
  shrub(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 1, y + 1, 6, 6, pal.leafDk);
    p.rect(x + 2, y, 5, 6, pal.leaf);
    p.rect(x + 2, y + 1, 2, 2, pal.leafLt);
  },
  // Unused by any grove today; kept for the seasonal swap.
  autumn(c, x, y) {
    const { p, pal } = c;
    p.rect(x + 3, y + 4, 2, 4, pal.trunkDk);
    p.rect(x, y - 3, 8, 8, pal.amberDk);
    p.rect(x + 1, y - 4, 6, 8, pal.amber);
    p.rect(x + 2, y - 3, 3, 3, pal.amberLt);
  },
};

function drawGrass(c: Ctx, x: number, y: number, tx: number, ty: number): void {
  const { p, pal } = c;
  p.rect(x, y, TILE, TILE, pal.grass);
  for (let i = 0; i < 3; i++) {
    const gx = Math.floor(noise(tx, ty, i) * 7);
    const gy = Math.floor(noise(tx, ty, i + 9) * 7);
    p.rect(x + gx, y + gy, 2, 1, pal.grassDk);
    if (noise(tx, ty, i + 21) > 0.6) p.rect(x + gx, y + gy - 1, 1, 1, pal.grassLt);
  }
  // Flowers borrow the roof palette, and crowd in near the falls.
  const nearFalls = ty < 24 && tx > 26;
  const threshold = nearFalls ? 0.58 : 0.85;
  const v = noise(tx, ty, 12);
  if (v <= threshold) return;
  const cols = [pal.fl1, pal.fl2, pal.fl3, pal.fl4, pal.fl5];
  p.rect(x + 1 + Math.floor(noise(tx, ty, 51) * 4), y + 1 + Math.floor(noise(tx, ty, 52) * 4),
    2, 2, cols[Math.floor(noise(tx, ty, 33) * 5)]);
  if (v > threshold + 0.14) {
    p.rect(x + 4 + Math.floor(noise(tx, ty, 53) * 3), y + 4 + Math.floor(noise(tx, ty, 54) * 3),
      2, 2, cols[Math.floor(noise(tx, ty, 44) * 5)]);
  }
}

function drawTile(c: Ctx, tx: number, ty: number): void {
  const { p, pal, grid } = c;
  const t = grid[ty][tx];
  const x = tx * TILE, y = ty * TILE;
  const at = (ax: number, ay: number) =>
    ay < 0 || ay >= MAP_H || ax < 0 || ax >= MAP_W ? null : grid[ay][ax];

  if (t === 'W') {
    p.rect(x, y, TILE, TILE, pal.water);
    if (noise(tx, ty, 2) > 0.6) p.rect(x + 1, y + 3, 4, 1, pal.waterLt);
    if (at(tx, ty - 1) !== 'W') p.rect(x, y, TILE, 1, pal.foam);
    if (at(tx, ty + 1) !== 'W') p.rect(x, y + TILE - 1, TILE, 1, pal.waterDk);
    if (at(tx - 1, ty) !== 'W') p.rect(x, y, 1, TILE, pal.foam);
    if (at(tx + 1, ty) !== 'W') p.rect(x + TILE - 1, y, 1, TILE, pal.foam);
    return;
  }
  if (t === 'C') {
    p.rect(x, y, TILE, TILE, pal.rock);
    p.rect(x, y, TILE, 2, pal.rockLt);
    if (noise(tx, ty, 4) > 0.6) p.rect(x + 2, y + 4, 3, 2, pal.rockDk);
    if (at(tx, ty + 1) !== 'C') p.rect(x, y + TILE - 2, TILE, 2, pal.rockDk);
    return;
  }
  if (t === 'S' || t === 'R') {
    const base = t === 'S' ? pal.stone : pal.road;
    const dk = t === 'S' ? pal.stoneDk : pal.roadDk;
    p.rect(x, y, TILE, TILE, base);
    // Three joint patterns picked per tile, so paving never visibly repeats.
    const v = noise(tx, ty, 5);
    if (v > 0.66) { p.rect(x, y + 4, TILE, 1, dk); p.rect(x + 3, y, 1, 4, dk); }
    else if (v > 0.33) { p.rect(x, y + 3, TILE, 1, dk); p.rect(x + 5, y + 4, 1, 4, dk); }
    else { p.rect(x, y + 5, TILE, 1, dk); p.rect(x + 2, y, 1, 5, dk); }
    if (t === 'S') p.rect(x + 1, y + 1, 1, 1, pal.stoneLt);
    const paved = (v2: string | null) => v2 === 'S' || v2 === 'R' || v2 === 'o';
    if (!paved(at(tx, ty - 1))) p.rect(x, y, TILE, 1, dk);
    if (!paved(at(tx, ty + 1))) p.rect(x, y + TILE - 1, TILE, 1, dk);
    if (!paved(at(tx - 1, ty))) p.rect(x, y, 1, TILE, dk);
    if (!paved(at(tx + 1, ty))) p.rect(x + TILE - 1, y, 1, TILE, dk);
    return;
  }
  if (t === 'o') {
    p.rect(x, y, TILE, TILE, pal.dirt);
    if (noise(tx, ty, 9) > 0.55) p.rect(x + 3, y + 3, 2, 2, pal.dirtDk);
    if (at(tx, ty - 1) !== 'o') p.rect(x, y, TILE, 1, pal.dirtDk);
    if (at(tx, ty + 1) !== 'o') p.rect(x, y + TILE - 1, TILE, 1, pal.dirtDk);
    if (at(tx - 1, ty) !== 'o') p.rect(x, y, 1, TILE, pal.dirtDk);
    if (at(tx + 1, ty) !== 'o') p.rect(x + TILE - 1, y, 1, TILE, pal.dirtDk);
    return;
  }

  drawGrass(c, x, y, tx, ty);
  const kind = KEY_TREE[t];
  if (kind) TREES[kind](c, x, y);
}

/* ------------------------------ buildings ------------------------------ */

const ROOF_RATIO: Record<RoofStyle, number> = {
  gable: 0.32, peak: 0.42, hip: 0.3, flat: 0.26, mansard: 0.36,
};

function shingles(c: Ctx, x: number, y: number, w: number, h: number, dk: string): void {
  for (let r = 0; r * 4 < h; r++) {
    const off = (r % 2) * 4;
    for (let i = 0; x + off + i * 8 < x + w - 2; i++) c.p.rect(x + off + i * 8, y + r * 4, 6, 1, dk);
  }
}

const ROOFS: Record<RoofStyle, (c: Ctx, x: number, y: number, w: number, rh: number, col: RoofColor) => void> = {
  gable(c, x, y, w, rh, col) {
    c.p.rect(x + 5, y + 3, w - 10, rh - 3, col[1]);
    c.p.rect(x + 6, y + 3, w - 12, 2, col[2]);
    shingles(c, x + 7, y + 6, w - 14, rh - 7, col[1]);
    c.p.rect(x, y + rh - 3, w, 6, col[0]);
    c.p.rect(x, y + rh - 3, w, 2, col[2]);
  },
  peak(c, x, y, w, rh, col) {
    const rows = rh - 2;
    for (let i = 0; i < rows; i++) {
      const inset = Math.round((w / 2 - 3) * (1 - i / rows));
      c.p.rect(x + inset, y + 1 + i, w - inset * 2, 1, i < 2 ? col[2] : i % 4 === 3 ? col[1] : col[0]);
    }
    c.p.rect(x - 1, y + rh - 1, w + 2, 4, col[1]);
  },
  hip(c, x, y, w, rh, col) {
    for (let i = 0; i < rh; i++) {
      const inset = Math.round(w * 0.3 * (1 - i / rh));
      c.p.rect(x + inset, y + i, w - inset * 2, 1, i < 2 ? col[2] : i % 4 === 3 ? col[1] : col[0]);
    }
    c.p.rect(x - 1, y + rh, w + 2, 3, col[1]);
  },
  flat(c, x, y, w, rh, col) {
    const top = Math.max(0, rh - 12);
    c.p.rect(x + 3, y + top, w - 6, 7, col[0]);
    c.p.rect(x + 3, y + top, w - 6, 2, col[2]);
    for (let i = 0; i * 7 < w - 8; i++) c.p.rect(x + 5 + i * 7, y + Math.max(0, rh - 10), 3, 3, col[1]);
    c.p.rect(x - 1, y + rh - 5, w + 2, 4, col[1]);
    c.p.rect(x - 1, y + rh - 1, w + 2, 3, col[0]);
  },
  mansard(c, x, y, w, rh, col) {
    const top = Math.round(rh * 0.34);
    c.p.rect(x + 8, y, w - 16, top, col[1]);
    c.p.rect(x + 9, y, w - 18, 2, col[2]);
    for (let i = 0; i < rh - top; i++) {
      const inset = Math.round(8 * (1 - i / (rh - top)));
      c.p.rect(x + inset, y + top + i, w - inset * 2, 1, i % 4 === 3 ? col[1] : col[0]);
    }
    c.p.rect(x - 1, y + rh, w + 2, 3, col[1]);
  },
};

function drawWindow(c: Ctx, x: number, y: number, w: number, h: number, kind: WindowKind): void {
  const { p, pal } = c;
  if (kind === 'round') {
    p.rect(x + 2, y - 1, w - 4, 2, pal.woodDk);
    p.rect(x, y + 1, w, h - 2, pal.woodDk);
    p.rect(x + 2, y + h - 1, w - 4, 2, pal.woodDk);
    p.rect(x + 2, y + 2, w - 4, Math.round(h / 2) - 2, pal.glassLt);
    p.rect(x + 2, y + Math.round(h / 2), w - 4, Math.round(h / 2) - 2, pal.glass);
    p.rect(x + Math.round(w / 2) - 1, y + 2, 2, h - 4, pal.woodDk);
    return;
  }
  if (kind === 'arch') {
    p.rect(x + Math.round(w * 0.3), y - 2, Math.round(w * 0.4), 3, pal.woodDk);
    p.rect(x - 1, y + 1, w + 2, h, pal.woodDk);
    p.rect(x + 1, y + 3, w - 2, Math.round(h / 2), pal.glassLt);
    p.rect(x + 1, y + 3 + Math.round(h / 2), w - 2, h - Math.round(h / 2) - 4, pal.glass);
    p.rect(x + Math.round(w / 2) - 1, y + 3, 2, h - 4, pal.woodDk);
    return;
  }
  p.rect(x - 2, y - 2, w + 4, h + 4, pal.woodDk);
  p.rect(x, y, w, h, pal.glass);
  p.rect(x, y, w, Math.round(h / 2), pal.glassLt);
  p.rect(x, y + h - 3, w, 3, pal.glassDk);
  const cols = w >= 24 ? 3 : 2;
  for (let i = 1; i < cols; i++) p.rect(x + Math.round((i * w) / cols) - 1, y, 2, h, pal.woodDk);
  if (h >= 13) p.rect(x, y + Math.round(h / 2) - 1, w, 2, pal.woodDk);
}

function drawDoor(c: Ctx, x: number, y: number, w: number, h: number, kind: DoorKind): void {
  const { p, pal } = c;
  if (kind === 'arch') {
    p.rect(x + Math.round(w * 0.28), y - 4, Math.round(w * 0.44), 3, pal.woodDk);
    p.rect(x - 1, y - 2, w + 2, h + 2, pal.woodDk);
    p.rect(x + 1, y + 1, w - 2, h - 1, pal.wood);
  } else {
    p.rect(x - 2, y - 2, w + 4, h + 2, pal.woodDk);
    p.rect(x, y, w, h, pal.wood);
  }
  p.rect(x + 2, y + 2, w - 4, Math.max(3, Math.round(h * 0.28)), pal.glassDk);
  p.rect(x + 2, y + 2, w - 4, 2, pal.glass);
  if (kind === 'wide') p.rect(x + Math.round(w / 2) - 1, y, 2, h, pal.woodDk);
  p.rect(x + w - 3, y + Math.round(h * 0.6), 2, 3, pal.gold);
}

const DOOR_W: Record<DoorKind, number> = { mid: 13, std: 16, wide: 26, arch: 18 };
const WIN_W: Record<WindowKind, number> = { big: 22, lg: 26, arch: 20, round: 18 };

function drawBuilding(c: Ctx, b: BuildingSpec): void {
  const { p, pal } = c;
  const x = b.tx * TILE, y = b.ty * TILE, w = b.tw * TILE, h = b.th * TILE;
  const col = c.roofs[b.color];
  const rh = Math.max(9, Math.round(h * ROOF_RATIO[b.roof]));

  p.rect(x + 2, y + h - 2, w - 4, 3, pal.shadow);
  if (b.chimney) {
    p.rect(x + w - 14, y + 2, 7, 11, pal.brickDk);
    p.rect(x + w - 15, y, 9, 3, pal.rock);
  }
  ROOFS[b.roof](c, x, y, w, rh, col);

  const wy = y + rh + 3, wh = h - rh - 6;
  p.rect(x + 2, wy, w - 4, wh, pal.wall);
  for (let i = 1; i * 7 < wh; i++) p.rect(x + 2, wy + i * 7, w - 4, 1, pal.wallDk);
  p.rect(x + 2, wy, 2, wh, pal.wallSh);
  p.rect(x + w - 4, wy, 2, wh, pal.wallSh);
  p.rect(x + 2, wy + wh - 2, w - 4, 2, pal.wallSh);

  if (b.awning) {
    p.rect(x + 1, wy, w - 2, 6, col[0]);
    for (let i = 0; i * 8 < w - 2; i++) p.rect(x + 2 + i * 8, wy, 4, 6, pal.wall);
    p.rect(x + 1, wy, w - 2, 2, col[2]);
  }
  if (b.sign) {
    const sw = Math.min(22, Math.round(w * 0.42));
    const cx = x + Math.round(w / 2);
    p.rect(cx - 1, y + rh - 14, 2, 6, pal.woodDk);
    p.rect(cx - Math.round(sw / 2), y + rh - 9, sw, 7, pal.gold);
    p.rect(cx - Math.round(sw / 2), y + rh - 4, sw, 2, pal.goldDk);
  }

  // Windows and door are laid out from the space actually available, so they
  // can never overlap the way a fixed offset would.
  const top = wy + (b.awning ? 9 : 4);
  const avail = wh - (top - wy) - 3;
  const dw = Math.min(DOOR_W[b.door], Math.round(w * 0.38));
  const dh = Math.min(Math.round(avail * 0.78), Math.round(wh * 0.62));
  const dy = wy + wh - dh - 2;

  if (w >= 60) {
    const ww = Math.min(WIN_W[b.win], Math.floor((w - dw) / 2) - 11);
    const ih = Math.min(Math.round(ww * 0.8), dy - top - 3);
    if (ww >= 14 && ih >= 9) {
      drawWindow(c, x + 7, top, ww, ih, b.win);
      drawWindow(c, x + w - 7 - ww, top, ww, ih, b.win);
    }
    drawDoor(c, x + Math.round(w / 2) - Math.round(dw / 2), dy, dw, dh, b.door);
  } else {
    const dx = x + w - dw - 6;
    const ww = Math.min(WIN_W[b.win], dx - x - 11);
    const ih = Math.min(Math.round(ww * 0.75), avail - 2);
    if (ww >= 11 && ih >= 8) drawWindow(c, x + 6, top + 1, ww, ih, b.win);
    drawDoor(c, dx, dy, dw, dh, b.door);
  }
}

function drawGreenhouse(c: Ctx): void {
  const { p, pal } = c;
  const x = GREENHOUSE.tx * TILE, y = GREENHOUSE.ty * TILE;
  const w = GREENHOUSE.tw * TILE, h = GREENHOUSE.th * TILE;
  p.rect(x + 2, y + h - 2, w - 4, 3, pal.shadow);
  p.rect(x + Math.round(w / 2) - 7, y + 1, 14, 4, pal.glass);
  p.rect(x + 5, y + 4, w - 10, 4, pal.glass);
  p.rect(x + 1, y + 7, w - 2, h - 10, pal.glass);
  p.rect(x + 1, y + 7, w - 2, 2, pal.glassLt);
  for (let i = 1; i < 4; i++) p.rect(x + 1 + Math.round((i * (w - 2)) / 4), y + 7, 1, h - 10, c.roofs.f[0]);
  for (let i = 0; i < 3; i++) {
    const bx = x + 5 + i * Math.round((w - 12) / 3);
    p.rect(bx, y + h - 13, 7, 8, pal.leafDk);
    p.rect(bx + 1, y + h - 14, 5, 7, pal.leaf);
  }
  p.rect(x + 1, y + h - 3, w - 2, 2, pal.woodDk);
}

function drawFountain(c: Ctx): void {
  const { p, pal } = c;
  const cx = FOUNTAIN.tx * TILE, cy = FOUNTAIN.ty * TILE;
  p.rect(cx - 34, cy - 20, 68, 48, pal.shadow);
  p.rect(cx - 32, cy - 18, 64, 42, pal.stoneDk);
  p.rect(cx - 30, cy - 16, 60, 38, pal.stoneLt);
  p.rect(cx - 27, cy - 13, 54, 32, pal.water);
  p.rect(cx - 27, cy - 13, 54, 3, pal.foam);
  for (let i = 0; i < 6; i++) p.rect(cx - 22 + i * 8, cy - 2 + (i % 2) * 4, 5, 1, pal.waterLt);
  p.rect(cx - 16, cy - 12, 32, 18, pal.stoneDk);
  p.rect(cx - 14, cy - 10, 28, 14, pal.stoneLt);
  p.rect(cx - 11, cy - 8, 22, 9, pal.water);
  p.rect(cx - 11, cy - 8, 22, 2, pal.foam);
  p.rect(cx - 5, cy - 22, 10, 14, pal.stoneDk);
  p.rect(cx - 4, cy - 22, 8, 12, pal.stoneLt);
  p.rect(cx - 7, cy - 25, 14, 4, pal.stoneDk);
  p.rect(cx - 6, cy - 25, 12, 2, pal.stoneLt);
  // Cat on the column.
  p.rect(cx - 6, cy - 34, 3, 4, pal.stoneDk);
  p.rect(cx + 3, cy - 34, 3, 4, pal.stoneDk);
  p.rect(cx - 7, cy - 32, 14, 10, pal.stoneDk);
  p.rect(cx - 6, cy - 32, 12, 8, pal.stoneLt);
  p.rect(cx - 4, cy - 29, 2, 2, pal.rockDk);
  p.rect(cx + 2, cy - 29, 2, 2, pal.rockDk);
  p.rect(cx - 3, cy - 25, 6, 4, pal.stoneDk);
  p.rect(cx + 6, cy - 28, 3, 8, pal.stoneDk);
  p.rect(cx - 14, cy - 18, 2, 7, pal.foam);
  p.rect(cx + 12, cy - 18, 2, 7, pal.foam);
  p.rect(cx - 19, cy - 14, 2, 5, pal.foam);
  p.rect(cx + 17, cy - 14, 2, 5, pal.foam);
}

function drawWaterfall(c: Ctx): void {
  for (let i = 0; i < 3; i++) c.p.rect(34 * TILE + 1 + i * 3, 3 * TILE, 2, 5 * TILE, c.pal.foam);
  c.p.rect(34 * TILE, 8 * TILE - 1, 3 * TILE, 2, c.pal.foam);
}

function drawPlotSigns(c: Ctx): void {
  EMPTY_PLOTS.forEach((r) => {
    const x = r.tx * TILE, y = r.ty * TILE;
    c.p.rect(x - 1, y - 8, 2, 6, c.pal.woodDk);
    c.p.rect(x - 5, y - 13, 10, 6, c.pal.wood);
    c.p.rect(x - 3, y - 11, 6, 1, c.pal.woodDk);
  });
}

/**
 * Cats wandering the town, drawn from the 9x11 mini sprites.
 *
 * Kept separate from `drawTown` because it is the only thing that changes
 * between frames: the town is painted once into an offscreen layer and blitted,
 * and only this runs per frame.
 */
export function drawRoamers(
  painter: Painter,
  roamers: Roamer[],
  night: boolean
): void {
  for (const r of roamers) {
    const spec = getCat(r.catId);
    if (!spec) continue;

    const grid = getMiniCatGrid(spec, r.dir);
    const palette = PALETTES[spec.palette];

    // Mini grids are trimmed to their own ink, so each cat's size depends on
    // its pose — read the bounds rather than assuming a fixed sprite box.
    const w = grid[0]?.length ?? 0;
    const h = grid.length;

    // Feet sit on the tile centre, so the cat stands on the path rather than
    // hanging off its top-left corner.
    const ox = Math.round(r.tx * TILE + TILE / 2 - w / 2);
    const oy = Math.round(r.ty * TILE + TILE / 2 - h + 2);

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const key = grid[y][x];
        if (!key || key === '.') continue;
        const raw = (palette as Record<string, string>)[key] ?? palette.B;
        painter.rect(ox + x, oy + y, 1, 1, night ? dimForNight(raw) : raw);
      }
    }
  }
}

/* -------------------------------- entry -------------------------------- */

export function drawTown(
  painter: Painter,
  pal: TownPalette,
  roofs: Record<RoofKey, RoofColor>,
  grid: Tile[][],
  opts: { night?: boolean } = {}
): void {
  const c: Ctx = { p: painter, pal, roofs, grid };
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) drawTile(c, tx, ty);
  drawWaterfall(c);
  drawFountain(c);
  BUILDINGS.forEach((b) => drawBuilding(c, b));
  drawGreenhouse(c);
  drawPlotSigns(c);
  // Cats are no longer part of the static town — see drawRoamers.
}
