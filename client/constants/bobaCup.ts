/**
 * The boba cup you drag onto a waiting cat.
 *
 * Unlike the cat sprites and the capsule machine, this grid is generated rather
 * than authored: the cup has to come in three flavours and at a few fill
 * levels, and hand-keeping four near-identical 20x30 grids in sync is how they
 * drift apart.
 */

export type BobaFlavor = 'classic' | 'matcha' | 'strawberry';

const W = 20;
const H = 30;

const LID_TOP = 7;
const LID_BOTTOM = 10;
const BODY_TOP = 11;
const BODY_BOTTOM = 28;

/** Palette keys, shared by every flavour; only the tea colour changes. */
export const BOBA_PALETTE: Record<BobaFlavor, Record<string, string>> = {
  classic: {
    o: '#6B4B3C', c: '#FFF7EC', h: '#FFFFFF', l: '#D8E4EC',
    t: '#C98A5E', u: '#E0A87E', p: '#4A3226', s: '#E88DA6', d: '#B0BEC8',
  },
  matcha: {
    o: '#4C5F42', c: '#FFF7EC', h: '#FFFFFF', l: '#DCE8D4',
    t: '#9FC47A', u: '#BEDB9C', p: '#3E5230', s: '#7FC4C8', d: '#B3C4A8',
  },
  strawberry: {
    o: '#7A4658', c: '#FFF7EC', h: '#FFFFFF', l: '#F6D9E2',
    t: '#EFA0B4', u: '#F8C4D2', p: '#5A3040', s: '#B48BC9', d: '#D9B6C2',
  },
};

/** Body half-width taper, so the cup reads as a truncated cone. */
function bodyEdges(y: number): [number, number] {
  const t = (y - BODY_TOP) / (BODY_BOTTOM - BODY_TOP);
  const inset = Math.round(t * 2);
  return [2 + inset, 17 - inset];
}

/**
 * @param fill 0–1, how full the cup is. The idle cup on the counter is full;
 *             a poured one empties as it hands over.
 */
export function bobaCupGrid(fill = 1): string[][] {
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));

  // Straw, entering the lid.
  for (let y = 0; y < LID_TOP + 1; y++) {
    g[y][12] = 's';
    g[y][13] = 's';
  }

  // Lid: capped top and bottom rims with a light band between.
  for (let x = 1; x <= 18; x++) {
    g[LID_TOP][x] = 'o';
    g[LID_BOTTOM][x] = 'o';
  }
  for (let y = LID_TOP + 1; y < LID_BOTTOM; y++) {
    g[y][1] = 'o';
    g[y][18] = 'o';
    for (let x = 2; x <= 17; x++) g[y][x] = 'l';
  }
  g[LID_TOP + 1][2] = 'h';
  g[LID_TOP + 1][3] = 'h';

  // Where the drink surface sits inside the body.
  const span = BODY_BOTTOM - (BODY_TOP + 2);
  const surfaceY = BODY_BOTTOM - Math.round(span * Math.max(0, Math.min(1, fill)));

  for (let y = BODY_TOP; y <= BODY_BOTTOM; y++) {
    const [l, r] = bodyEdges(y);
    g[y][l] = 'o';
    g[y][r] = 'o';
    for (let x = l + 1; x < r; x++) {
      g[y][x] = y >= surfaceY ? 't' : 'c';
    }
    // Vertical highlight down the left of the cup.
    if (y > BODY_TOP) g[y][l + 1] = y >= surfaceY ? 'u' : 'h';
  }

  // A lighter band right at the drink's surface.
  if (surfaceY > BODY_TOP && surfaceY <= BODY_BOTTOM) {
    const [l, r] = bodyEdges(surfaceY);
    for (let x = l + 1; x < r; x++) g[surfaceY][x] = 'u';
  }

  // Tapioca, settled in the bottom third and only where there's drink.
  const pearls: [number, number][] = [
    [5, 24], [9, 24], [13, 24], [7, 26], [11, 26], [6, 22], [12, 22],
  ];
  pearls.forEach(([px, py]) => {
    if (py < surfaceY) return;
    const [l, r] = bodyEdges(py);
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = px + dx;
        const y = py + dy;
        if (y > BODY_BOTTOM || x <= l || x >= r) continue;
        g[y][x] = 'p';
      }
    }
  });

  // Base.
  const [bl, br] = bodyEdges(BODY_BOTTOM);
  for (let x = bl; x <= br; x++) g[BODY_BOTTOM + 1][x] = 'o';

  return g;
}
