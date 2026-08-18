/**
 * Draws the greenhouse.
 *
 * Same idiom as the café and the town: every mark is a filled axis-aligned
 * rect routed through `PixelPainter`, so it lands on the art grid and reads at
 * the same resolution as the sprites standing in it.
 *
 * Unlike the café this scene has no render loop behind it. Nothing in the room
 * moves on its own — plants change once a day, when you water them — so the
 * whole thing is recorded into one `SkPicture` and replayed until a plant
 * actually changes. See `GreenhouseCanvas` for the seam.
 */

import type { Ctx2D } from './skiaCanvas2d';
import { PixelPainter, noise, PX } from './cafePixel';
import type { GreenhousePalette } from '../constants/greenhousePalette';
import {
  BENCH_INSET, BENCH_Y, FLOOR_TOP, HEADBOARD_H, HEADBOARD_TOP, LIP_H, LIP_TOP,
  RACK, SOCKETS_PER_BENCH, TABLE_FROM_BOTTOM, TROUGH_H, TROUGH_TOP, floorRunY,
  getSockets,
} from './greenhouseConfig';

export interface GreenhouseScene {
  width: number;
  height: number;
  pal: GreenhousePalette;
  night: boolean;
  /** Benches unlocked so far. Locked ones are drawn, just bare. */
  benches: number;
}

/* ------------------------------ entry point ---------------------------- */

export function drawGreenhouseScene(ctx: Ctx2D, scene: GreenhouseScene) {
  const p = new PixelPainter(ctx);

  drawGlassWall(p, scene);
  drawBackWall(p, scene);
  // Light falls over the room but under the plants, which keeps the sprites
  // saturated — a pot tinted 20% toward the beam colour stops reading as
  // terracotta, and the plants are painted in a later pass anyway.
  if (scene.night) drawGrowLamps(p, scene);
  else drawSunbeams(p, scene);
  drawFloorClutter(p, scene);
  drawWallDressing(p, scene);
  drawBenches(p, scene);
  drawPottingTable(p, scene);
  drawHangingBaskets(p, scene);
}

/**
 * The front lip of every trough, drawn as a second pass.
 *
 * It has to land *on top of* the pots — that is the whole reason they look
 * planted rather than placed — and the pots are painted by `GreenhouseCanvas`
 * from the plant cache, after this picture has already been replayed. So the
 * lips cannot live in the room picture with the rest of the bench.
 */
export function drawBenchFronts(ctx: Ctx2D, scene: GreenhouseScene) {
  const p = new PixelPainter(ctx);
  const x = BENCH_INSET;
  const w = scene.width - BENCH_INSET * 2;
  BENCH_Y.forEach((y) => {
    p.rect(x, y + LIP_TOP, w, LIP_H - 5, scene.pal.zinc);
    p.rect(x, y + LIP_TOP, w, 3, scene.pal.zincLt);
    p.rect(x, y + LIP_TOP + LIP_H - 5, w, 5, scene.pal.zincDk);
    for (let rx = x; rx < x + w; rx += 40) {
      p.rect(rx, y + LIP_TOP + 2, PX, LIP_H - 9, scene.pal.zincDk);
    }
  });
}

/* -------------------------------- glass -------------------------------- */

/**
 * A wall of glazing on a low brick knee wall — the shape every Victorian
 * glasshouse actually is. The view through it is the same town the map screen
 * shows, so the greenhouse reads as being *in* the world rather than beside it.
 */
