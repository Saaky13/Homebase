/**
 * Turns a grid of colour keys into drawable horizontal runs, and from there
 * into an SVG data-URI.
 *
 * Both pixel-art systems in the app speak the same language — a grid of
 * single-character keys plus a palette mapping those keys to hex — but they
 * store rows differently: the currency icons use one string per row, the cat
 * sprites use an array of characters. Indexing is identical for both, so this
 * takes either.
 *
 * `.` and any key missing from the palette are transparent.
 */

export type PixelRow = string | readonly string[];
export type PixelGrid = readonly PixelRow[];
export type PixelPalette = Record<string, string>;

/** One horizontal span of a single colour: `w` cells starting at `x` on row `y`. */
export interface PixelRun {
  x: number;
  y: number;
  w: number;
  color: string;
}

export interface PixelRuns {
  runs: PixelRun[];
  cols: number;
  rows: number;
}

/**
 * Runs of the same colour on a row are emitted as one wide span rather than
 * one per pixel. A cat sprite is 28x37 with large flat areas of coat, so this
 * cuts a thousand cells down to a few dozen spans — worth it when a collection
 * screen builds three dozen of these at once, and it is what makes drawing
 * them as real <Rect> elements on a phone affordable at all.
 */
export function gridToRuns(grid: PixelGrid, palette: PixelPalette): PixelRuns {
  const rows = grid.length;
  const runs: PixelRun[] = [];
  let cols = 0;

  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    if (row.length > cols) cols = row.length;

    let runStart = -1;
    let runColor = '';

    // One past the end so a run touching the right edge still gets flushed.
    for (let x = 0; x <= row.length; x++) {
      const key = x < row.length ? row[x] : undefined;
      const color = key && key !== '.' ? palette[key] : undefined;

      if (color === runColor && runStart !== -1) continue;

      if (runStart !== -1) {
        runs.push({ x: runStart, y, w: x - runStart, color: runColor });
        runStart = -1;
        runColor = '';
      }

      if (color) {
        runStart = x;
        runColor = color;
      }
    }
  }

  return { runs, cols, rows };
}

/** One SVG path per distinct colour: `d` is every run of that colour, as subpaths. */
export interface PixelPath {
  color: string;
  d: string;
}

export interface PixelPaths {
  paths: PixelPath[];
  cols: number;
  rows: number;
}

/**
 * Collapses a grid into one path per colour — the form that is cheap enough to
 * draw as real SVG on a phone.
 *
 * A front-facing cat sprite is ~600 opaque cells, which is ~214 horizontal
 * runs, which is 6 or 7 distinct colours. Every one of those becomes a native
 * view node on iOS, so a 36-cat grid is the difference between ~21,000 nodes
 * per-cell, ~7,700 per-run, and ~235 per-colour. Only the last one is a grid
 * you can scroll.
 *
 * The 0.02 overdraw on each subpath is the hairline-seam fix: scaling the
 * viewBox to a fractional point size otherwise leaves gaps between neighbouring
 * runs, which reads as a sprite full of scratches. At 28 units wide drawn at
 * 128pt that bleed is under a tenth of a point, so where two colours meet it is
 * invisible; between two cells of one colour it is the whole point.
 */
export function gridToPaths(grid: PixelGrid, palette: PixelPalette): PixelPaths {
  const { runs, cols, rows } = gridToRuns(grid, palette);

  // Insertion order, so the output is deterministic for a given grid.
  const byColor = new Map<string, string>();
  for (const run of runs) {
    const d =
      `M${run.x} ${run.y}h${run.w + 0.02}v1.02h-${run.w + 0.02}z`;
    byColor.set(run.color, (byColor.get(run.color) ?? '') + d);
  }

  const paths: PixelPath[] = [];
  byColor.forEach((d, color) => paths.push({ color, d }));

  return { paths, cols, rows };
}

/**
 * Web-only. React Native's <Image> decodes PNG/JPEG/GIF/WebP and *not* SVG, so
 * a data-URI built here renders nothing on iOS or Android — it only ever worked
 * because <Image> becomes a browser <img> on web. Anything that has to appear
 * on a phone draws its runs as <Rect> elements instead; see PixelSprite.tsx.
 */
export function gridToSvgUri(grid: PixelGrid, palette: PixelPalette): string {
  const { runs, cols, rows } = gridToRuns(grid, palette);

  let rects = '';
  for (const run of runs) {
    rects +=
      `<rect x="${run.x}" y="${run.y}" width="${run.w}" height="1" fill="${run.color}"/>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" ` +
    `shape-rendering="crispEdges">${rects}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
