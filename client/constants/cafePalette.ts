/**
 * Colours for the café interior.
 *
 * The town goes dark at night because it *is* outside. A café is not: the
 * lights come on. So night here is two opposite moves at once — the room warms
 * and dims only slightly, while the windows drop to deep navy. The contrast is
 * the whole effect. Dimming the interior 58% the way `town/palette.ts` does
 * would read as "the café closed", which is not what a lit café looks like from
 * the inside.
 */

import { isNightAt } from '../town/palette';

export interface CafePalette {
  /* wall */
  wall: string; wallLt: string; wallDk: string;
  crown: string; crownDk: string;
  wains: string; wainsLt: string; wainsDk: string;

  /* structural wood */
  wood: string; woodLt: string; woodDk: string; woodDkr: string;

  /* floorboards */
  floor: string; floorLt: string; floorDk: string; seam: string;

  /* counter */
  counter: string; counterLt: string; counterDk: string;
  slab: string; slabLt: string; slabDk: string;

  /* brushed metal — espresso machine, taps */
  metal: string; metalLt: string; metalDk: string;

  /* window glass and the view through it */
  sky: string; skyLt: string; hill: string; hillDk: string;
  farRoof: string; farWall: string; farLit: string;

  /* rug — sage by default, terracotta once the shop upgrade is bought */
  rug: string; rugLt: string; rugDk: string;
  rugField: string; rugFieldDk: string; fringe: string;
  rugWarm: string; rugWarmLt: string; rugWarmDk: string;
  rugWarmField: string; rugWarmFieldDk: string;

  /* seat cushions — mint on the plain chairs, rose on the upgraded ones */
  seat: string; seatDk: string;

  /* greenery */
  leaf: string; leafLt: string; leafDk: string; pot: string; potDk: string;

  /* chalkboard menu */
  board: string; boardEdge: string; chalk: string; chalkDim: string;

  /* boba, garnish, accents */
  classic: string; matcha: string; berry: string;
  pearl: string; cream: string; gold: string; goldDk: string;
  mint: string; pink: string;

  /* lighting */
  bulb: string; bulbGlow: string; wire: string;

  shadow: string; softShadow: string; dark: string;
}

export const DAY_CAFE: CafePalette = {
  wall: '#F7E7D4', wallLt: '#FFF4E6', wallDk: '#E8D2BB',
  crown: '#E3C9AE', crownDk: '#CFB094',
  wains: '#D8B792', wainsLt: '#E9CDAC', wainsDk: '#B9926C',

  wood: '#B08268', woodLt: '#CFA189', woodDk: '#8A6350', woodDkr: '#6B4B3C',

  // Light enough that cream and tabby cats still separate from the boards,
  // dark enough that the rug and the counter slab read as lighter than it.
  floor: '#DFBB93', floorLt: '#ECD0A8', floorDk: '#C79E74', seam: '#AC8760',

  counter: '#C08658', counterLt: '#D69E70', counterDk: '#9A6740',
  slab: '#F2E0C8', slabLt: '#FBF1E2', slabDk: '#D6BE9E',

  metal: '#C8CDD4', metalLt: '#E8ECF0', metalDk: '#9AA2AC',

  sky: '#BFE4F2', skyLt: '#E4F5FB', hill: '#9AC48A', hillDk: '#7BA76D',
  farRoof: '#E0A0B8', farWall: '#FFF7F2', farLit: '#FFF7F2',

  // The field sits just *above* the floor's value rather than well above it. As
  // the palest thing in the room the runner stopped being a rug and became a
  // stripe of light down the middle, pulling the eye off the cats.
  rug: '#8FB89B', rugLt: '#A6C9AC', rugDk: '#6E9B7C',
  rugField: '#BFD3BC', rugFieldDk: '#B0C7AE', fringe: '#EBDCC4',
  rugWarm: '#C08066', rugWarmLt: '#DCA07E', rugWarmDk: '#9C5B49',
  rugWarmField: '#E2C4A2', rugWarmFieldDk: '#D4B392',

  // Upholstery for the upgraded chairs. Cream cushions sat at the tabletop's
  // own value and read as blank discs; rose separates by hue instead.
  seat: '#E0A3AB', seatDk: '#A9646C',

  leaf: '#5D9B5B', leafLt: '#7CB878', leafDk: '#3F7A48',
  pot: '#D08A6A', potDk: '#A9694E',

  board: '#4A5A50', boardEdge: '#8A6350', chalk: '#F6F2E6', chalkDim: '#BFCBC0',

  classic: '#C98A5E', matcha: '#9FC47A', berry: '#EFA0B4',
  pearl: '#5A4030', cream: '#FFF7EC', gold: '#EAC97A', goldDk: '#C4A252',
  mint: '#B8E1C6', pink: '#F6C7D5',

  bulb: '#FFE9A8', bulbGlow: '#FFF6D8', wire: '#7B5F4A',

  shadow: 'rgba(112,74,48,0.16)', softShadow: 'rgba(112,74,48,0.09)', dark: '#5E3A2E',
};

/* -------------------------------------------------------------------------- */

function mix(hex: string, r2: number, g2: number, b2: number, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (r2 - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (g2 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (b2 - (n & 255)) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Evening lamplight: a shallow pull toward warm amber, not toward dark. */
const LAMP = { r: 214, g: 158, b: 96 } as const;
const LAMP_STRENGTH = 0.17;

/** Only what's visible *through* the glass gets the town's night treatment. */
const NIGHT_SKY = { r: 44, g: 56, b: 96 } as const;

export function nightCafePalette(day: CafePalette = DAY_CAFE): CafePalette {
  const out = {} as Record<string, string>;

  (Object.keys(day) as (keyof CafePalette)[]).forEach((k) => {
    const v = day[k];
    out[k] = v.startsWith('#') ? mix(v, LAMP.r, LAMP.g, LAMP.b, LAMP_STRENGTH) : v;
  });

  // The view outside. Distant windows stay lit, which is what sells "night"
  // more than the sky colour does.
  out.sky = mix(day.sky, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.86);
  out.skyLt = mix(day.skyLt, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.72);
  out.hill = mix(day.hill, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.78);
  out.hillDk = mix(day.hillDk, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.82);
  out.farRoof = mix(day.farRoof, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.7);
  out.farWall = mix(day.farWall, NIGHT_SKY.r, NIGHT_SKY.g, NIGHT_SKY.b, 0.66);
  out.farLit = '#FFD98A';

  // Bulbs read as light sources rather than beige dots once the room is warm.
  out.bulb = '#FFF0BC';
  out.bulbGlow = '#FFFBE8';

  out.shadow = 'rgba(84,52,30,0.20)';
  out.softShadow = 'rgba(84,52,30,0.12)';

  return out as unknown as CafePalette;
}

export const NIGHT_CAFE = nightCafePalette();

export function cafePaletteFor(night: boolean): CafePalette {
  return night ? NIGHT_CAFE : DAY_CAFE;
}

export { isNightAt };