function drawGlassWall(p: PixelPainter, scene: GreenhouseScene) {
  const { width, pal, night } = scene;
  const kneeTop = FLOOR_TOP - 34;

  // Sky behind everything, lighter toward the top.
  p.rect(0, 0, width, kneeTop, pal.sky);
  p.rect(0, 0, width, Math.round(kneeTop * 0.46), pal.skyLt);

  if (night) {
    for (let i = 0; i < 26; i++) {
      const sx = noise(i, 3, 51) * width;
      const sy = 16 + noise(i, 5, 52) * (kneeTop * 0.5);
      p.rect(sx, sy, PX, PX, noise(i, 7, 53) > 0.6 ? pal.cloud : pal.glassLt);
    }
    p.ellipse(width - 66, 46, 9, 9, pal.cloud);
    p.ellipse(width - 61, 42, 7, 7, pal.sky);
  } else {
    p.softRect(40, 34, 34, 11, pal.cloud, PX);
    p.softRect(54, 28, 22, 9, pal.cloud, PX);
    p.softRect(width - 96, 52, 30, 10, pal.cloud, PX);
    p.softRect(width - 84, 46, 18, 8, pal.cloud, PX);
  }

  // Hills and a tree line, then the town's rooftops sitting on them.
  const hy = Math.round(kneeTop * 0.62);
  p.ellipse(52, hy + 26, 68, 30, pal.far);
  p.ellipse(width - 40, hy + 30, 74, 32, pal.far);
  p.rect(0, hy + 34, width, kneeTop - hy - 34, pal.hill);
  p.rect(0, hy + 34, width, 3, pal.hillDk);

  const roofs: [number, number, number][] = [
    [24, hy + 12, 30], [78, hy + 2, 36], [136, hy + 16, 26],
    [244, hy + 6, 32], [300, hy + 18, 28], [344, hy + 8, 30],
  ];
  roofs.forEach(([rx, ry, rw], i) => {
    const bodyH = kneeTop - ry - 10;
    if (bodyH <= 6) return;
    p.rect(rx, ry + 10, rw, bodyH, pal.far);
    for (let s = 0; s < 10; s += PX) {
      const inset = Math.round((rw / 2) * (s / 10));
      p.rect(rx + inset, ry + s, rw - inset * 2, PX, pal.hillDk);
    }
    const lit = night || noise(rx, i, 61) > 0.55;
    p.rect(rx + 7, ry + 17, 6, 6, lit ? pal.lamp : pal.hillDk);
  });

  // The glazing itself: a wash over the view, plus the streaks and speckle
  // that make it glass rather than an open window.
  drawGlazing(p, 0, 0, width, kneeTop, pal);

  // Iron frame: eave beam, vertical mullions, one transom across.
  p.rect(0, 0, width, 10, pal.ironDk);
  p.rect(0, 0, width, 5, pal.iron);
  p.rect(0, 10, width, 3, pal.ironDkr);

  const bays = 8;
  for (let i = 1; i < bays; i++) {
    const mx = Math.round((i * width) / bays) - 2;
    p.rect(mx, 12, 5, kneeTop - 12, pal.ironDk);
    p.rect(mx, 12, 2, kneeTop - 12, pal.ironLt);
  }
  const transom = Math.round(kneeTop * 0.44);
  p.rect(0, transom, width, 5, pal.ironDk);
  p.rect(0, transom, width, 2, pal.ironLt);

  drawRidgeVent(p, width, pal);

  // The knee wall the glazing stands on. Painted render, not brick: brick here
  // standing on a brick floor merged into one surface and the room lost its
  // ground line entirely.
  p.rect(0, kneeTop, width, 7, pal.stoneDk);
  p.rect(0, kneeTop, width, 4, pal.ironLt);
  p.rect(0, kneeTop + 7, width, FLOOR_TOP - kneeTop - 7, pal.stone);
  p.rect(0, kneeTop + 7, width, 3, pal.stoneLt);

  // Recessed panels along it, so the band isn't one flat stripe.
  for (let bx = 8; bx < width - 8; bx += 62) {
    const w = Math.min(52, width - 8 - bx);
    p.rect(bx, kneeTop + 14, w, FLOOR_TOP - kneeTop - 24, pal.stoneDk);
    p.rect(bx + 3, kneeTop + 17, w - 6, FLOOR_TOP - kneeTop - 30, pal.stoneLt);
  }

  // Ground line: the shadow the wall casts onto the first course of brick.
  p.rect(0, FLOOR_TOP - 5, width, 5, pal.stoneDk);
  p.rect(0, FLOOR_TOP, width, 4, pal.shadow);
}

/** The pane wash: tint, highlight streaks, condensation pooling low. */
function drawGlazing(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: GreenhousePalette
) {
  // Two diagonal highlight streaks per bay. Glass is mostly legible by its
  // reflections; a flat tint alone just looks like fog.
  for (let sx = -h; sx < w; sx += 74) {
    for (let row = 0; row < h; row += PX) {
      p.rect(x + sx + row * 0.6, y + row, 9, PX, pal.glassLt);
      p.rect(x + sx + 16 + row * 0.6, y + row, 4, PX, pal.cond);
    }
  }

  // Condensation: denser toward the bottom of each pane, the way it runs.
  for (let i = 0; i < 220; i++) {
    const cx = noise(i, 1, 21) * w;
    const t = noise(i, 2, 22);
    const cy = y + h - t * t * h;
    p.rect(x + cx, cy, PX, PX, noise(i, 3, 23) > 0.5 ? pal.cond : pal.glassDk);
  }

  // A few runs of water tracking down.
  for (let i = 0; i < 7; i++) {
    const rx = 24 + noise(i, 4, 24) * (w - 48);
    const ry = y + h * 0.45 + noise(i, 5, 25) * (h * 0.4);
    const len = 10 + noise(i, 6, 26) * 26;
    p.rect(rx, ry, PX, len, pal.cond);
    p.rect(rx, ry + len, PX * 2, PX * 2, pal.cond);
  }
}

