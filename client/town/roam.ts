/**
 * Cats wandering the town.
 *
 * Cats pick a destination somewhere across town and walk to it along the
 * paved tile graph. An earlier version stepped to a random adjacent tile each
 * time, which kept them on the stone but left every cat loitering near where
 * it spawned — a random walk drifts outward only as the square root of the
 * steps taken, so half the town never saw a cat. Committing to a distant
 * destination and following a route there is what makes them cover the map.
 *
 * Routes come from a breadth-first search over walkable tiles, so a cat still
 * only ever occupies stone; pathfinding chooses which stone, not whether.
 *
 * Positions are kept in tile units as floats. Pixels are a rendering concern,
 * so nothing here needs to know TILE.
 */

import type { MiniDirection } from '../constants/catSprites';
import { BUILDINGS, FOUNTAIN_TILES, GREENHOUSE, MAP_H, MAP_W, type Tile } from './map';

/** Stone, road, and the paved empty plots. */
const WALKABLE = new Set(['S', 'R', 'o']);

/**
 * How many tiles of headroom a cat needs above it.
 *
 * A cat is drawn about two tiles tall but occupies one tile of ground, so the
 * sprite reaches up past its own tile. Standing flush against a wall therefore
 * pushed its head through the brickwork. Rather than clip the sprite — which
 * would slice cats in half at the roofline — the tiles that would cause the
 * overlap are simply not walkable.
 */
const HEAD_CLEARANCE = 2;

/**
 * Tiles covered by a building, keyed `tx,ty`.
 *
 * Buildings are drawn from footprints rather than stamped into the tile grid,
 * so the grid alone cannot say whether a tile is under a wall. Built once per
 * grid and cached, since the town's footprints never move.
 */
let solidTiles: Set<string> | null = null;

function buildingTiles(): Set<string> {
  if (solidTiles) return solidTiles;
  const s = new Set<string>();
  const add = (tx: number, ty: number, tw: number, th: number) => {
    for (let y = ty; y < ty + th; y++)
      for (let x = tx; x < tx + tw; x++) s.add(`${x},${y}`);
  };
  for (const b of BUILDINGS) add(b.tx, b.ty, b.tw, b.th);
  add(GREENHOUSE.tx, GREENHOUSE.ty, GREENHOUSE.tw, GREENHOUSE.th);
  // The basin is stone, and stone is walkable — without this cats wade
  // straight through the middle of the biggest landmark in town.
  add(FOUNTAIN_TILES.tx, FOUNTAIN_TILES.ty, FOUNTAIN_TILES.tw, FOUNTAIN_TILES.th);
  solidTiles = s;
  return s;
}

export interface Roamer {
  catId: string;
  /** Current position in tile units; fractional while walking. */
  tx: number;
  ty: number;
  /** The adjacent tile currently being walked to. */
  goalTx: number;
  goalTy: number;
  /** Remaining route to the destination, tile by tile. */
  path: Array<[number, number]>;
  /** How far along `path` the cat has walked. */
  step: number;
  /**
   * The connected walkable area this cat lives in. Held per cat so choosing a
   * new destination never needs to re-scan the map.
   */
  group: Array<[number, number]>;
  /** Tiles per second. Varied per cat so they don't march in lockstep. */
  speed: number;
  dir: MiniDirection;
  /** Timestamp (ms) until which this cat stands still. */
  pauseUntil: number;
}

function isWalkable(grid: Tile[][], tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  if (!WALKABLE.has(grid[ty][tx])) return false;

  // Reject tiles whose sprite would reach into a wall above them.
  const solid = buildingTiles();
  for (let d = 1; d <= HEAD_CLEARANCE; d++) {
    if (solid.has(`${tx},${ty - d}`)) return false;
  }
  return true;
}

export function walkableTiles(grid: Tile[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) if (isWalkable(grid, tx, ty)) out.push([tx, ty]);
  return out;
}

const NEIGHBOURS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** A cat will not accept a destination closer than this, in tiles. */
const MIN_TRIP_TILES = 14;

/**
 * Connected groups of walkable tiles.
 *
 * The paved network is not guaranteed to be one piece — a courtyard cut off by
 * buildings is still walkable stone. Routing is only possible within a group,
 * so destinations are drawn from the cat's own group and a cat can never be
 * handed a target it would need to swim to.
 */
function walkableComponents(grid: Tile[][]): Array<Array<[number, number]>> {
  const seen = new Set<string>();
  const groups: Array<Array<[number, number]>> = [];

  for (const [sx, sy] of walkableTiles(grid)) {
    const key = `${sx},${sy}`;
    if (seen.has(key)) continue;

    const group: Array<[number, number]> = [];
    const queue: Array<[number, number]> = [[sx, sy]];
    seen.add(key);

    while (queue.length > 0) {
      const [tx, ty] = queue.pop()!;
      group.push([tx, ty]);
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = tx + dx;
        const ny = ty + dy;
        const nk = `${nx},${ny}`;
        if (seen.has(nk) || !isWalkable(grid, nx, ny)) continue;
        seen.add(nk);
        queue.push([nx, ny]);
      }
    }
    groups.push(group);
  }

  return groups;
}

/**
 * Shortest route between two walkable tiles, as the tiles to walk through.
 *
 * Breadth-first rather than A*: the map is around two thousand tiles and a
 * search runs only when a cat finishes a trip, so the simpler algorithm is
 * already far below the cost of a frame. Returns an empty array when the
 * target is unreachable, which callers treat as "pick somewhere else".
 */
