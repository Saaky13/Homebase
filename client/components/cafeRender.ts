/**
 * Draws the café.
 *
 * Like `town/draw.ts`, every mark here is a filled axis-aligned rectangle —
 * routed through `PixelPainter` so it lands on the art grid. The café used to
 * be smooth vector work (antialiased ellipses, quadratic-curve counters, white
 * gloss bars) sitting under pixel-art cats, and the two never looked like the
 * same game.
 *
 * The scene is static for a given set of upgrades, so `CafeCanvas` records it
 * into an `SkPicture` once and replays it each frame rather than repainting a
 * few thousand rects sixty times a second.
 */

import { getTableCenters } from './cafeConfig';
import type { Ctx2D } from './skiaCanvas2d';
import { PixelPainter, noise, PX, snap } from './cafePixel';
import { drinkCupAspect, getDrinkCupSkImage } from './drinkCupImageCache';
import type { CafePalette } from '../constants/cafePalette';
import { DRINKS, DRINK_FRAME, type DrinkId } from '../constants/drinks';

/* --------------------------- scene geometry ---------------------------- */

/** Where the wall stops and the floorboards start. */
export const FLOOR_TOP = 214;
/** Countertop surface — the height cats are served across. */
export const COUNTER_TOP = 150;
const COUNTER_BOTTOM = 206;

/**
 * Where the draggable cup rests, in design-space coordinates — directly under
 * the brew machine's spout. It used to sit dead centre at x 195, which is also
 * where the queue forms; the machine needs that space for its face, and a cup
 * standing off to one side makes the drag to a cat a deliberate movement rather
 * than a straight drop down the middle.
 */
export const CUP_STATION = { x: 276, y: 146 };

export interface CafeScene {
  width: number;
  height: number;
  counterStyle: number;
  rugStyle: number;
  tableStyle: number;
  pal: CafePalette;
  night: boolean;
  boba: { classic: number; matcha: number; strawberry: number };
  /** Shop decor actually shows up in the room. */
  hasLights: boolean;
  hasPlants: boolean;
  hasArt: boolean;
}

/**
 * One spot per chair, at the exact coordinates `drawTable` paints them. These
 * used to sit a few pixels inside the chairs, which put every seated cat beside
 * its seat rather than on it.
 */
export function getSeatSpots() {
  return getTableCenters().flatMap((table) => [
    { x: table.x, y: table.y - 36, tableId: table.id, role: 'middle' as const },
    { x: table.x - 34, y: table.y - 6, tableId: table.id, role: 'left' as const },
    { x: table.x + 34, y: table.y - 6, tableId: table.id, role: 'right' as const },
  ]);
}

export function getQueueSpots(width: number) {
  const centerX = width / 2;
  // A cat is ~71 tall. At 36 apart the line stacked into one mound of ears;
  // 46 still reads as a queue but leaves each cat's face and cup clear.
  return Array.from({ length: 9 }, (_, i) => ({
    x: centerX,
    y: 268 + i * 46,
  }));
}

/* ------------------------------ entry point ---------------------------- */

export function drawCafeScene(ctx: Ctx2D, scene: CafeScene) {
  const p = new PixelPainter(ctx);

  drawFloor(p, scene);
  drawRug(p, scene);
  drawEntrance(p, scene);
  drawWall(p, scene);
  drawCounter(p, scene);
  drawTables(p, scene);
  drawFloorDetails(p, scene);
}

/**
 * The stretch between the last table and the door was dead floor. A café for
 * cats should have somewhere for a cat to flop and something to drink from.
 */
function drawFloorDetails(p: PixelPainter, { width, height, pal }: CafeScene) {
  const y = height - 152;

  // Cat bed: a padded ring with a dished cushion sunk into it.
  const bx = 56;
  p.ellipse(bx, y + 8, 36, 12, pal.softShadow);
  p.ellipse(bx, y, 35, 17, pal.rugWarmDk);
  p.ellipse(bx, y - 3, 33, 15, pal.rugWarm);
  p.ellipse(bx, y - 6, 28, 11, pal.rugWarmLt);
  p.ellipse(bx, y + 1, 24, 10, pal.rugWarmDk);
  p.ellipse(bx, y, 22, 9, pal.rugWarmField);
  p.ellipse(bx - 5, y - 2, 12, 4, pal.fringe);

  // Bowls: water and biscuits, on a mat.
  const wx = width - 58;
  p.softRect(wx - 32, y - 14, 64, 30, pal.woodDk, PX * 2);
  p.softRect(wx - 28, y - 10, 56, 22, pal.wains, PX * 2);
  p.softRect(wx - 24, y - 6, 48, 14, pal.wainsLt, PX * 2);

  p.ellipse(wx - 14, y + 3, 14, 6, pal.woodDkr);
  p.ellipse(wx - 14, y, 14, 7, pal.slabDk);
  p.ellipse(wx - 14, y - 1, 12, 5, pal.slabLt);
  p.ellipse(wx - 14, y, 9, 3, pal.sky);

  p.ellipse(wx + 14, y + 3, 14, 6, pal.woodDkr);
  p.ellipse(wx + 14, y, 14, 7, pal.slabDk);
  p.ellipse(wx + 14, y - 1, 12, 5, pal.slabLt);
  p.ellipse(wx + 14, y, 9, 3, pal.classic);
  p.rect(wx + 9, y - 2, 3, 3, pal.pearl);
  p.rect(wx + 15, y - 1, 3, 3, pal.pearl);
}

/* -------------------------------- floor -------------------------------- */

/**
 * Horizontal boards with staggered end-joints. The old floor was a 32px
 * gridline mesh at 8–14% opacity, which mostly just added noise underneath the
 * sprites; planks give the room a direction and a material instead.
 */
function drawFloor(p: PixelPainter, { width, height, pal }: CafeScene) {
  const board = 18;

  p.rect(0, FLOOR_TOP, width, height - FLOOR_TOP, pal.floor);

  let row = 0;
  for (let y = FLOOR_TOP; y < height; y += board, row++) {
    const h = Math.min(board, height - y);

    // Boards alternate tone slightly so the floor isn't one flat slab.
    const tone = noise(0, row, 3);
    if (tone > 0.72) p.rect(0, y, width, h, pal.floorLt);
    else if (tone < 0.3) p.rect(0, y, width, h, pal.floorDk);

    // Grain: a couple of long, faint scratches per board.
    const grains = 2;
    for (let g = 0; g < grains; g++) {
      const gx = noise(row, g, 11) * width;
      const gw = 20 + noise(row, g, 12) * 60;
      const gy = y + PX * 2 + Math.floor(noise(row, g, 13) * 5) * PX;
      if (gy < y + h - PX) p.rect(gx, gy, gw, PX, pal.floorDk);
    }

    // Seam under each board, plus one staggered end-joint.
    p.rect(0, y + h - PX, width, PX, pal.seam);
    const joint = 40 + noise(row, 0, 7) * (width - 80);
    p.rect(joint, y, PX, h - PX, pal.seam);
  }
}

