/**
 * Turns a grid of colour keys into an SVG data-URI.
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

/**
 * Runs of the same colour on a row are emitted as one wide rect rather than
 * one rect per pixel. A cat sprite is 28x37 with large flat areas of coat, so
 * this cuts a few hundred rects down to a few dozen — worth it when a
 * collection screen builds three dozen of these at once.
 */
export function gridToSvgUri(grid: PixelGrid, palette: PixelPalette): string {
  const rows = grid.length;
  let cols = 0;
  let rects = '';

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
        rects += `<rect x="${runStart}" y="${y}" width="${x - runStart}" height="1" fill="${runColor}"/>`;
        runStart = -1;
        runColor = '';
      }

      if (color) {
        runStart = x;
        runColor = color;
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" ` +
    `shape-rendering="crispEdges">${rects}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