/** The vent cracked open at the ridge. Nothing says glasshouse like it. */
function drawRidgeVent(p: PixelPainter, width: number, pal: GreenhousePalette) {
  const cx = width / 2;
  const w = 96;
  // The lifted panel, drawn as a shallow ramp of steps.
  for (let i = 0; i < 10; i += PX) {
    const inset = Math.round((i / 10) * 8);
    p.rect(cx - w / 2 + inset, 14 + i, w - inset * 2, PX, pal.glassLt);
  }
  p.rect(cx - w / 2, 14, w, PX, pal.ironLt);
  p.rect(cx - w / 2, 24, w, 3, pal.ironDk);
  // The stay arm holding it open.
  p.rect(cx - 2, 24, 4, 12, pal.ironDkr);
  p.rect(cx - 12, 34, 24, 3, pal.ironDk);
}

/* -------------------------------- floor -------------------------------- */

/**
 * The back wall, and the short run of floor under it.
 *
 * This used to be red brick running the full height. The problem was never the
 * brick itself — it was that the floor, the pots, the benches and the potting
 * table all sat within a few points of each other in value, so the room
 * collapsed into one tan field and the plants had nothing to stand against.
 *
 * Limewash fixes that by being almost nothing: near-white, faintly mottled,
 * with damp rising off the ground. But a wall on its own leaves the room with
 * no floor at all, and anything meant to be standing on the ground floats. So
 * the wall stops at a skirting and a few courses of quiet stone carry the
 * hose, the crates and the drain.
 */
function drawBackWall(p: PixelPainter, { width, height, pal }: GreenhouseScene) {
  const ground = floorRunY();

  p.rect(0, FLOOR_TOP, width, ground - FLOOR_TOP, pal.lime);
  // Sparse on purpose. At every 5x4 px this mottle covered the wall and the
  // room came out looking like dirty stucco; limewash is supposed to be the
  // quietest surface on screen, so the texture is only just perceptible.
  for (let y = FLOOR_TOP; y < ground; y += 11) {
    for (let x = 0; x < width; x += 13) {
      const n = noise(x, y, 101);
      if (n > 0.86) p.rect(x + n * 8, y, 8 + n * 12, 3, pal.limeLt);
      else if (n < 0.09) p.rect(x + n * 40, y + 3, 7, 3, pal.limeDk);
    }
  }

  // Damp rising off the floor. Cheap, and it is the only thing on a flat wall
  // that tells you where the ground is.
  for (let y = ground - 150; y < ground; y += PX) {
    p.rect(0, y, width, PX, pal.damp);
  }
  for (let x = 0; x < width; x += 9) {
    const n = noise(x, 7, 102);
    if (n > 0.72) p.rect(x, ground - n * 44, 6, 44 + n * 10, pal.softShadow);
  }

  // Skirting, then the floor itself.
  p.rect(0, ground - 12, width, 12, pal.skirt);
  p.rect(0, ground - 12, width, 4, pal.limeLt);
  p.rect(0, ground - 2, width, 4, pal.floorDk);

  p.rect(0, ground, width, height - ground, pal.floorJoint);
  const depth = Math.max(1, height - TABLE_FROM_BOTTOM - 96 - ground);
  let y = ground;
  let row = 0;
  while (y < ground + depth + 8) {
    const t = (y - ground) / depth;
    const fh = 17 + t * 14;
    const fw = 86 + t * 30;
    for (let x = row % 2 ? -fw / 2 : -10; x < width; x += fw) {
      const n = noise(Math.round(x), row, 171);
      p.rect(x + 3, y + 3, fw - 6, fh - 6,
        n > 0.7 ? pal.floorLt : n < 0.3 ? pal.floorDk : pal.floor);
      p.rect(x + 3, y + 3, fw - 6, PX, pal.floorLt);
      if (noise(Math.round(x), row, 172) > 0.8) {
        p.rect(x + 3, y + fh - 4, 9 + noise(x, row, 173) * 12, 3, pal.moss);
      }
    }
    y += fh;
    row += 1;
  }
  // Where wall meets floor. Without this line the two surfaces merge and the
  // skirting reads as a stripe painted on the wall.
  p.rect(0, ground, width, 6, pal.shadow);

  // Aerial perspective on the top of the wall, so the room has depth even
  // though it is drawn head-on.
  for (let hy = FLOOR_TOP; hy < FLOOR_TOP + 90; hy += PX) {
    if (1 - (hy - FLOOR_TOP) / 90 > 0.16) p.rect(0, hy, width, PX, pal.haze);
  }
}

/* -------------------------------- light -------------------------------- */

/**
 * Shafts of sun coming through the roof, with dust hanging in them. The motes
 * are static: this scene is recorded once, and a mote that only moves when you
 * water something would read as a glitch rather than as drifting dust.
 */
