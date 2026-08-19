/**
 * Colour maths shared by the lore and the drink affinity.
 *
 * It lives here rather than in `constants/catLore.ts`, where it started,
 * because `constants/affinity.ts` needs the same two functions and `catLore`
 * needs `affinity` back — a cat's bio names the drink it loves. Leaving the
 * helpers in `catLore` made that a cycle.
 */

export interface Hsl {
  hue: number;
  sat: number;
  light: number;
}

export function toHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { hue: 0, sat: 0, light };

  const sat = delta / (1 - Math.abs(2 * light - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  if (hue < 0) hue += 360;

  return { hue, sat, light };
}

/** Shortest distance between two hues on the wheel, in degrees. */
export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