/* --------------------------------- rug --------------------------------- */

/**
 * The walkway the queue stands on. It used to be a 74px rounded rectangle —
 * literally a brown pill running the length of the room. A woven border, a
 * repeating motif and fringed ends cost about thirty rects and make it a rug.
 */
function drawRug(p: PixelPainter, { width, rugStyle, pal }: CafeScene) {
  const cx = width / 2;
  const w = rugStyle === 2 ? 88 : 76;
  const top = 246;
  const bottom = 668;
  const x = cx - w / 2;
  const h = bottom - top;

  // The rug carries the room's only cool hue, which is what separates it from
  // the boards. As a terracotta slab it was the same family as the floor and
  // read as one giant plank down the middle.
  const border = rugStyle === 2 ? pal.rugWarm : pal.rug;
  const edge = rugStyle === 2 ? pal.rugWarmDk : pal.rugDk;
  const field = rugStyle === 2 ? pal.rugWarmField : pal.rugField;
  const weave = rugStyle === 2 ? pal.rugWarmFieldDk : pal.rugFieldDk;
  const bandColor = rugStyle === 2 ? pal.rugWarmLt : pal.rugLt;

  for (let fx = x + 4; fx < x + w - 4; fx += 8) {
    p.rect(fx, top - 7, 4, 7, pal.fringe);
    p.rect(fx, bottom, 4, 7, pal.fringe);
  }

  // Border, then a hairline of the darker tone, then the open field.
  p.rect(x, top, w, h, border);
  p.rect(x + 5, top + 5, w - 10, h - 10, edge);
  p.rect(x + 7, top + 7, w - 14, h - 14, field);

  // Offset dashes across the field: a flat fill this large reads as painted
  // floor, and the weave is what makes it fabric.
  for (let row = 0, wy = top + 9; wy < bottom - 10; wy += 4, row++) {
    for (let wx = x + 9 + (row % 2 ? 4 : 0); wx < x + w - 12; wx += 8) {
      p.rect(wx, wy, 4, 2, weave);
    }
  }

  if (rugStyle === 2) {
    // Banded at the two ends only. Stripes repeated the whole way down turned
    // the runner into a ladder — the eye counted rungs instead of reading rug.
    [top + 24, bottom - 41].forEach((sy) => {
      p.rect(x + 7, sy, w - 14, 2, edge);
      p.rect(x + 7, sy + 4, w - 14, 7, bandColor);
      p.rect(x + 7, sy + 13, w - 14, 2, edge);
    });

    for (let sy = top + 118; sy < bottom - 118; sy += 132) {
      drawRugDiamond(p, cx, sy, edge, field, bandColor);
    }
    return;
  }

  // An inner guide line, then diamonds down the centre. The motif is drawn in
  // the rug's darkest tone — at the field's own lightness it disappeared.
  p.rect(x + 12, top + 12, w - 24, 2, edge);
  p.rect(x + 12, bottom - 14, w - 24, 2, edge);

  for (let sy = top + 46; sy < bottom - 46; sy += 88) {
    drawRugDiamond(p, cx, sy, edge, field, bandColor);
    p.rect(x + 14, sy + 9, 5, 5, bandColor);
    p.rect(x + w - 19, sy + 9, 5, 5, bandColor);
  }
}

/** Outline diamond: drawn solid, then carved back to the field colour. */
function drawRugDiamond(
  p: PixelPainter,
  cx: number,
  sy: number,
  edge: string,
  field: string,
  centre: string
) {
  for (let i = 0; i < 8; i++) {
    const half = (i < 4 ? i + 1 : 8 - i) * 3;
    p.rect(cx - half, sy + i * 3, half * 2, 3, edge);
  }
  for (let i = 1; i < 7; i++) {
    const half = (i < 4 ? i : 7 - i) * 3;
    if (half > 0) p.rect(cx - half, sy + i * 3, half * 2, 3, field);
  }
  p.rect(cx - 3, sy + 9, 6, 6, centre);
}

/* ------------------------------- entrance ------------------------------ */

/** Cats spawn at the bottom of the screen, so there is now a door there. */
function drawEntrance(p: PixelPainter, { width, height, pal }: CafeScene) {
  const cx = width / 2;
  const doorW = 104;
  const x = cx - doorW / 2;
  const y = height - 78;

  // Mat.
  p.softRect(cx - 52, y - 26, 104, 22, pal.rug, 4);
  p.softRect(cx - 47, y - 22, 94, 14, pal.rugField, 4);
  for (let mx = cx - 40; mx < cx + 40; mx += 10) p.rect(mx, y - 20, 4, 10, pal.rugLt);

  // Frame and threshold.
  p.rect(x - 8, y - 6, doorW + 16, 6, pal.woodDkr);
  p.rect(x - 6, y, doorW + 12, height - y, pal.woodDk);
  p.rect(x, y + 4, doorW, height - y - 4, pal.wood);

  // Two glazed panels, the light from outside spilling in.
  const paneW = (doorW - 18) / 2;
  [x + 6, x + 12 + paneW].forEach((px) => {
    p.rect(px, y + 10, paneW, 40, pal.woodDkr);
    p.rect(px + 2, y + 12, paneW - 4, 36, pal.sky);
    p.rect(px + 2, y + 12, paneW - 4, 16, pal.skyLt);
    p.rect(px + 2, y + 28, paneW - 4, 2, pal.woodDk);
  });

  // Handles.
  p.rect(cx - 8, y + 56, 4, 10, pal.gold);
  p.rect(cx + 4, y + 56, 4, 10, pal.gold);

  drawPottedPlant(p, 32, height - 40, pal, 1.15);
  drawPottedPlant(p, width - 32, height - 40, pal, 1.15);
}

/* --------------------------------- wall -------------------------------- */