function findPath(
  grid: Tile[][],
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number
): Array<[number, number]> {
  if (fromTx === toTx && fromTy === toTy) return [];

  const prev = new Map<string, string | null>();
  const queue: Array<[number, number]> = [[fromTx, fromTy]];
  prev.set(`${fromTx},${fromTy}`, null);

  for (let head = 0; head < queue.length; head++) {
    const [tx, ty] = queue[head];
    if (tx === toTx && ty === toTy) break;

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = tx + dx;
      const ny = ty + dy;
      const nk = `${nx},${ny}`;
      if (prev.has(nk) || !isWalkable(grid, nx, ny)) continue;
      prev.set(nk, `${tx},${ty}`);
      queue.push([nx, ny]);
    }
  }

  const targetKey = `${toTx},${toTy}`;
  if (!prev.has(targetKey)) return [];

  const path: Array<[number, number]> = [];
  let cursor: string | null = targetKey;
  while (cursor && cursor !== `${fromTx},${fromTy}`) {
    const [x, y] = cursor.split(',').map(Number);
    path.push([x, y]);
    cursor = prev.get(cursor) ?? null;
  }
  return path.reverse();
}

/**
 * Chooses somewhere worth walking to: far enough away that the trip crosses
 * town rather than shuffling around the same block. Falls back to any tile in
 * the group if nothing distant is reachable, so a cat in a small courtyard
 * still moves instead of freezing.
 */
function pickDestination(
  group: Array<[number, number]>,
  fromTx: number,
  fromTy: number
): [number, number] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const [tx, ty] = group[Math.floor(Math.random() * group.length)];
    if (Math.abs(tx - fromTx) + Math.abs(ty - fromTy) >= MIN_TRIP_TILES) return [tx, ty];
  }
  return group[Math.floor(Math.random() * group.length)];
}

function directionFor(dx: number, dy: number, fallback: MiniDirection): MiniDirection {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'front' : 'back';
}

/** Sends a cat off on a fresh trip, retrying if a destination is unreachable. */
function retarget(roamer: Roamer, grid: Tile[][], group: Array<[number, number]>): void {
  const tx = Math.round(roamer.tx);
  const ty = Math.round(roamer.ty);

  for (let attempt = 0; attempt < 6; attempt++) {
    const [dx, dy] = pickDestination(group, tx, ty);
    const path = findPath(grid, tx, ty, dx, dy);
    if (path.length > 0) {
      roamer.path = path;
      roamer.step = 0;
      const [nx, ny] = path[0];
      roamer.goalTx = nx;
      roamer.goalTy = ny;
      roamer.dir = directionFor(nx - roamer.tx, ny - roamer.ty, roamer.dir);
      return;
    }
  }

  roamer.path = [];
  roamer.step = 0;
  roamer.goalTx = tx;
  roamer.goalTy = ty;
}

export function createRoamers(
  grid: Tile[][],
  catIds: string[],
  now: number
): Roamer[] {
  const groups = walkableComponents(grid);
  if (groups.length === 0) return [];

  // Everyone starts in the largest connected area. Spawning into an isolated
  // pocket would strand a cat there for the life of the session.
  const main = groups.reduce((a, b) => (b.length > a.length ? b : a));

  return catIds.map((catId, i) => {
    // Spread the starting tiles across the group rather than clustering.
    const [tx, ty] = main[Math.floor((i / Math.max(1, catIds.length)) * main.length)];
    const roamer: Roamer = {
      catId,
      tx,
      ty,
      goalTx: tx,
      goalTy: ty,
      path: [],
      step: 0,
      group: main,
      speed: 2.0 + Math.random() * 1.0,
      dir: 'front',
      pauseUntil: now + Math.random() * 2500,
    };
    retarget(roamer, grid, main);
    return roamer;
  });
}

/**
 * Advances every cat by `dtMs`. Mutates in place — this runs each animation
 * frame, and allocating a new array of roamers 60 times a second is exactly
 * the kind of garbage that makes a canvas scene stutter.
 */
export function stepRoamers(
  roamers: Roamer[],
  grid: Tile[][],
  dtMs: number,
  now: number
): void {
  // A backgrounded tab hands back one enormous delta on return; clamp it so
  // cats resume from where they were instead of teleporting across town.
  const dt = Math.min(dtMs, 100) / 1000;

  for (const r of roamers) {
    if (now < r.pauseUntil) continue;

    const dx = r.goalTx - r.tx;
    const dy = r.goalTy - r.ty;
    const dist = Math.hypot(dx, dy);
    const step = r.speed * dt;

    if (dist <= step || dist === 0) {
      r.tx = r.goalTx;
      r.ty = r.goalTy;
      r.step++;

      if (r.step >= r.path.length) {
        // Arrived. Rest a moment before setting off again, so the town reads
        // as inhabited rather than as a conveyor belt of cats.
        if (Math.random() < 0.7) r.pauseUntil = now + 500 + Math.random() * 2200;
        retarget(r, grid, r.group);
        continue;
      }

      const [nx, ny] = r.path[r.step];
      r.goalTx = nx;
      r.goalTy = ny;
      r.dir = directionFor(nx - r.tx, ny - r.ty, r.dir);
      continue;
    }

    r.tx += (dx / dist) * step;
    r.ty += (dy / dist) * step;
    r.dir = directionFor(dx, dy, r.dir);
  }
}
