/**
 * Colours for the greenhouse interior.
 *
 * Three rooms, three different nights. The town goes dark because it is
 * outside. The café warms toward lamplight because a café is lit from within.
 * The greenhouse does neither: real grow lamps are magenta, so the benches sit
 * in pools of pink light while everything visible *through* the glass drops to
 * cold blue. That contrast is the point — you should never mistake this room
 * for the café at a glance, day or night.
 */

import { isNightAt } from '../town/palette';

export interface GreenhousePalette {
  /* white-painted iron frame */
  iron: string; ironLt: string; ironDk: string; ironDkr: string;

  /* glazing */
  glass: string; glassLt: string; glassDk: string; glassEdge: string;
  cond: string;

  /* the view through the glass */
  sky: string; skyLt: string; cloud: string;
  hill: string; hillDk: string; far: string;

  /* limewashed back wall */
  lime: string; limeLt: string; limeDk: string; skirt: string; damp: string;
  /* the short run of floor below it */
  floor: string; floorLt: string; floorDk: string; floorJoint: string;
  moss: string; mossLt: string;
  puddle: string; puddleLt: string;
  /** Aerial perspective — a wash over the far end of the room. */
  haze: string;

  /* the painted back to each bench */
  board: string; boardLt: string; boardDk: string;

  /* painted render on the knee wall the glazing stands on */
  stone: string; stoneLt: string; stoneDk: string;

  /* wet gravel in the bench trays */
  grit: string; gritLt: string; gritDk: string;

  /* benches and the potting table */
  wood: string; woodLt: string; woodDk: string; woodDkr: string;
  slat: string; slatLt: string; slatDk: string;

  /* terracotta and soil */
  pot: string; potLt: string; potDk: string; soil: string; soilDk: string;

  /* the room's own greenery — hanging baskets, ivy */
  leaf: string; leafLt: string; leafDk: string;

  /* galvanised metal — the can, the tools, the drain */
  zinc: string; zincLt: string; zincDk: string;

  /* light: sunbeams by day, grow lamps by night */
  beam: string; beamSoft: string; mote: string;
  lamp: string; lampGlow: string; lampBody: string;

  /* potting-bench clutter */
  seedPaper: string; seedInk: string; twine: string;

  water: string; waterLt: string;
  gold: string; goldDk: string; cream: string;

  shadow: string; softShadow: string; dark: string;
}

export const DAY_GREENHOUSE: GreenhousePalette = {
  iron: '#EFE8DC', ironLt: '#FFFAF1', ironDk: '#D2C7B6', ironDkr: '#A2947F',

  // Glass reads as a pale wash of the sky behind it rather than as a colour of
  // its own — a saturated pane looks like plastic at this resolution.
  glass: '#CBE4E1', glassLt: '#E7F5F1', glassDk: '#ACCDCA', glassEdge: '#93B7B5',
  cond: '#F5FCFA',

  sky: '#BFE4F2', skyLt: '#E4F5FB', cloud: '#FFF7EC',
  hill: '#9AC48A', hillDk: '#7BA76D', far: '#C6DBBE',

  // The back wall was red brick. It read as one warm mid-value field with the
  // pots, the benches and the potting table — squint and the whole room
  // collapsed into tan and nothing had a ground. Limewash is quiet by
  // construction: near-white, barely textured, and it makes terracotta and
  // green the only saturated things on screen.
  lime: '#E9E3D4', limeLt: '#F5F0E3', limeDk: '#D6CEBC',
  skirt: '#DCD3BF', damp: 'rgba(150,146,124,0.30)',

  // Limewash is a WALL, and a wall alone gives the room no ground: the hose,
  // the crates and the drain float. So it stops at a skirting and this short
  // run of stone carries everything that stands on the floor.
  floor: '#B5AB93', floorLt: '#C6BCA4', floorDk: '#A19781', floorJoint: '#847B67',
  moss: '#7CA062', mossLt: '#9ABA7B',
  puddle: '#A6CAD3', puddleLt: '#D5EDF1',
  haze: 'rgba(240,248,246,0.30)',

  // The knee wall is deliberately *not* brick. It was, and brick standing on
  // brick made the floor read as one continuous wall running up the screen —
  // the room lost its ground entirely. Painted render separates them.
  stone: '#E8DFCE', stoneLt: '#F7F1E4', stoneDk: '#C9BCA5',

  // Kept in a *narrow* band on purpose. Speckling pale stone over dark soil
  // turned the bench trays into television static and pulled the eye straight
  // off the plants standing in them, which is the one thing a bench must not
  // do. Three close greys read as damp gravel and stay quiet.
  grit: '#9C9A8E', gritLt: '#B3B0A2', gritDk: '#77756B',

  // Sage, and deliberately the only other hue in the room. Each bench carries
  // a low painted back so every plant has a plain surface behind it instead of
  // whatever texture the wall happens to be doing at that height.
  board: '#CFE0D6', boardLt: '#E4F0E8', boardDk: '#A8BFB3',

  wood: '#C39468', woodLt: '#DCB086', woodDk: '#9A6E4C', woodDkr: '#74503A',
  slat: '#CFA47A', slatLt: '#E4C098', slatDk: '#A87B55',

  pot: '#D08A6A', potLt: '#E4A585', potDk: '#A9694E',
  soil: '#6B4B38', soilDk: '#4F3728',

  leaf: '#5D9B5B', leafLt: '#7CB878', leafDk: '#3F7A48',

  zinc: '#B7C1C3', zincLt: '#DCE4E5', zincDk: '#8A9597',

  // Translucent, so the wall and the bench read through the shaft of light.
  beam: 'rgba(255,248,214,0.20)', beamSoft: 'rgba(255,248,214,0.10)',
  mote: 'rgba(255,253,232,0.80)',
  lamp: '#FFE9A8', lampGlow: '#FFF6D8', lampBody: '#8A9597',

  seedPaper: '#F0E2C4', seedInk: '#7A5A3C', twine: '#C9A87C',

  water: '#8FC6D8', waterLt: '#CDEBF3',
  gold: '#EAC97A', goldDk: '#C4A252', cream: '#FFF7EC',

  shadow: 'rgba(78,56,40,0.18)', softShadow: 'rgba(78,56,40,0.09)', dark: '#4A3427',
};