function drawWall(p: PixelPainter, scene: CafeScene) {
  const { width, pal } = scene;

  p.rect(0, 0, width, FLOOR_TOP, pal.wall);

  // Crown moulding.
  p.rect(0, 0, width, 6, pal.crownDk);
  p.rect(0, 6, width, 4, pal.crown);

  // Faint plaster courses, the same trick the town uses on building walls.
  for (let y = 20; y < 104; y += 16) p.rect(0, y, width, PX, pal.wallDk);

  // Picture rail, then the lower wall in a slightly deeper tone.
  p.rect(0, 104, width, 4, pal.crown);
  p.rect(0, 108, width, FLOOR_TOP - 108, pal.wallDk);
  p.rect(0, 108, width, 2, pal.crownDk);

  drawWindow(p, 16, 20, 118, 68, scene);
  drawWindow(p, width - 134, 20, 118, 68, scene);

  // The board hangs *above* the brew machine now rather than filling the whole
  // gap between the windows — menu up top, equipment below it, which is how a
  // counter actually reads. It lost its bottom half and one menu line to make
  // room; the machine is the thing you look at.
  drawMenuBoard(p, 152, 12, 92, 44, pal);

  // One picture, in the only pocket of wall the machine left clear: right of
  // its spout, above the counter, left of the register. This used to be three
  // small frames across the lower wall, which is now equipment the whole way.
  if (scene.hasArt) {
    drawFramedArt(p, 302, 92, 28, 1, pal);
  }

  if (scene.hasLights) {
    drawStringLights(p, width, pal);
  }

  // Hanging plants soften the top corners; the shop's plant decor puts two
  // more on the floor at the ends of the counter.
  drawHangingPlant(p, 74, 0, pal);
  drawHangingPlant(p, width - 74, 0, pal);
  if (scene.hasPlants) {
    drawPottedPlant(p, 22, FLOOR_TOP + 28, pal, 0.85);
    drawPottedPlant(p, width - 22, FLOOR_TOP + 28, pal, 0.85);
  }
}

/**
 * A window onto the town. The view is the same world the map screen shows —
 * rooftops, a hill, a tree line — so the café reads as being *in* the town
 * rather than floating somewhere adjacent to it.
 */
function drawWindow(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  h: number,
  { pal, night }: CafeScene
) {
  // Frame.
  p.rect(x - 4, y - 4, w + 8, h + 8, pal.woodDk);
  p.rect(x - 2, y - 2, w + 4, h + 4, pal.wood);

  // Sky.
  p.rect(x, y, w, h, pal.sky);
  p.rect(x, y, w, Math.round(h * 0.42), pal.skyLt);

  if (night) {
    // Stars, seeded on position so they never crawl between frames.
    for (let i = 0; i < 14; i++) {
      const sx = x + 4 + noise(x, i, 31) * (w - 8);
      const sy = y + 3 + noise(x, i, 32) * (h * 0.5);
      p.rect(sx, sy, PX, PX, noise(x, i, 33) > 0.6 ? pal.cream : pal.chalkDim);
    }
    // Moon.
    p.ellipse(x + w - 22, y + 16, 8, 8, pal.cream);
    p.ellipse(x + w - 18, y + 13, 6, 6, pal.sky);
  } else {
    // Clouds.
    p.softRect(x + 12, y + 10, 30, 10, pal.cream, PX);
    p.softRect(x + 24, y + 6, 20, 8, pal.cream, PX);
    p.softRect(x + w - 40, y + 20, 24, 8, pal.cream, PX);
  }

  // Hills behind the rooftops.
  const hy = y + Math.round(h * 0.52);
  p.ellipse(x + 24, hy + 16, 40, 22, pal.hillDk);
  p.ellipse(x + w - 20, hy + 18, 44, 24, pal.hillDk);
  p.rect(x, hy + 22, w, h - (hy - y) - 22, pal.hill);

  // Rooftops — three houses, the middle one taller.
  const roofs: [number, number, number][] = [
    [x + 8, hy + 6, 26],
    [x + 40, hy - 2, 32],
    [x + 80, hy + 8, 24],
  ];
  roofs.forEach(([rx, ry, rw], i) => {
    const bodyH = y + h - ry - 8;
    if (bodyH <= 6) return;

    p.rect(rx, ry + 8, rw, bodyH, pal.farWall);
    // Pitched roof, one step per art pixel.
    for (let s = 0; s < 8; s += PX) {
      const inset = Math.round((rw / 2) * (s / 8));
      p.rect(rx + inset, ry + s, rw - inset * 2, PX, pal.farRoof);
    }
    // Lit windows.
    const lit = night || noise(rx, i, 41) > 0.5;
    p.rect(rx + 6, ry + 14, 6, 6, lit ? pal.farLit : pal.hillDk);
    if (rw > 26) p.rect(rx + rw - 12, ry + 14, 6, 6, lit ? pal.farLit : pal.hillDk);
  });

  // Mullions last, so they sit over the view.
  p.rect(x + Math.round(w / 2) - 2, y, 4, h, pal.wood);
  p.rect(x, y + Math.round(h / 2) - 2, w, 4, pal.wood);

  // Sill.
  p.rect(x - 8, y + h + 4, w + 16, 6, pal.woodDk);
  p.rect(x - 8, y + h + 4, w + 16, 2, pal.woodLt);
}

/**
 * The menu. There is no text rendering in the Skia shim and none is wanted —
 * chalk strokes read as a handwritten board at this size, and never need
 * translating.
 */
function drawMenuBoard(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: CafePalette
) {
  p.rect(x - 4, y - 4, w + 8, h + 8, pal.boardEdge);
  p.rect(x - 2, y - 2, w + 4, h + 4, pal.wood);
  p.rect(x, y, w, h, pal.board);

  // Header, underlined.
  p.rect(x + 16, y + 7, w - 32, 5, pal.chalk);
  p.rect(x + 10, y + 15, w - 20, 2, pal.chalkDim);

  // Menu lines: a price column on the right of each. Three, not four — the
  // board is half the height it was and a squeezed fourth line just read as
  // noise at this size.
  const lines = [0.62, 0.5, 0.7];
  lines.forEach((frac, i) => {
    const ly = y + 22 + i * 8;
    p.rect(x + 10, ly, (w - 30) * frac, 3, pal.chalkDim);
    p.rect(x + w - 18, ly, 8, 3, pal.chalk);
  });
}

/** Three small frames, each with a different scrap of a picture inside. */
function drawFramedArt(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  variant: number,
  pal: CafePalette
) {
  const h = 24;

  p.rect(x, y, w, h, pal.goldDk);
  p.rect(x + 2, y + 2, w - 4, h - 4, pal.gold);
  p.rect(x + 4, y + 4, w - 8, h - 8, pal.skyLt);

  const ix = x + 4;
  const iy = y + 4;
  const iw = w - 8;
  const ih = h - 8;

  if (variant === 0) {
    // Hills and a sun.
    p.ellipse(ix + 6, iy + 5, 4, 4, pal.gold);
    p.ellipse(ix + 6, iy + ih, 12, 7, pal.leafDk);
    p.ellipse(ix + iw - 4, iy + ih, 12, 6, pal.leaf);
    return;
  }

  if (variant === 1) {
    // A cat silhouette.
    p.rect(ix + 7, iy + 6, 8, 8, pal.dark);
    p.rect(ix + 7, iy + 3, 2, 4, pal.dark);
    p.rect(ix + 13, iy + 3, 2, 4, pal.dark);
    p.rect(ix + 15, iy + 8, 5, 2, pal.dark);
    p.rect(ix + 4, iy + ih - 2, iw - 8, 2, pal.hill);
    return;
  }

  // A cup of something warm.
  p.rect(ix + 7, iy + 5, 8, 9, pal.cream);
  p.rect(ix + 7, iy + 5, 8, 3, pal.classic);
  p.rect(ix + 15, iy + 7, 3, 4, pal.woodDk);
  p.rect(ix + 5, iy + 14, 12, 2, pal.woodDk);
}