function drawSunbeams(p: PixelPainter, { width, height, pal }: GreenhouseScene) {
  const beams: [number, number][] = [[-70, 78], [126, 54], [300, 44]];
  const slope = 0.42;

  beams.forEach(([startX, beamW], b) => {
    for (let y = 0; y < height; y += PX) {
      const x = startX + y * slope;
      if (x > width) break;
      p.rect(x, y, beamW, PX, pal.beamSoft);
      p.rect(x + beamW * 0.24, y, beamW * 0.5, PX, pal.beam);
    }
    for (let i = 0; i < 26; i++) {
      const t = noise(b, i, 33);
      const y = t * height;
      const x = startX + y * slope + noise(b, i, 34) * beamW;
      p.rect(x, y, PX, PX, pal.mote);
    }
  });
}

/**
 * After dark the beams are gone and the lamps take over: a fixture over each
 * bench throwing a magenta pool onto it. Grow lamps really are that colour,
 * and it means the greenhouse can never be mistaken for the café at night.
 */
function drawGrowLamps(p: PixelPainter, { width, pal, benches }: GreenhouseScene) {
  BENCH_Y.slice(0, Math.max(1, benches)).forEach((y) => {
    const top = y - 108;
    const cx = width / 2;

    // Cord and reflector hood.
    p.rect(cx - PX, top - 22, PX * 2, 22, pal.ironDkr);
    for (let i = 0; i < 10; i += PX) {
      const half = 30 + i * 2.2;
      p.rect(cx - half, top + i, half * 2, PX, pal.lampBody);
    }
    p.rect(cx - 52, top + 10, 104, 4, pal.zincLt);
    p.rect(cx - 44, top + 14, 88, 4, pal.lampGlow);

    // The pool of light widening onto the bench.
    for (let j = 18; j < 108; j += PX) {
      const t = (j - 18) / 90;
      const half = 44 + t * 130;
      p.rect(cx - half, top + j, half * 2, PX, pal.beamSoft);
      p.rect(cx - half * 0.55, top + j, half * 1.1, PX, pal.beam);
    }
  });
}

/* ------------------------------- benches ------------------------------- */

function drawBenches(p: PixelPainter, scene: GreenhouseScene) {
  BENCH_Y.forEach((y, i) => drawBench(p, y, i < scene.benches, scene));
}

/**
 * Staging: a low painted back, a gravel trough, and two supports under it.
 *
 * Two things about it are deliberate and easy to undo by accident.
 *
 * The headboard is only 32px. It was 62, which put a solid panel behind every
 * plant and left nothing of the room visible; at 32 the foliage grows up past
 * it and you see the wall through the planting instead of behind it.
 *
 * The whole assembly is held in `BENCH_INSET` from both edges, which is the
 * only reason there is any background down the sides at all.
 *
 * The front lip is *not* drawn here — see `drawBenchFronts`.
 */
function drawBench(
  p: PixelPainter,
  y: number,
  unlocked: boolean,
  { width, pal }: GreenhouseScene
) {
  const x = BENCH_INSET;
  const w = width - BENCH_INSET * 2;

  // The bench's shadow thrown onto the wall behind it. Against a flat surface
  // this is the only thing lifting the staging off the plaster — but it has to
  // taper, or the hard bottom edge reads as another plank hanging in mid-air.
  p.rect(x + 4, y + 17, w - 6, 7, pal.shadow);
  p.rect(x + 12, y + 24, w - 26, 5, pal.softShadow);
  p.rect(x + 30, y + 29, w - 62, 3, pal.softShadow);

  // Supports, drawn before the trough so it overlaps their tops.
  [x + 14, x + w - 22].forEach((lx) => {
    p.rect(lx, y + 12, 8, 26, pal.woodDk);
    p.rect(lx - 1, y + 12, PX, 26, pal.wood);
    p.rect(lx - 3, y + 36, 14, 4, pal.woodDkr);
  });

  // Headboard: tongue-and-groove with a capping rail.
  p.rect(x, y + HEADBOARD_TOP, w, HEADBOARD_H, pal.board);
  p.rect(x, y + HEADBOARD_TOP, w, 4, pal.boardLt);
  for (let bx = x + 4; bx < x + w; bx += 20) {
    p.rect(bx, y + HEADBOARD_TOP + 4, PX, HEADBOARD_H - 8, pal.boardDk);
  }
  p.rect(x, y + HEADBOARD_TOP + HEADBOARD_H - 4, w, 4, pal.boardDk);
  p.rect(x - 3, y + HEADBOARD_TOP - 4, w + 6, 5, pal.boardLt);
  p.rect(x - 3, y + HEADBOARD_TOP - 4, w + 6, PX, pal.cream);

  // The gravel bed the pots sit down into.
  p.rect(x, y + TROUGH_TOP, w, TROUGH_H, pal.grit);
  for (let gx = x + 2; gx < x + w - 2; gx += 6) {
    const n = noise(Math.round(gx), Math.round(y), 53);
    p.rect(gx, y + TROUGH_TOP + 1 + n * 12, 5, 3, n > 0.6 ? pal.gritLt : pal.gritDk);
  }

  if (!unlocked) {
    // Locked staging is still furniture, just bare: a brass plate where the
    // sockets would be.
    p.rect(x + Math.round(w / 2) - 26, y + HEADBOARD_TOP + 9, 52, 12, pal.goldDk);
    p.rect(x + Math.round(w / 2) - 24, y + HEADBOARD_TOP + 10, 48, 8, pal.gold);
    p.rect(x + Math.round(w / 2) - 18, y + HEADBOARD_TOP + 13, 36, PX, pal.goldDk);
    return;
  }

  // An empty socket is a scoop out of the gravel, not a marker drawn over it.
  getSockets()
    .filter((sk) => sk.y === y)
    .forEach((sk) => {
      p.rect(sk.x - 15, y + TROUGH_TOP - 2, 30, 7, pal.gritDk);
      p.rect(sk.x - 13, y + TROUGH_TOP - 2, 26, PX, pal.soilDk);
      p.rect(sk.x - 15, y + TROUGH_TOP + 5, 30, PX, pal.gritLt);
      void SOCKETS_PER_BENCH;
    });
}