/* -------------------------------------------------------------------------- */

function mix(hex: string, r2: number, g2: number, b2: number, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (r2 - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (g2 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (b2 - (n & 255)) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Grow lamps. Very shallow: at 0.19 the tint alone turned every wall and pot
 * the same mauve and the room came out as pink mush. The *pools* under each
 * fixture carry the colour instead, which is how a real grow lamp reads.
 */
const GROW = { r: 214, g: 118, b: 186 } as const;
const GROW_STRENGTH = 0.1;

/** Anything on the far side of the glass gets the town's night instead. */
const NIGHT_SKY = { r: 40, g: 52, b: 92 } as const;

export function nightGreenhousePalette(
  day: GreenhousePalette = DAY_GREENHOUSE
): GreenhousePalette {
  const out = {} as Record<string, string>;

  (Object.keys(day) as (keyof GreenhousePalette)[]).forEach((k) => {
    const v = day[k];
    out[k] = v.startsWith('#') ? mix(v, GROW.r, GROW.g, GROW.b, GROW_STRENGTH) : v;
  });

  // Outside. The glass itself keeps a little of the lamps it's reflecting back,
  // which is what stops the walls reading as flat holes.
  out.sky = mix(day.sky, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.88);
  out.skyLt = mix(day.skyLt, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.76);
  out.cloud = mix(day.cloud, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.72);
  out.hill = mix(day.hill, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.82);
  out.hillDk = mix(day.hillDk, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.86);
  out.far = mix(day.far, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.8);
  out.glass = mix(day.glass, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.7);
  out.glassLt = mix(day.glassLt, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.58);
  out.glassDk = mix(day.glassDk, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.74);

  // The shafts of light are no longer sunlight coming in — they're the lamps
  // shining down. Same geometry, opposite direction, different colour.
  out.beam = 'rgba(255,138,222,0.30)';
  out.beamSoft = 'rgba(255,138,222,0.15)';
  out.mote = 'rgba(255,214,244,0.78)';
  out.lamp = '#FF9EDD';
  out.lampGlow = '#FFD6F0';
  // Distance reads cool at night, not warm.
  out.haze = 'rgba(110,120,170,0.26)';

  out.shadow = 'rgba(58,34,52,0.24)';
  out.softShadow = 'rgba(58,34,52,0.12)';

  return out as unknown as GreenhousePalette;
}

export const NIGHT_GREENHOUSE = nightGreenhousePalette();

export function greenhousePaletteFor(night: boolean): GreenhousePalette {
  return night ? NIGHT_GREENHOUSE : DAY_GREENHOUSE;
}

export { isNightAt };