function drawStringLights(p: PixelPainter, width: number, pal: CafePalette) {
  // The wire sags between anchor points; each bulb hangs from where it sits.
  const span = 52;
  for (let x = 0; x <= width; x += PX * 2) {
    const t = ((x % span) / span) * 2 - 1;
    const y = 12 + (1 - t * t) * 9;
    p.rect(x, y, PX * 2, PX, pal.wire);
  }
  for (let x = span / 2; x < width; x += span) {
    const y = 21;
    p.rect(x - PX, y, PX * 2, 4, pal.wire);
    p.ellipse(x, y + 8, 5, 6, pal.bulb);
    p.rect(x - 2, y + 5, 3, 3, pal.bulbGlow);
  }
}

function drawHangingPlant(p: PixelPainter, cx: number, top: number, pal: CafePalette) {
  p.rect(cx - PX, top, PX * 2, 16, pal.wire);
  p.rect(cx - 12, top + 16, 24, 12, pal.potDk);
  p.rect(cx - 10, top + 16, 20, 4, pal.pot);

  // Trailing vines of uneven length — even ones look like a comb.
  const vines = [-8, -3, 2, 7];
  vines.forEach((ox, i) => {
    const len = 14 + Math.floor(noise(cx, i, 17) * 22);
    for (let y = 0; y < len; y += 4) {
      const wobble = Math.round(Math.sin((y + i * 3) / 5) * 2 / PX) * PX;
      p.rect(cx + ox + wobble, top + 28 + y, 3, 4, i % 2 ? pal.leaf : pal.leafDk);
      if (y % 12 === 0) p.rect(cx + ox + wobble - 2, top + 28 + y, 3, 3, pal.leafLt);
    }
  });
}

function drawPottedPlant(
  p: PixelPainter,
  cx: number,
  baseY: number,
  pal: CafePalette,
  scale = 1
) {
  const s = (v: number) => Math.round(v * scale);

  p.ellipse(cx, baseY + s(2), s(18), s(6), pal.softShadow);
  p.rect(cx - s(14), baseY - s(20), s(28), s(22), pal.potDk);
  p.rect(cx - s(12), baseY - s(20), s(24), s(18), pal.pot);
  p.rect(cx - s(16), baseY - s(24), s(32), s(6), pal.potDk);
  p.rect(cx - s(14), baseY - s(24), s(28), s(3), pal.pot);

  // Leaves fan out from the pot rim.
  const fronds: [number, number, number][] = [
    [-12, -46, -1], [-5, -56, 0], [4, -54, 0], [12, -44, 1], [0, -38, 0],
  ];
  fronds.forEach(([ox, oy, lean], i) => {
    const tipX = cx + s(ox) + s(lean * 6);
    const tipY = baseY + s(oy);
    const steps = 7;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const x = cx + s(ox) * t + s(lean * 6) * t * t;
      const y = baseY - s(24) + (tipY - (baseY - s(24))) * t;
      const wide = s(3 + Math.sin(t * Math.PI) * 5);
      p.rect(x - wide / 2, y, wide, s(6), i % 2 ? pal.leaf : pal.leafDk);
    }
    p.rect(tipX - s(2), tipY, s(4), s(5), pal.leafLt);
  });
}

/* ------------------------------- counter ------------------------------- */

function drawCounter(p: PixelPainter, scene: CafeScene) {
  const { width, counterStyle, pal } = scene;
  const rich = counterStyle === 2;
  const inset = rich ? 0 : 14;
  const x = inset;
  const w = width - inset * 2;

  drawBacksplash(p, x, 128, w, 22, pal, rich);

  // Countertop slab. The overhanging lip and the shadow it casts are what stop
  // the front face reading as a flat wall.
  p.rect(x, COUNTER_TOP, w, 12, pal.slabDk);
  p.rect(x, COUNTER_TOP, w, 9, pal.slab);
  p.rect(x, COUNTER_TOP, w, 3, pal.slabLt);
  p.rect(x, COUNTER_TOP + 12, w, 3, pal.counterDk);

  // Front face, with recessed panels rather than a single plane.
  const faceTop = COUNTER_TOP + 15;
  const faceH = COUNTER_BOTTOM - 8 - faceTop;
  p.rect(x, faceTop, w, faceH, pal.counter);
  p.rect(x, faceTop, w, 2, pal.counterLt);

  const panelCount = rich ? 5 : 4;
  const pad = 10;
  const gap = 8;
  const panelW = (w - pad * 2 - gap * (panelCount - 1)) / panelCount;
  for (let i = 0; i < panelCount; i++) {
    const px = x + pad + i * (panelW + gap);
    const py = faceTop + 8;
    const ph = faceH - 16;
    p.rect(px, py, panelW, ph, pal.counterDk);
    p.rect(px + 2, py + 2, panelW - 4, ph - 4, pal.counter);
    p.rect(px + 2, py + 2, panelW - 4, 2, pal.counterLt);
    if (rich) p.rect(px + 6, py + 6, panelW - 12, 2, pal.goldDk);
  }

  if (rich) {
    // A brass kick rail on the upgraded counter.
    p.rect(x, COUNTER_BOTTOM - 12, w, 3, pal.goldDk);
    p.rect(x, COUNTER_BOTTOM - 12, w, 2, pal.gold);
  }

  // Base and the shadow it throws onto the boards.
  p.rect(x, COUNTER_BOTTOM - 8, w, 8, pal.counterDk);
  p.rect(x, COUNTER_BOTTOM, w, 5, pal.shadow);
  p.rect(0, COUNTER_BOTTOM + 5, width, 3, pal.softShadow);

  // Left to right: jars, espresso, then the 102-wide gap the brew machine
  // stands in (148-250, drawn per-frame — see `drawBrewMachine`), the cup
  // under its spout, and the register. The jars and the espresso machine both
  // moved left to open that gap; they used to sit at 128 and 34.
  drawBobaJars(p, 12, COUNTER_TOP, scene);
  drawEspressoMachine(p, 74, COUNTER_TOP, pal);
  drawRegister(p, width - 62, COUNTER_TOP, pal);
  drawCupStation(p, CUP_STATION.x, COUNTER_TOP, pal);
}