/**
 * Everything standing on the floor.
 *
 * This is doing real work, not decoration. A head-on elevation of a room with
 * three shelves in it reads as a wall no matter what the wall is made of —
 * what breaks the illusion is objects that are unambiguously *standing on the
 * ground*, each with its own contact shadow.
 *
 * They all sit on one line, because there is only one strip of actual floor:
 * everything above it is wall. Scattering them up the wall the way the brick
 * version did left them floating.
 */
function drawFloorClutter(p: PixelPainter, { width, height, pal }: GreenhouseScene) {
  const g = floorRunY() + 26;

  // Coiled hose, running up to the tap.
  const hx = 54;
  for (let r = 0; r < 4; r++) {
    const rw = 46 - r * 8;
    const ry = g - 2 - r * 5;
    p.rect(hx - rw / 2, ry, rw, 5, pal.leafDk);
    p.rect(hx - rw / 2, ry, rw, PX, pal.leaf);
  }
  p.rect(hx + 16, g - 26, 5, 18, pal.leafDk);
  p.rect(hx + 14, g - 32, 9, 8, pal.twine);
  p.rect(hx + 14, g - 32, 9, PX, pal.seedPaper);

  // A planted floor pot, and the compost spilled getting it there.
  const px = 134;
  p.ellipse(px, g + 7, 22, 6, pal.softShadow);
  p.rect(px - 17, g - 22, 34, 24, pal.potDk);
  p.rect(px - 14, g - 22, 28, 19, pal.pot);
  p.rect(px - 19, g - 27, 38, 7, pal.potDk);
  p.rect(px - 16, g - 27, 32, 4, pal.potLt);
  [-8, 0, 8].forEach((ox, i) => {
    for (let j = 0; j < 18; j += 4) {
      const wob = Math.round(Math.sin((j + i * 3) / 5) * 3);
      p.rect(px + ox + wob, g - 30 - j, 5, 5, i % 2 ? pal.leaf : pal.leafDk);
    }
  });
  for (let i = 0; i < 12; i++) {
    const n = noise(i, 4, 141);
    p.rect(px + 20 + n * 30, g + 2 + n * 7, 4 + n * 4, 3, pal.soilDk);
  }

  // Stacked seed trays.
  const tx = 214;
  for (let i = 0; i < 3; i++) {
    const sy = g - i * 8;
    p.rect(tx, sy, 62, 8, i % 2 ? pal.woodDk : pal.wood);
    p.rect(tx, sy, 62, PX, pal.woodLt);
    for (let c = 0; c < 5; c++) p.rect(tx + 4 + c * 12, sy + 3, 7, 3, pal.soilDk);
  }

  // The drain, near the front where water would actually run to.
  const dx = width - 52;
  p.rect(dx - 20, g - 4, 40, 13, pal.zincDk);
  p.rect(dx - 18, g - 2, 36, 9, pal.dark);
  for (let i = 0; i < 5; i++) p.rect(dx - 14 + i * 7, g - 1, 4, 7, pal.zincDk);
  p.ellipse(dx - 30, g + 6, 14, 4, pal.puddle);
  p.ellipse(dx - 32, g + 5, 9, 3, pal.puddleLt);
}

/**
 * A wall this plain needs things hung on it, or the bands between the benches
 * read as blank paper rather than as a room.
 */
