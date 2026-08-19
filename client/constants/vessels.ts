/**
 * What a drink is served in.
 *
 * The café is not a boba shop with three flavours any more — it pours coffee
 * and tea as well, and a latte drawn as a boba cup with tapioca in it is a
 * lie the sprite tells before the name gets a chance to correct it.
 *
 * All three vessels share one 20x30 grid and one nine-key palette, so a drink
 * only has to name its vessel and its hue; `drinks.ts` generates the rest.
 * They also share the liquid-level logic, which is why a sealed paper cup
 * shows how full it is — physically wrong, instantly readable, and it keeps
 * the pour animation on a single code path for all three.
 */

import { bobaCupGrid } from './bobaCup';

export type Vessel = 'boba' | 'coffee' | 'tea';

const W = 20;
const H = 30;

function blank(): string[][] {
  return Array.from({ length: H }, () => Array(W).fill('.'));
}

function clampFill(fill: number): number {
  return Math.max(0, Math.min(1, fill));
}

/** Straight taper between two spans, so every vessel narrows the same way. */
function taper(y: number, top: number, bottom: number, inset: number): number {
  const t = (y - top) / (bottom - top);
  return Math.round(t * inset);
}

/**
 * Fill a body row: outline at the edges, drink below the surface, empty above,
 * and a highlight running down the inside of the left wall.
 */
function bodyRow(
  g: string[][],
  y: number,
  l: number,
  r: number,
  surfaceY: number,
  firstRow: boolean
) {
  g[y][l] = 'o';
  g[y][r] = 'o';
  for (let x = l + 1; x < r; x++) g[y][x] = y >= surfaceY ? 't' : 'c';
  if (!firstRow) g[y][l + 1] = y >= surfaceY ? 'u' : 'h';
}

/* ------------------------------- coffee -------------------------------- */

const C_LID_TOP = 5;
const C_LID_BOTTOM = 8;
const C_BODY_TOP = 9;
const C_BODY_BOTTOM = 26;
const C_SLEEVE_TOP = 15;
const C_SLEEVE_BOTTOM = 20;

function coffeeEdges(y: number): [number, number] {
  const inset = taper(y, C_BODY_TOP, C_BODY_BOTTOM, 3);
  return [2 + inset, 17 - inset];
}

/** A to-go cup: sip spout, snap lid, corrugated sleeve. No straw, no pearls. */
function coffeeGrid(fill: number): string[][] {
  const g = blank();

  // The raised sip spout, offset right so the cup reads as facing you.
  for (let x = 11; x <= 15; x++) g[4][x] = 'o';
  for (let x = 12; x <= 14; x++) g[3][x] = 'l';
  g[3][11] = 'o';
  g[3][15] = 'o';

  // Lid, overhanging the body on both sides.
  for (let x = 1; x <= 18; x++) {
    g[C_LID_TOP][x] = 'o';
    g[C_LID_BOTTOM][x] = 'o';
  }
  for (let y = C_LID_TOP + 1; y < C_LID_BOTTOM; y++) {
    g[y][1] = 'o';
    g[y][18] = 'o';
    for (let x = 2; x <= 17; x++) g[y][x] = 'l';
  }
  g[C_LID_TOP + 1][2] = 'h';
  g[C_LID_TOP + 1][3] = 'h';

  const span = C_BODY_BOTTOM - (C_BODY_TOP + 2);
  const surfaceY = C_BODY_BOTTOM - Math.round(span * clampFill(fill));

  for (let y = C_BODY_TOP; y <= C_BODY_BOTTOM; y++) {
    const [l, r] = coffeeEdges(y);
    bodyRow(g, y, l, r, surfaceY, y === C_BODY_TOP);
  }

  if (surfaceY > C_BODY_TOP && surfaceY <= C_BODY_BOTTOM) {
    const [l, r] = coffeeEdges(surfaceY);
    for (let x = l + 1; x < r; x++) g[surfaceY][x] = 'u';
  }

  // The sleeve sits over whatever is behind it, which is what separates a
  // coffee cup from a boba cup at a glance more than the missing straw does.
  for (let y = C_SLEEVE_TOP; y <= C_SLEEVE_BOTTOM; y++) {
    const [l, r] = coffeeEdges(y);
    const edge = y === C_SLEEVE_TOP || y === C_SLEEVE_BOTTOM;
    for (let x = l; x <= r; x++) g[y][x] = edge ? 'o' : 'd';
    if (!edge) g[y][l + 1] = 'h';
  }

  const [bl, br] = coffeeEdges(C_BODY_BOTTOM);
  for (let x = bl; x <= br; x++) g[C_BODY_BOTTOM + 1][x] = 'o';

  return g;
}