/** Small square tiles behind the counter — the one place a grid belongs. */
function drawBacksplash(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: CafePalette,
  rich: boolean
) {
  p.rect(x, y, w, h, pal.slabDk);
  const tile = 10;
  for (let ty = 0; ty < h; ty += tile) {
    // Offset alternate courses, the way tile actually gets laid.
    const off = (ty / tile) % 2 ? tile / 2 : 0;
    for (let tx = -tile; tx < w + tile; tx += tile) {
      const accent = rich && noise(tx, ty, 5) > 0.82;
      p.rect(x + tx + off + PX, y + ty + PX, tile - PX * 2, tile - PX * 2,
        accent ? pal.mint : pal.slab);
    }
  }
  p.rect(x, y, w, PX, pal.slabDk);
}

function drawEspressoMachine(p: PixelPainter, x: number, topY: number, pal: CafePalette) {
  const w = 72;
  const h = 44;
  const y = topY - h;

  // Body.
  p.rect(x, y + 6, w, h - 6, pal.metalDk);
  p.rect(x + 2, y + 8, w - 4, h - 10, pal.metal);
  p.rect(x + 2, y + 8, w - 4, 6, pal.metalLt);

  // Warming tray on top, with two cups waiting on it.
  p.rect(x - 2, y, w + 4, 8, pal.metalDk);
  p.rect(x, y + 2, w, 4, pal.metalLt);
  p.rect(x + 12, y - 8, 10, 8, pal.cream);
  p.rect(x + 12, y - 8, 10, 2, pal.slabLt);
  p.rect(x + 30, y - 8, 10, 8, pal.cream);
  p.rect(x + 30, y - 8, 10, 2, pal.slabLt);

  // Pressure gauge and indicator lamp.
  p.ellipse(x + 15, y + 24, 8, 8, pal.metalDk);
  p.ellipse(x + 15, y + 24, 6, 6, pal.cream);
  p.rect(x + 14, y + 20, 2, 5, pal.dark);
  p.ellipse(x + 30, y + 18, 3, 3, pal.berry);

  // Group head and portafilter, with a cup catching the shot.
  p.rect(x + 42, y + 18, 18, 8, pal.metalDk);
  p.rect(x + 46, y + 26, 10, 4, pal.dark);
  p.rect(x + 40, y + 28, 22, 3, pal.metalDk);
  p.rect(x + 45, y + 33, 12, 8, pal.cream);
  p.rect(x + 45, y + 33, 12, 3, pal.classic);

  // Steam wand.
  p.rect(x + w - 6, y + 14, 3, 16, pal.metalLt);
  p.rect(x + w - 8, y + 28, 5, 4, pal.metalDk);

  // Drip tray.
  p.rect(x, topY - 6, w, 6, pal.metalDk);
  for (let gx = x + 4; gx < x + w - 4; gx += 6) p.rect(gx, topY - 5, 3, 3, pal.metal);
}

/**
 * Three jars, one per boba flavour, filled to match what's actually in stock.
 * A café that's out of matcha shows an empty matcha jar.
 */
function drawBobaJars(p: PixelPainter, x: number, topY: number, { pal, boba }: CafeScene) {
  const jars: [number, string][] = [
    [boba.classic, pal.classic],
    [boba.matcha, pal.matcha],
    [boba.strawberry, pal.berry],
  ];

  const jarW = 16;
  const jarH = 34;
  const gap = 6;

  jars.forEach(([amount, color], i) => {
    const jx = x + i * (jarW + gap);
    const jy = topY - jarH;

    // Glass.
    p.rect(jx, jy, jarW, jarH, pal.slabDk);
    p.rect(jx + PX, jy + PX, jarW - PX * 2, jarH - PX * 2, pal.skyLt);

    // Contents, capped so a huge stock doesn't overflow the jar.
    const fill = Math.max(0, Math.min(1, amount / 12));
    const fillH = Math.round((jarH - 10) * fill);
    if (fillH > 0) {
      const fy = jy + jarH - 4 - fillH;
      p.rect(jx + PX, fy, jarW - PX * 2, fillH, color);
      p.rect(jx + PX, fy, jarW - PX * 2, PX * 2, pal.cream);
      // Tapioca settled at the bottom.
      for (let by = jy + jarH - 10; by > jy + jarH - 10 - Math.min(fillH, 10); by -= 4) {
        p.rect(jx + 4, by, 3, 3, pal.pearl);
        p.rect(jx + 9, by - 2, 3, 3, pal.pearl);
      }
    }

    // Lid and highlight.
    p.rect(jx - 2, jy - 5, jarW + 4, 6, pal.woodDk);
    p.rect(jx - 2, jy - 5, jarW + 4, 2, pal.woodLt);
    p.rect(jx + 3, jy + 6, PX, jarH - 16, pal.cream);
  });
}

function drawRegister(p: PixelPainter, x: number, topY: number, pal: CafePalette) {
  const w = 46;
  const h = 34;
  const y = topY - h;

  p.rect(x, y + 10, w, h - 10, pal.woodDk);
  p.rect(x + 2, y + 12, w - 4, h - 14, pal.wood);

  // Screen, tilted back toward the barista.
  p.rect(x + 6, y, w - 12, 14, pal.woodDkr);
  p.rect(x + 8, y + 2, w - 16, 10, pal.board);
  p.rect(x + 10, y + 4, w - 24, 2, pal.chalkDim);
  p.rect(x + 10, y + 8, w - 28, 2, pal.chalkDim);

  // Keys.
  for (let ky = 0; ky < 2; ky++) {
    for (let kx = 0; kx < 4; kx++) {
      p.rect(x + 6 + kx * 9, y + 18 + ky * 7, 6, 5, ky === 0 ? pal.slab : pal.slabDk);
    }
  }
}

/**
 * The drip tray the draggable cup stands on, under the machine's spout. The cup
 * you actually drag is a real view on top of the canvas, so it gets touch
 * handling for free — only the tray and the counter clutter beside it are
 * painted here.
 *
 * This used to be a wooden tray dead centre with a straw jar and a stack of
 * spares around it. The machine now occupies that space, so the tray became a
 * proper grated drip tray (which is what sits under a dispenser) and the
 * clutter moved right, into the gap before the register.
 */
function drawCupStation(p: PixelPainter, cx: number, topY: number, pal: CafePalette) {
  // Grated drip tray. The slots are what make it read as draining rather than
  // as another wooden board.
  p.rect(cx - 17, topY - 8, 34, 8, pal.metalDk);
  p.rect(cx - 15, topY - 6, 30, 4, pal.metal);
  for (let gx = cx - 13; gx < cx + 13; gx += 5) p.rect(gx, topY - 6, 3, 4, pal.metalDk);
  p.rect(cx - 17, topY - 8, 34, 2, pal.metalLt);

  // Spare cups, stacked in the clear stretch before the register. The straw jar
  // that used to stand beside them is gone: the machine took its space, and the
  // only remaining gap is narrower than the jar.
  const sx = cx + 26;
  for (let i = 0; i < 3; i++) {
    p.rect(sx - i, topY - 14 - i * 4, 14 + i * 2, 5, pal.cream);
    p.rect(sx - i, topY - 14 - i * 4, 14 + i * 2, 2, pal.slabLt);
  }
}