function drawWallDressing(p: PixelPainter, { width, pal }: GreenhouseScene) {
  // Thermometer, high on the wall where one actually goes.
  p.rect(width - 46, FLOOR_TOP + 22, 9, 52, pal.cream);
  p.rect(width - 46, FLOOR_TOP + 22, 9, 3, pal.ironDk);
  p.rect(width - 44, FLOOR_TOP + 30, 4, 36, pal.zincDk);
  p.rect(width - 44, FLOOR_TOP + 52, 4, 14, pal.potDk);

  // A bunch of herbs hung upside down to dry off the end of the top bench.
  const bx = 62;
  const by = BENCH_Y[0] + 38;
  p.rect(bx - 1, by, 4, 10, pal.woodDkr);
  p.rect(bx - 7, by + 10, 16, 5, pal.twine);
  for (let i = 0; i < 7; i++) {
    const n = noise(i, 8, 191);
    p.rect(bx - 8 + i * 3, by + 15, 3, 16 + n * 12, i % 2 ? pal.leafDk : pal.moss);
    p.rect(bx - 9 + i * 3, by + 22 + n * 10, 5, 4, pal.leaf);
  }

  // Ivy trailing off the far end of the top bench.
  for (let i = 0; i < 9; i++) {
    const n = noise(i, 6, 181);
    p.rect(width - BENCH_INSET - 14 + n * 8, BENCH_Y[0] + 18 + i * 9, 6, 5,
      i % 2 ? pal.leaf : pal.leafDk);
  }
}

/* ---------------------------- potting table ---------------------------- */

/**
 * The bottom strip: backboard, seed rack, soil bin, pot stacks. Everything you
 * drag lives here, because the café taught us the object should sit in the
 * room you drag it in.
 */
function drawPottingTable(p: PixelPainter, scene: GreenhouseScene) {
  const { width, height, pal } = scene;
  const surface = height - TABLE_FROM_BOTTOM;
  const boardTop = surface - 96;

  // Backboard: tongue-and-groove planks with a peg rail.
  p.rect(0, boardTop, width, surface - boardTop, pal.woodDk);
  for (let bx = 0; bx < width; bx += 22) {
    p.rect(bx, boardTop, 20, surface - boardTop, pal.wood);
    p.rect(bx, boardTop, PX, surface - boardTop, pal.woodLt);
  }
  p.rect(0, boardTop, width, 4, pal.woodDkr);
  p.rect(0, boardTop + 4, width, PX, pal.woodLt);

  drawSeedRack(p, RACK.x, height - RACK.fromBottom, RACK.w, RACK.h, pal);
  drawTools(p, width - 116, boardTop + 12, pal);

  // The worktop. Drawn as a genuine slab — a pale top face, a lit front lip
  // and a dark edge under it — because the pot and the can stand on this line
  // and a thin plank left them looking stuck to the backboard.
  p.rect(0, surface - 12, width, 12, pal.slatLt);
  p.rect(0, surface - 12, width, 3, pal.cream);
  // Shadow where the backboard meets the top, which seats the two together.
  p.rect(0, surface - 12, width, 4, pal.woodDk);
  p.rect(0, surface - 8, width, PX, pal.slatLt);

  p.rect(0, surface, width, 10, pal.slat);
  p.rect(0, surface, width, 3, pal.slatLt);
  p.rect(0, surface + 10, width, 5, pal.woodDkr);
  p.rect(0, surface + 15, width, 4, pal.shadow);

  // Scuffs and soil ground into the worktop, so it reads as used.
  for (let i = 0; i < 22; i++) {
    const sx = noise(i, 1, 81) * width;
    p.rect(sx, surface - 10 + noise(i, 2, 82) * 7, 4 + noise(i, 3, 83) * 9, PX,
      noise(i, 4, 84) > 0.6 ? pal.soil : pal.slatDk);
  }

  // Under the table: soil bin, stacked pots, a bag of compost.
  const underTop = surface + 18;
  p.rect(18, underTop + 6, 92, height - underTop - 6, pal.woodDkr);
  p.rect(22, underTop + 10, 84, height - underTop - 10, pal.wood);
  p.rect(22, underTop + 10, 84, 5, pal.soil);
  for (let i = 0; i < 12; i++) {
    p.rect(26 + noise(i, 1, 41) * 74, underTop + 12, 5, 4, pal.soilDk);
  }

  // Terracotta stacked in two towers, the way empty pots actually live.
  [140, 188].forEach((sx, t) => {
    const count = t === 0 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const py = height - 12 - i * 9;
      p.rect(sx - 17 + i, py - 10, 34 - i * 2, 12, pal.potDk);
      p.rect(sx - 15 + i, py - 10, 30 - i * 2, 4, pal.pot);
      p.rect(sx - 15 + i, py - 10, 30 - i * 2, PX, pal.potLt);
    }
  });

  // A slumped sack of compost.
  p.softRect(238, height - 46, 62, 46, pal.seedPaper, 6);
  p.rect(244, height - 40, 50, 4, pal.seedInk);
  p.rect(250, height - 30, 38, 3, pal.seedInk);
  p.rect(238, height - 12, 62, 12, pal.twine);
}

