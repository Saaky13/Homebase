/**
 * Greenhouse geometry, in design units.
 *
 * The room is authored 390 wide and scaled uniformly, exactly like the café —
 * see `CafeCanvas` for why stretching each axis independently is not an option
 * when the art is pixels. Height flows, so the back wall reaches the bottom
 * of whatever screen this is.
 *
 * Everything positional lives here rather than in the renderer, because the
 * React hit targets and the drawing code have to agree on where a socket is.
 * When those two drifted apart in the café, every cat sat beside its chair.
 */

export const DESIGN_WIDTH = 390;
/** Fallback before the first layout pass. */
export const DESIGN_HEIGHT = 844;
/** Below this the three benches and the potting table stop fitting. */
export const MIN_DESIGN_HEIGHT = 780;
export const MAX_SCALE = 1.35;

/** Where the glass wall meets the limewashed back wall. */
export const FLOOR_TOP = 232;

/** Height of the potting table strip along the bottom. */
export const POTTING_H = 132;

/** Sockets per bench. */
export const SOCKETS_PER_BENCH = 4;
export const BENCH_COUNT = 3;
export const TOTAL_SOCKETS = SOCKETS_PER_BENCH * BENCH_COUNT;

/**
 * The wall stops here and a short run of floor takes over.
 *
 * Anchored to the last bench rather than to the bottom of the screen. Measured
 * from the bottom it collided with the last bench on a short screen and left a
 * 30px sliver on a tall one — the gap under the staging is what this line is
 * actually about, and that gap does not move when the screen does.
 */
export const FLOOR_BELOW_LAST_BENCH = 58;
export const floorRunY = () => BENCH_Y[BENCH_Y.length - 1] + FLOOR_BELOW_LAST_BENCH;

/**
 * How far the staging is held in from each edge. Not slack: it is the only
 * reason there is any background visible either side of the benches.
 */
export const BENCH_INSET = 34;

/** Bench parts, all measured off the bench's own surface line. */
export const HEADBOARD_TOP = -44;
export const HEADBOARD_H = 32;
export const TROUGH_TOP = -8;
export const TROUGH_H = 16;
/** The lip drawn *in front of* the pots, which is what sinks them in. */
export const LIP_TOP = 0;
export const LIP_H = 12;

/**
 * Bench surface lines — the y a pot's base rests on.
 *
 * The whole assembly is 68px tall on a 114px pitch. It used to be 129 tall on
 * a 100 pitch, which meant the three benches physically overlapped and no
 * background was ever visible between them — the room read as three shelves
 * bolted to a wall.
 */
export const BENCH_Y = [298, 412, 526];

/** Sockets are centred as a group, so the bench reads as symmetrical. */
const SOCKET_X = [69, 153, 237, 321];

export interface Socket {
  index: number;
  bench: number;
  x: number;
  /** The surface the pot sits on. */
  y: number;
}

export function getSockets(): Socket[] {
  const out: Socket[] = [];
  BENCH_Y.forEach((y, bench) => {
    SOCKET_X.forEach((x, i) => {
      out.push({ index: bench * SOCKETS_PER_BENCH + i, bench, x, y });
    });
  });
  return out;
}

/** A pot drawn from the 28x36 grid, at the cat sprites' own pixel density. */
export const POT_W = 47;
export const POT_H = 60;

/** How close a drop has to land before a socket counts as hit. */
export const DROP_RADIUS = 46;
/** The watering can waters anything whose pot it sweeps within. */
export const WATER_RADIUS = 40;

/**
 * Both draggables rest on the potting table, so their y is measured off the
 * bottom of the room rather than the top — the table is bottom-anchored and
 * the benches are not.
 */
export const CAN_STATION = { x: 332, fromBottom: 70 };
export const POT_STATION = { x: 200, fromBottom: 70 };
/** The seed rack hangs on the backboard above the table, and opens the packets. */
export const RACK = { x: 20, fromBottom: 154, w: 118, h: 76 };
/** Table surface — the line both stations rest on. */
export const TABLE_FROM_BOTTOM = 70;

export const canStationY = (height: number) => height - CAN_STATION.fromBottom;
export const potStationY = (height: number) => height - POT_STATION.fromBottom;
export const rackY = (height: number) => height - RACK.fromBottom;