/* -------------------------------- tables ------------------------------- */

function drawTables(p: PixelPainter, scene: CafeScene) {
  getTableCenters().forEach((table, i) => {
    drawTable(p, table.x, table.y, i, scene);
  });
}

function drawTable(
  p: PixelPainter,
  x: number,
  y: number,
  index: number,
  { tableStyle, pal }: CafeScene
) {
  const rich = tableStyle === 2;
  const rx = rich ? 32 : 29;
  const ry = rich ? 19 : 17;

  const topColor = rich ? pal.woodLt : pal.wood;
  const rimColor = rich ? pal.wood : pal.woodDk;
  // Cushions were near-white and read as blank discs against a cream tabletop.
  // Rose separates from the wood by hue rather than by brightness, which is
  // what a plush upgraded chair wants anyway.
  const chairColor = rich ? pal.seat : pal.mint;
  const chairDk = rich ? pal.seatDk : pal.leafDk;

  // Back chair first — it sits behind the table from this angle.
  drawChair(p, x, y - 36, chairColor, chairDk, pal);

  // Contact shadow.
  p.ellipse(x, y + 16, rx, 7, pal.softShadow);

  // Pedestal.
  p.rect(x - 5, y + 2, 10, 18, pal.woodDkr);
  p.rect(x - 5, y + 2, 4, 18, pal.woodDk);
  p.ellipse(x, y + 20, 14, 5, pal.woodDkr);
  p.ellipse(x, y + 19, 12, 4, pal.woodDk);

  // Top: rim, face, then a lighter crescent where the window light falls.
  p.ellipse(x, y, rx, ry, rimColor);
  p.ellipse(x, y - 2, rx - 3, ry - 3, topColor);
  p.ellipse(x - 4, y - 6, rx - 12, ry - 9, rich ? pal.slabLt : pal.woodLt);

  if (rich) p.ellipseRing(x, y - 2, rx - 3, ry - 3, 2, pal.gold);

  // Side chairs, drawn over the top edge so they read as pulled in.
  drawChair(p, x - 34, y - 6, chairColor, chairDk, pal);
  drawChair(p, x + 34, y - 6, chairColor, chairDk, pal);

  drawTableTop(p, x, y - 4, index, pal);
}

function drawChair(
  p: PixelPainter,
  x: number,
  y: number,
  seat: string,
  dark: string,
  pal: CafePalette
) {
  p.ellipse(x, y + 9, 12, 4, pal.softShadow);
  p.rect(x - 10, y - 12, 20, 8, dark);
  p.rect(x - 8, y - 10, 16, 4, seat);
  p.ellipse(x, y, 13, 8, dark);
  p.ellipse(x, y - 1, 11, 6, seat);
  p.rect(x - 7, y + 5, 3, 6, pal.woodDkr);
  p.rect(x + 4, y + 5, 3, 6, pal.woodDkr);
}

/** Every table gets something on it, so ten of them don't read as clones. */
function drawTableTop(
  p: PixelPainter,
  x: number,
  y: number,
  index: number,
  pal: CafePalette
) {
  const kind = index % 5;

  if (kind === 0) {
    // Boba cup with a straw.
    p.rect(x - 5, y - 10, 10, 14, pal.cream);
    p.rect(x - 5, y - 2, 10, 6, pal.classic);
    p.rect(x - 4, y + 1, 3, 3, pal.pearl);
    p.rect(x, y + 1, 3, 3, pal.pearl);
    p.rect(x - 6, y - 11, 12, 2, pal.slabLt);
    p.rect(x + 2, y - 17, 2, 8, pal.berry);
    return;
  }

  if (kind === 1) {
    // Bud vase.
    p.rect(x - 4, y - 6, 8, 10, pal.skyLt);
    p.rect(x - 4, y - 1, 8, 5, pal.leafLt);
    p.rect(x - 1, y - 14, 2, 9, pal.leafDk);
    p.ellipse(x, y - 16, 4, 4, pal.pink);
    p.rect(x - 1, y - 16, 2, 2, pal.gold);
    return;
  }

  if (kind === 2) {
    // Cup and saucer.
    p.ellipse(x, y + 1, 10, 4, pal.slabDk);
    p.ellipse(x, y, 9, 4, pal.cream);
    p.rect(x - 5, y - 7, 10, 7, pal.cream);
    p.rect(x - 4, y - 6, 8, 3, pal.classic);
    p.rect(x + 5, y - 5, 3, 3, pal.slabDk);
    return;
  }

  if (kind === 3) {
    // Slice of cake on a plate.
    p.ellipse(x, y + 1, 11, 4, pal.slab);
    p.rect(x - 6, y - 8, 12, 8, pal.cream);
    p.rect(x - 6, y - 5, 12, 2, pal.berry);
    p.rect(x - 6, y - 8, 12, 2, pal.pink);
    p.rect(x + 1, y - 11, 3, 3, pal.berry);
    return;
  }

  // A tealight in a holder.
  p.ellipse(x, y + 1, 7, 3, pal.woodDkr);
  p.rect(x - 4, y - 5, 8, 6, pal.gold);
  p.rect(x - 1, y - 9, 2, 4, pal.bulb);
  p.rect(x - 2, y - 12, 4, 4, pal.bulbGlow);
}

/* ------------------------- runtime-only overlays ----------------------- */

/**
 * A ring under the cat the boba cup is currently over. Drawn per-frame rather
 * than into the cached scene, since it tracks the drag.
 */
export function drawServeTarget(ctx: Ctx2D, x: number, y: number, pal: CafePalette) {
  const p = new PixelPainter(ctx);
  p.ellipse(x, y, 30, 12, pal.gold);
  p.ellipse(x, y, 25, 9, pal.bulbGlow);
  p.ellipse(x, y, 20, 7, pal.gold);
}

/* ---------------------------- the brew machine -------------------------- */

/**
 * Machine geometry, in design units. Exported because `CafeCanvas` hit-tests
 * against it: taps on a preset, the menu tab and the dispense button all resolve
 * here, so the art and the touch targets cannot drift apart the way the seat
 * spots and the chairs once did.
 *
 * The body stands on the counter at 148-250 and the cup sits under the spout to
 * its right. Everything on the face is clear of the cup, which reaches up to
 * design y ~112 — the controls stop at 110 for exactly that reason.
 */