/** Seed packets in a slotted rack — the shop, sitting in the room. */
function drawSeedRack(
  p: PixelPainter,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: GreenhousePalette
) {
  p.rect(x - 4, y - 4, w + 8, h + 10, pal.woodDkr);
  p.rect(x - 2, y - 2, w + 4, h + 6, pal.wood);
  p.rect(x - 2, y - 2, w + 4, PX, pal.woodLt);

  // Two shelves of packets, each a different paper and a different scribble.
  for (let row = 0; row < 2; row++) {
    const ry = y + row * Math.round(h / 2);
    for (let i = 0; i < 4; i++) {
      const px = x + 4 + i * Math.round((w - 8) / 4);
      const pw = Math.round((w - 8) / 4) - 4;
      const ph = Math.round(h / 2) - 8;
      const tint = noise(i, row, 47);
      p.rect(px, ry + 2, pw, ph, pal.seedPaper);
      p.rect(px, ry + 2, pw, PX, pal.cream);
      p.rect(px + 2, ry + 5, pw - 4, 5, tint > 0.5 ? pal.leaf : pal.gold);
      p.rect(px + 2, ry + 13, pw - 6, PX, pal.seedInk);
      p.rect(px + 2, ry + 17, pw - 9, PX, pal.seedInk);
    }
    p.rect(x, ry + Math.round(h / 2) - 5, w, 4, pal.woodDk);
    p.rect(x, ry + Math.round(h / 2) - 5, w, PX, pal.woodLt);
  }
}

/** Trowel, fork and twine on the peg rail — clutter that says the room is used. */
function drawTools(p: PixelPainter, x: number, y: number, pal: GreenhousePalette) {
  p.rect(x - 8, y - 6, 112, 4, pal.woodDkr);

  // Trowel.
  p.rect(x + 6, y, 4, 22, pal.woodDk);
  p.rect(x + 2, y + 22, 12, 16, pal.zinc);
  p.rect(x + 4, y + 24, 8, 10, pal.zincLt);
  p.rect(x + 5, y + 38, 6, 4, pal.zincDk);

  // Hand fork.
  p.rect(x + 34, y, 4, 20, pal.woodDk);
  p.rect(x + 30, y + 20, 12, 5, pal.zinc);
  [30, 34, 38].forEach((tx) => p.rect(x + tx, y + 25, 3, 11, pal.zincDk));

  // Ball of twine hanging off a peg.
  p.rect(x + 68, y, PX, 10, pal.twine);
  p.ellipse(x + 69, y + 18, 11, 10, pal.twine);
  p.ellipse(x + 66, y + 15, 6, 5, pal.seedPaper);
  for (let i = 0; i < 5; i++) p.rect(x + 60 + i * 4, y + 12 + i * 2, 10, PX, pal.seedInk);
}

/* ------------------------------- greenery ------------------------------ */

/** Baskets in the top corners, so the roofline isn't all iron and sky. */
function drawHangingBaskets(p: PixelPainter, { width, pal }: GreenhouseScene) {
  [56, width - 56].forEach((cx, side) => {
    p.rect(cx - PX, 13, PX * 2, 16, pal.ironDkr);
    p.ellipse(cx, 34, 13, 8, pal.zincDk);
    p.ellipse(cx, 32, 12, 7, pal.zinc);
    p.ellipse(cx, 30, 11, 4, pal.zincLt);
    p.ellipse(cx, 28, 10, 4, pal.leaf);

    // Trailing ivy of uneven lengths — matched lengths look like a comb. Kept
    // short: at 50px they hung halfway down the glazing and read as cobwebs.
    [-8, -3, 2, 7].forEach((ox, i) => {
      const len = 12 + Math.floor(noise(cx, i, 19 + side) * 18);
      for (let yy = 0; yy < len; yy += 5) {
        const wob = Math.round((Math.sin((yy + i * 4) / 6) * 3) / PX) * PX;
        p.rect(cx + ox + wob, 34 + yy, 4, 5, i % 2 ? pal.leaf : pal.leafDk);
        if (yy % 15 === 0) p.rect(cx + ox + wob - 2, 34 + yy, 3, 3, pal.leafLt);
      }
    });
  });
}

/* ------------------------- runtime-only overlays ----------------------- */

/** The can's own art box, in design units. */
export const CAN_W = 58;
export const CAN_H = 48;

/**
 * The watering can, drawn into its own small surface rather than into the
 * room. It moves with an `Animated` transform on the view around it, so the
 * pixels are painted once and never redrawn while you drag.
 */
