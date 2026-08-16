/**
 * The capsule machine in the Cat Shelter, built as pixel grids.
 *
 * Authored in code rather than as ASCII art: the dome is a real circle and the
 * capsules are real discs, so the shape stays clean and the proportions are a
 * parameter rather than a redraw. Same colour-key-plus-palette contract the cat
 * sprites and currency icons use, so it renders through utils/pixelSvg.
 */

export type Grid = string[][];

export const MACHINE_W = 36;
export const MACHINE_H = 54;

/**
 * Where the crank sits on the body, in grid cells. The crank is drawn as its
 * own sprite on top so it can rotate, so the body deliberately leaves this
 * area plain and the component positions the overlay from these numbers.
 */
export const CRANK_CENTER = { x: 24, y: 36 };

/** Where a dispensed capsule comes to rest, in grid cells. */
export const TRAY_CENTER = { x: 17, y: 44 };

export const MACHINE_PALETTE: Record<string, string> = {
  O: '#5A3D52', // outline, a deep plum rather than black
  G: '#CFE8F5', // dome glass
  g: '#FFFFFF', // glass shine
  B: '#E8899B', // body
  b: '#C96B80', // body shade
  H: '#F5AEBB', // body highlight
  M: '#E7B85C', // brass
  m: '#B8882D', // brass shade
  T: '#3E2A38', // tray opening
  P: '#8A5A70', // machine base
  // capsule colours, pulled from the app's pastel set
  '1': '#F6C7D5',
  '2': '#A9D7F3',
  '3': '#FFE7A3',
  '4': '#B8E1C6',
};

function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string>(w).fill('.'));
}

function disc(g: Grid, cx: number, cy: number, r: number, key: string) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) g[y][x] = key;
    }
  }
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, key: string) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) continue;
      g[y][x] = key;
    }
  }
}

/** Traces a one-pixel outline around every filled cell that touches empty space. */
function outline(g: Grid, key = 'O') {
  const h = g.length;
  const w = g[0].length;
  const copy = g.map((row) => [...row]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (copy[y][x] !== '.') continue;
      const touches =
        (y > 0 && copy[y - 1][x] !== '.') ||
        (y < h - 1 && copy[y + 1][x] !== '.') ||
        (x > 0 && copy[y][x - 1] !== '.') ||
        (x < w - 1 && copy[y][x + 1] !== '.');
      if (touches) g[y][x] = key;
    }
  }
}

/** Where the capsules sit inside the dome, and what colour each one is. */
const CAPSULES: Array<[number, number, string]> = [
  [12, 11, '1'],
  [19, 8, '2'],
  [25, 13, '3'],
  [13, 18, '4'],
  [20, 16, '1'],
  [26, 20, '2'],
  [16, 23, '3'],
  [23, 24, '4'],
];

function buildMachine(): Grid {
  const g = blank(MACHINE_W, MACHINE_H);

  // Dome: glass sphere full of capsules.
  disc(g, 18, 16, 14, 'G');

  // A soft shine down the upper-left of the glass, drawn before the capsules
  // so they read as sitting behind it.
  disc(g, 12, 9, 3, 'g');
  disc(g, 14, 12, 1.5, 'g');

  for (const [cx, cy, key] of CAPSULES) disc(g, cx, cy, 2.4, key);

  // Collar where the dome meets the body.
  rect(g, 5, 28, 30, 30, 'M');
  rect(g, 5, 30, 30, 31, 'm');

  // Body.
  rect(g, 6, 31, 29, 47, 'B');
  rect(g, 6, 31, 9, 47, 'H'); // left highlight
  rect(g, 26, 31, 29, 47, 'b'); // right shade

  // Coin slot, on the left so it clears the crank overlay on the right.
  rect(g, 9, 34, 15, 36, 'm');
  rect(g, 10, 35, 14, 35, 'T');

  // Dispensing tray: a dark opening with a brass lip, below both.
  rect(g, 11, 40, 23, 46, 'T');
  rect(g, 10, 46, 24, 47, 'm');

  // Base.
  rect(g, 4, 48, 31, 50, 'P');
  rect(g, 6, 51, 29, 51, 'P');

  outline(g);
  return g;
}

/** The crank, kept separate so it can be rotated independently of the body. */
function buildCrank(): Grid {
  const g = blank(13, 13);
  disc(g, 6, 6, 4.2, 'M');
  disc(g, 6, 6, 2.2, 'm');
  // Handle stub, so a rotation actually reads as turning.
  rect(g, 5, 0, 7, 4, 'M');
  disc(g, 6, 1, 1.8, 'M');
  outline(g);
  return g;
}

/** A single capsule, for the one that drops into the tray. */
function buildCapsule(topKey: string): Grid {
  const g = blank(11, 11);
  disc(g, 5, 5, 4.2, topKey);
  // Lower half slightly darker so it reads as two shells.
  for (let y = 6; y <= 10; y++) {
    for (let x = 0; x < 11; x++) {
      if (g[y][x] === topKey) g[y][x] = 'g';
    }
  }
  disc(g, 3, 3, 1.2, 'g');
  outline(g);
  return g;
}

export const MACHINE_GRID = buildMachine();
export const CRANK_GRID = buildCrank();

export const CAPSULE_GRIDS: Record<string, Grid> = {
  '1': buildCapsule('1'),
  '2': buildCapsule('2'),
  '3': buildCapsule('3'),
  '4': buildCapsule('4'),
};

export const CAPSULE_KEYS = ['1', '2', '3', '4'];