export const BREW_MACHINE = {
  x: 148,
  y: 62,
  w: 102,
  h: 90,
  lamp: { cx: 236, cy: 69, r: 5 },
  presets: [
    { x: 154, y: 80, w: 24, h: 30 },
    { x: 181, y: 80, w: 24, h: 30 },
    { x: 208, y: 80, w: 24, h: 30 },
  ],
  menuTab: { x: 234, y: 80, w: 12, h: 30 },
  gauge: { x: 154, y: 116, w: 92, h: 10 },
  button: { x: 154, y: 130, w: 92, h: 16 },
  /** Nozzle tip, where the pour lands and the steam rises from. */
  spoutTip: { x: 276, y: 108 },
} as const;

export interface BrewPreset {
  id: DrinkId;
  /** Greyed when the player cannot pay for it. Brewing is free; the drop isn't. */
  affordable: boolean;
}

export interface BrewMachineView {
  pal: CafePalette;
  presets: BrewPreset[];
  /** Index into `presets` of the loaded recipe, or -1 when the sheet holds it. */
  selectedIndex: number;
  /** Lit when someone is waiting. With an empty queue the machine reads as off. */
  ready: boolean;
  /** 0-1. How far the hold has filled the gauge. */
  fill: number;
  /** Dispense button held down. */
  pressed: boolean;
  /** Body shake while the machine hums, in design units. Usually -1, 0 or 1. */
  shake: number;
  /** 0-1 across the puff window after a brew lands. At 0 no steam is drawn. */
  steam: number;
}

/**
 * The machine, drawn per frame rather than into the cached scene.
 *
 * Almost everything on its face is live — the lamp tracks the queue, the gauge
 * tracks a hold, the presets track what you own, and the whole body shakes while
 * it runs. Caching the shell and overlaying the rest would mean re-recording the
 * room picture on every one of those, so the machine pays its ~120 rects a frame
 * instead. That is noise next to the several thousand the room costs, which is
 * why the room is the thing that gets cached.
 */
export function drawBrewMachine(ctx: Ctx2D, m: BrewMachineView) {
  const p = new PixelPainter(ctx);
  const { pal } = m;
  const M = BREW_MACHINE;
  const dx = m.shake;
  const x = M.x + dx;
  const y = M.y;

  drawMachineSpout(p, dx, pal, m.ready);

  // Shell. The wood cap is what keeps it from reading as a fridge — every other
  // warm object in the room has a wooden top.
  p.rect(x - 2, y + 6, M.w + 4, M.h - 6, pal.metalDk);
  p.rect(x, y + 8, M.w, M.h - 12, pal.metal);
  p.rect(x, y + 8, M.w, 3, pal.metalLt);
  p.rect(x, y + M.h - 10, M.w, 4, pal.metalDk);

  // Wood side posts. Without them the machine is a grey box standing next to
  // the espresso machine's grey box, and the two read as one long metal band
  // across the counter. Framing it top, sides and plinth in wood is what makes
  // it a separate piece of furniture rather than more of the same appliance.
  p.rect(x - 4, y + 6, 6, M.h - 6, pal.woodDk);
  p.rect(x + M.w - 2, y + 6, 6, M.h - 6, pal.woodDk);
  p.rect(x - 4, y + 6, 2, M.h - 6, pal.woodLt);
  p.rect(x + M.w + 2, y + 6, 2, M.h - 6, pal.woodDkr);

  // Cap.
  p.rect(x - 4, y, M.w + 8, 12, pal.woodDk);
  p.rect(x - 4, y, M.w + 8, 3, pal.woodLt);
  p.rect(x - 2, y + 10, M.w + 4, 2, pal.woodDkr);

  drawMachineLamp(p, dx, pal, m.ready);

  // Recessed face the controls sit in.
  p.rect(x + 4, y + 16, M.w - 8, M.h - 28, pal.metalDk);
  p.rect(x + 5, y + 17, M.w - 10, M.h - 30, pal.metal);

  m.presets.forEach((preset, i) => {
    const cell = M.presets[i];
    if (!cell) return;
    drawPresetCell(p, ctx, cell, dx, preset, i === m.selectedIndex, pal);
  });
  for (let i = m.presets.length; i < M.presets.length; i++) {
    drawEmptyCell(p, M.presets[i], dx, pal);
  }

  drawMenuTab(p, dx, pal);
  drawGauge(p, dx, m.fill, m.ready, pal);
  drawDispenseButton(p, dx, m.pressed, m.ready, pal);

  // Plinth, and the shadow the machine throws down the backsplash.
  p.rect(x - 4, y + M.h - 6, M.w + 8, 6, pal.woodDkr);
  p.rect(x - 4, y + M.h - 6, M.w + 8, 2, pal.woodDk);
  p.rect(x + M.w + 4, y + 8, 3, M.h - 8, pal.softShadow);

  if (m.steam > 0) drawBrewSteam(p, m.steam, pal);
}

/**
 * The readiness tell. Lit warm when there is someone to brew for, dark when
 * there is not — a machine with its power light off is not broken, it is off,
 * which is the whole reason the dispense button is allowed to refuse.
 */
function drawMachineLamp(p: PixelPainter, dx: number, pal: CafePalette, ready: boolean) {
  const { cx, cy, r } = BREW_MACHINE.lamp;
  const x = cx + dx;

  // Bezel.
  p.ellipse(x, cy, r + 2, r + 2, pal.woodDkr);

  if (!ready) {
    p.ellipse(x, cy, r, r, pal.metalDk);
    p.ellipse(x, cy - 1, r - 2, r - 2, pal.metal);
    return;
  }

  p.ellipse(x, cy, r + 4, r + 4, pal.softShadow);
  p.ellipse(x, cy, r, r, pal.goldDk);
  p.ellipse(x, cy, r - 1, r - 1, pal.gold);
  p.ellipse(x, cy - 1, r - 3, r - 3, pal.bulbGlow);
}

/** One preset well with a cup standing in it, framed by the drink's rarity. */
function drawPresetCell(
  p: PixelPainter,
  ctx: Ctx2D,
  cell: { x: number; y: number; w: number; h: number },
  dx: number,
  preset: BrewPreset,
  selected: boolean,
  pal: CafePalette
) {
  const x = cell.x + dx;
  const spec = DRINKS[preset.id];
  const frame = preset.affordable ? DRINK_FRAME[spec.rarity] : pal.metalDk;

  // Sunken well, then the rarity frame around its mouth.
  p.rect(x, cell.y, cell.w, cell.h, pal.metalDk);
  p.rect(x + 2, cell.y + 2, cell.w - 4, cell.h - 4, pal.dark);
  p.softRectEdge(x, cell.y, cell.w, cell.h, PX, frame);

  // The cup. A selected preset lifts, the same tell the rail cells used.
  const lift = selected ? 3 : 0;
  const cupW = 16;
  const cupH = cupW * drinkCupAspect(preset.id);
  const image = getDrinkCupSkImage(preset.id, 0);
  if (image) {
    ctx.drawImage(
      image,
      snap(x + (cell.w - cupW) / 2),
      snap(cell.y + cell.h - 5 - cupH - lift),
      cupW,
      cupH
    );
  }

  // Unaffordable recipes wash out rather than vanish — you still want to see
  // what you are saving toward.
  if (!preset.affordable) {
    p.rect(x + 2, cell.y + 2, cell.w - 4, cell.h - 4, 'rgba(40,28,20,0.45)');
  }

  if (selected) {
    p.rect(x + 3, cell.y + cell.h - 4, cell.w - 6, 2, pal.gold);
    p.rect(x + 3, cell.y + cell.h - 2, cell.w - 6, 1, pal.goldDk);
  }
}