export function drawWateringCan(ctx: Ctx2D, pal: GreenhousePalette) {
  const p = new PixelPainter(ctx);

  // Handle first, so the body's rim overlaps where it meets.
  for (let i = 0; i <= 22; i += PX) {
    const t = i / 22;
    const y = 14 - Math.round(Math.sin(t * Math.PI) * 10);
    p.rect(16 + i, y, PX * 2, 4, pal.zincDk);
    p.rect(16 + i, y, PX * 2, PX, pal.zincLt);
  }

  // Spout: a tapering arm rising to the rose on the left.
  for (let i = 0; i < 16; i += PX) {
    const t = i / 16;
    p.rect(16 - i, 22 + Math.round(t * 6), 6 - t * 2, 7 - t * 2, pal.zinc);
  }
  p.rect(0, 26, 8, 12, pal.zincDk);
  p.rect(1, 27, 6, 10, pal.zinc);
  for (let i = 0; i < 3; i++) p.rect(1, 28 + i * 3, PX, PX, pal.dark);

  // Body: a tapered drum with a rolled rim and a seam.
  p.rect(16, 14, 32, 6, pal.zincDk);
  p.rect(16, 14, 32, PX, pal.zincLt);
  for (let i = 0; i < 24; i += PX) {
    const inset = Math.round((i / 24) * 4);
    p.rect(18 + inset, 20 + i, 28 - inset * 2, PX, pal.zinc);
  }
  p.rect(20, 22, 5, 20, pal.zincLt);
  p.rect(40, 22, 3, 20, pal.zincDk);
  p.rect(18, 44, 28, 4, pal.zincDk);

  // Two hoops, the way a galvanised can is actually built.
  p.rect(18, 28, 28, PX, pal.zincDk);
  p.rect(19, 36, 26, PX, pal.zincDk);

  // Water at the lip.
  p.rect(2, 38, 4, 4, pal.water);
  p.rect(3, 42, PX, PX, pal.waterLt);
}

/**
 * A ring under the socket a dragged pot is currently over. Drawn per-drag
 * rather than into the cached scene, since it tracks the gesture.
 */
export function drawSocketTarget(
  ctx: Ctx2D,
  x: number,
  y: number,
  pal: GreenhousePalette
) {
  const p = new PixelPainter(ctx);
  p.ellipse(x, y - 2, 26, 9, pal.gold);
  p.ellipse(x, y - 2, 21, 7, pal.lampGlow);
  p.ellipse(x, y - 2, 16, 5, pal.gold);
}

/** Droplets over a pot the watering can just passed. */
export function drawSplash(ctx: Ctx2D, x: number, y: number, pal: GreenhousePalette) {
  const p = new PixelPainter(ctx);
  [[-9, -6], [0, -12], [8, -7], [-4, 2], [6, 1]].forEach(([ox, oy], i) => {
    p.rect(x + ox, y + oy, PX * 2, PX * (i % 2 ? 2 : 3), pal.waterLt);
    p.rect(x + ox, y + oy, PX, PX, pal.cream);
  });
}

/**
 * The coins a mature plant is holding, sitting on the pot rim until you tap.
 * Deliberately small and gold: it should catch the eye without competing with
 * the plant it belongs to.
 */
export function drawHarvestGlint(
  ctx: Ctx2D,
  x: number,
  y: number,
  pal: GreenhousePalette
) {
  const p = new PixelPainter(ctx);
  p.ellipse(x, y, 11, 8, pal.lampGlow);
  p.ellipse(x, y, 8, 6, pal.gold);
  p.ellipse(x, y - 1, 6, 4, pal.goldDk);
  p.rect(x - 3, y - 3, 3, 3, pal.cream);
  p.rect(x + 8, y - 8, PX, PX * 3, pal.cream);
  p.rect(x + 6, y - 6, PX * 3, PX, pal.cream);
}

/** A drooping plant asks for water with a bubble, the way a queued cat does. */
export function drawThirstBubble(
  ctx: Ctx2D,
  x: number,
  y: number,
  pal: GreenhousePalette
) {
  const p = new PixelPainter(ctx);
  p.rect(x - 4, y + 13, 4, 4, pal.cream);
  p.rect(x - 2, y + 8, 5, 5, pal.cream);
  p.softRect(x - 11, y - 8, 22, 18, pal.cream, PX * 2);
  p.softRectEdge(x - 11, y - 8, 22, 18, PX, pal.zincDk);

  // A droplet inside it.
  p.rect(x - 1, y - 5, 3, 3, pal.water);
  p.rect(x - 3, y - 2, 7, 5, pal.water);
  p.rect(x - 2, y + 3, 5, 2, pal.water);
  p.rect(x - 2, y - 1, PX, PX, pal.waterLt);
}
