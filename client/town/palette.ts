/**
 * Colours for the town map.
 *
 * Night is not a second set of art. Every colour is mixed toward one navy
 * blue-grey, with glass and gold pulled the other way — since windows are the
 * only thing drawn in `glass`, the town lights itself up for free.
 */

export interface TownPalette {
  grass: string; grassDk: string; grassLt: string;
  water: string; waterLt: string; waterDk: string; foam: string;
  rock: string; rockDk: string; rockLt: string;
  stone: string; stoneDk: string; stoneLt: string;
  road: string; roadDk: string;
  dirt: string; dirtDk: string;
  trunk: string; trunkDk: string;
  leafDk: string; leaf: string; leafLt: string;
  pinkDk: string; pink: string; pinkLt: string;
  pineDk: string; pine: string; pineLt: string;
  amberDk: string; amber: string; amberLt: string;
  berry: string;
  fl1: string; fl2: string; fl3: string; fl4: string; fl5: string;
  wall: string; wallDk: string; wallSh: string;
  wood: string; woodDk: string; woodLt: string;
  glass: string; glassLt: string; glassDk: string;
  gold: string; goldDk: string;
  brick: string; brickDk: string;
  shadow: string; dark: string;
  /** Fills the area outside the map, behind the canvas. */
  backdrop: string;
}

/** Three tones per roof: mid, dark, light. */
export type RoofColor = readonly [string, string, string];
export type RoofKey = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';

export const DAY_PALETTE: TownPalette = {
  grass: '#A8C98C', grassDk: '#8FB374', grassLt: '#C4DFA8',
  water: '#8FCEE0', waterLt: '#B8E3EE', waterDk: '#66ACC2', foam: '#F0FBFD',
  rock: '#C6B1A8', rockDk: '#A28E86', rockLt: '#DCCCC4',
  stone: '#EFE0CA', stoneDk: '#D4C0A2', stoneLt: '#FAF0E0',
  road: '#E0CCAE', roadDk: '#BFA98A',
  dirt: '#D3B0A0', dirtDk: '#B08E80',
  trunk: '#8A6A54', trunkDk: '#6E5342',
  leafDk: '#3F7A48', leaf: '#5D9B5B', leafLt: '#7CB878',
  pinkDk: '#D97FA6', pink: '#F2A8C4', pinkLt: '#FBCCDC',
  pineDk: '#2E5E3E', pine: '#43784F', pineLt: '#5E9464',
  amberDk: '#C4802E', amber: '#E0A24A', amberLt: '#F2BE72',
  berry: '#D6465E',
  fl1: '#E88BA8', fl2: '#B48BC9', fl3: '#7FC4C8', fl4: '#FFFFFF', fl5: '#EAC97A',
  wall: '#FFF7F2', wallDk: '#F2E1DE', wallSh: '#DCC5C4',
  wood: '#B08268', woodDk: '#8A6350', woodLt: '#CFA189',
  glass: '#BFE4F2', glassLt: '#E4F5FB', glassDk: '#89C2D8',
  gold: '#EAC97A', goldDk: '#C4A252',
  brick: '#C08A8A', brickDk: '#9A6A6A',
  shadow: 'rgba(90,60,60,0.14)', dark: '#5E3A46',
  backdrop: '#A8C98C',
};

export const DAY_ROOFS: Record<RoofKey, RoofColor> = {
  a: ['#E88BA8', '#C46685', '#F5B0C6'],
  b: ['#B48BC9', '#8F68A4', '#CFAEE0'],
  c: ['#7FC4C8', '#5AA0A4', '#A6DCDF'],
  d: ['#F0B27A', '#C88A54', '#F8CDA4'],
  e: ['#E0A0B8', '#BC7A94', '#F0C2D2'],
  f: ['#9AB88A', '#78966A', '#BAD2AC'],
  g: ['#EAC97A', '#C4A252', '#F5E0A8'],
  h: ['#C98A9A', '#A26575', '#E0AEBA'],
};

/** Navy blue-grey, not black. Everything converges here after dark. */
const NIGHT_TINT = { r: 58, g: 72, b: 112 } as const;
const NIGHT_STRENGTH = 0.58;

function mixHex(hex: string, r2: number, g2: number, b2: number, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (r2 - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (g2 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (b2 - (n & 255)) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function toNight(hex: string): string {
  return mixHex(hex, NIGHT_TINT.r, NIGHT_TINT.g, NIGHT_TINT.b, NIGHT_STRENGTH);
}

/**
 * Pulls an arbitrary colour toward the night tint. Cats are drawn from their
 * own palettes, so without this they'd stay lit while the town went dark.
 * Slightly weaker than the terrain mix so they still read against it.
 */
export function dimForNight(hex: string): string {
  return mixHex(hex, NIGHT_TINT.r, NIGHT_TINT.g, NIGHT_TINT.b, NIGHT_STRENGTH * 0.8);
}

export function nightPalette(day: TownPalette = DAY_PALETTE): TownPalette {
  const out = {} as Record<string, string>;
  (Object.keys(day) as (keyof TownPalette)[]).forEach((k) => {
    const v = day[k];
    out[k] = v.startsWith('#') ? toNight(v) : v;
  });

  // Warm light is the whole trick: windows are the only thing using glass.
  out.glass = '#FFD98A';
  out.glassLt = '#FFEEC4';
  out.glassDk = '#D9A64E';
  out.gold = '#FFDE9A';
  out.goldDk = '#C9A054';
  out.foam = mixHex(day.foam, 150, 178, 226, 0.42);
  out.waterLt = mixHex(day.waterLt, 140, 170, 220, 0.42);
  out.shadow = 'rgba(18,24,54,0.30)';
  out.backdrop = '#4A5570';

  return out as unknown as TownPalette;
}

export function nightRoofs(day: Record<RoofKey, RoofColor> = DAY_ROOFS): Record<RoofKey, RoofColor> {
  const out = {} as Record<RoofKey, RoofColor>;
  (Object.keys(day) as RoofKey[]).forEach((k) => {
    const [m, d, l] = day[k];
    out[k] = [toNight(m), toNight(d), toNight(l)];
  });
  return out;
}

/** True roughly between 7pm and 6am. */
export function isNightAt(date: Date = new Date()): boolean {
  const h = date.getHours();
  return h >= 19 || h < 6;
}