/** A preset slot nothing has been used in yet. */
function drawEmptyCell(
  p: PixelPainter,
  cell: { x: number; y: number; w: number; h: number },
  dx: number,
  pal: CafePalette
) {
  const x = cell.x + dx;
  p.rect(x, cell.y, cell.w, cell.h, pal.metalDk);
  p.rect(x + 2, cell.y + 2, cell.w - 4, cell.h - 4, pal.dark);
  p.rect(x + 8, cell.y + cell.h / 2 - 1, cell.w - 16, 2, pal.metalDk);
}

/** The tab that opens the full menu. Three bars — the universal "more" mark. */
function drawMenuTab(p: PixelPainter, dx: number, pal: CafePalette) {
  const t = BREW_MACHINE.menuTab;
  const x = t.x + dx;

  p.rect(x, t.y, t.w, t.h, pal.woodDk);
  p.rect(x + 1, t.y + 1, t.w - 2, t.h - 2, pal.wood);
  p.rect(x + 1, t.y + 1, t.w - 2, 2, pal.woodLt);

  for (let i = 0; i < 3; i++) {
    p.rect(x + 3, t.y + 9 + i * 4, t.w - 6, 2, pal.woodDkr);
  }
}

/**
 * The hold gauge. Fills strictly linearly — an eased gauge reads as lying about
 * how much longer you have to hold, and this is not a timing game.
 */
function drawGauge(p: PixelPainter, dx: number, fill: number, ready: boolean, pal: CafePalette) {
  const g = BREW_MACHINE.gauge;
  const x = g.x + dx;

  // Sunken well.
  p.rect(x, g.y, g.w, g.h, pal.metalDk);
  p.rect(x + 1, g.y + 1, g.w - 2, g.h - 2, pal.dark);

  const clamped = Math.max(0, Math.min(1, fill));
  if (clamped > 0) {
    const w = Math.max(PX, (g.w - 4) * clamped);
    p.rect(x + 2, g.y + 2, w, g.h - 4, pal.goldDk);
    p.rect(x + 2, g.y + 2, w, 2, pal.gold);
    // A brighter head on the fill, so the eye tracks the edge that is moving.
    p.rect(x + 2 + w - 3, g.y + 2, 3, g.h - 4, pal.bulb);
  }

  // Quarter ticks along the top lip. They mark the run, they are not targets.
  const tick = ready ? pal.metal : pal.metalDk;
  for (let i = 1; i < 4; i++) p.rect(x + (g.w * i) / 4, g.y - 2, PX, 2, tick);
}

/**
 * The dispense button. Presses instantly by the full bevel and inverts it —
 * pixel UI has no sub-pixel positions to ease through, the same rule the hub's
 * `PixelButton` follows.
 */
function drawDispenseButton(
  p: PixelPainter,
  dx: number,
  pressed: boolean,
  ready: boolean,
  pal: CafePalette
) {
  const b = BREW_MACHINE.button;
  const x = b.x + dx;
  const drop = pressed ? 3 : 0;

  // Recess the button sits in.
  p.rect(x, b.y, b.w, b.h + 3, pal.metalDk);
  p.rect(x + 1, b.y + 1, b.w - 2, b.h + 1, pal.dark);

  const y = b.y + 2 + drop;
  const face = ready ? pal.berry : pal.metal;
  const lt = ready ? pal.pink : pal.metalLt;
  const dk = ready ? pal.seatDk : pal.metalDk;

  p.rect(x + 2, y, b.w - 4, b.h - 3, dk);
  p.rect(x + 2, y, b.w - 4, b.h - 5, face);
  p.rect(x + 2, y, b.w - 4, 2, pressed ? dk : lt);

  // Grip ridges across the face, so it reads as something to push rather than
  // a coloured panel.
  for (let i = 0; i < 5; i++) {
    p.rect(x + 22 + i * 12, y + 3, 4, b.h - 10, pressed ? dk : lt);
  }
}

/** The arm and nozzle that reach out over the cup. */
function drawMachineSpout(p: PixelPainter, dx: number, pal: CafePalette, ready: boolean) {
  const armY = 92;
  const x0 = 248 + dx;
  const x1 = 288 + dx;

  // Arm.
  p.rect(x0, armY, x1 - x0, 10, pal.metalDk);
  p.rect(x0, armY + 1, x1 - x0, 6, pal.metal);
  p.rect(x0, armY + 1, x1 - x0, 2, pal.metalLt);

  // Nozzle, dropping to just above the cup's rim.
  const nx = BREW_MACHINE.spoutTip.x + dx;
  p.rect(nx - 5, armY + 10, 10, 8, pal.metalDk);
  p.rect(nx - 3, armY + 10, 6, 7, pal.metal);
  p.rect(nx - 7, armY + 16, 14, 4, pal.metalDk);
  p.rect(nx - 5, armY + 17, 10, 2, ready ? pal.slabDk : pal.dark);
}

/**
 * Three puffs off the nozzle after a brew lands. Drawn per frame with the same
 * rects as everything else rather than as a React overlay — a view floating over
 * the canvas would sit at screen resolution and break the art grid.
 */
export function drawBrewSteam(p: PixelPainter, t: number, pal: CafePalette) {
  const { x, y } = BREW_MACHINE.spoutTip;
  const clamped = Math.max(0, Math.min(1, t));

  for (let i = 0; i < 3; i++) {
    // Each puff starts a third of the window later than the last.
    const local = clamped * 1.6 - i * 0.3;
    if (local <= 0 || local >= 1) continue;

    const rise = local * 26;
    const drift = (i - 1) * 5 * local;
    const alpha = 0.5 * (1 - local);
    const size = 3 + local * 4;

    p.ellipse(x + drift, y - 6 - rise, size, size * 0.8, `rgba(255,247,236,${alpha.toFixed(2)})`);
  }

  // A faint warm wash on the nozzle while it is still steaming.
  if (clamped < 0.5) p.rect(x - 6, y - 6, 12, 4, pal.softShadow);
}