/* --------------------------------- tea --------------------------------- */

const T_BOWL_TOP = 11;
const T_BOWL_BOTTOM = 21;

function teaEdges(y: number): [number, number] {
  const inset = taper(y, T_BOWL_TOP, T_BOWL_BOTTOM, 3);
  return [3 + inset, 16 - inset];
}

/** A cup on a saucer, with a handle and steam. Open — no lid to hide behind. */
function teaGrid(fill: number): string[][] {
  const g = blank();

  // Steam. Two wisps, offset, so it reads as rising rather than as antennae.
  [
    [7, 3], [7, 4], [8, 5], [8, 6], [7, 7],
    [11, 4], [11, 5], [12, 6], [12, 7], [11, 8],
  ].forEach(([x, y]) => {
    g[y][x] = 'h';
  });

  const span = T_BOWL_BOTTOM - (T_BOWL_TOP + 1);
  const surfaceY = T_BOWL_BOTTOM - Math.round(span * clampFill(fill));

  for (let y = T_BOWL_TOP; y <= T_BOWL_BOTTOM; y++) {
    const [l, r] = teaEdges(y);
    bodyRow(g, y, l, r, surfaceY, y === T_BOWL_TOP);
  }

  // The rim, drawn last so it caps the bowl even when the cup is full.
  for (let x = 3; x <= 16; x++) g[T_BOWL_TOP][x] = 'o';
  for (let x = 4; x <= 15; x++) g[T_BOWL_TOP + 1][x] = surfaceY <= T_BOWL_TOP + 1 ? 'u' : 'c';

  if (surfaceY > T_BOWL_TOP + 1 && surfaceY <= T_BOWL_BOTTOM) {
    const [l, r] = teaEdges(surfaceY);
    for (let x = l + 1; x < r; x++) g[surfaceY][x] = 'u';
  }

  // Handle, hooked off the right wall.
  ([[17, 13], [18, 14], [18, 15], [18, 16], [17, 17]] as [number, number][]).forEach(
    ([x, y]) => {
      g[y][x] = 'o';
    }
  );

  // Bowl floor, then a short foot down onto the saucer.
  const [bl, br] = teaEdges(T_BOWL_BOTTOM);
  for (let x = bl; x <= br; x++) g[T_BOWL_BOTTOM + 1][x] = 'o';
  for (let y = T_BOWL_BOTTOM + 2; y <= T_BOWL_BOTTOM + 3; y++) {
    for (let x = 8; x <= 11; x++) g[y][x] = 'd';
    g[y][8] = 'o';
    g[y][11] = 'o';
  }

  // Saucer.
  const saucerY = T_BOWL_BOTTOM + 4;
  for (let x = 2; x <= 17; x++) g[saucerY][x] = 'o';
  for (let x = 3; x <= 16; x++) g[saucerY + 1][x] = 'd';
  for (let x = 5; x <= 14; x++) g[saucerY + 2][x] = 'o';
  g[saucerY + 1][4] = 'h';

  return g;
}

/* ------------------------------ entry point ---------------------------- */

/**
 * @param fill 0–1, how full it is. A cup on the counter is full; one being
 *             handed over empties as it goes.
 */
export function vesselGrid(vessel: Vessel, fill = 1): string[][] {
  if (vessel === 'coffee') return coffeeGrid(fill);
  if (vessel === 'tea') return teaGrid(fill);
  return bobaCupGrid(fill);
}
