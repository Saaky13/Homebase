import { Skia, type SkImage } from '@shopify/react-native-skia';

/**
 * Rasterises a pixel grid into an SkImage the café canvas can draw.
 *
 * Shared by the cat sprites and the boba cups. A 28x37 cat is ~1,000 cells and
 * a cup is 600; painting those as individual rects every frame, for every cat
 * on the floor, is not viable at 60fps. Each grid is drawn once into an
 * offscreen surface and the snapshot is reused.
 */
export function rasteriseGrid(
  grid: string[][],
  palette: Record<string, string>
): SkImage | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (!width || !height) return null;

  // Drawn at the grid's own pixel size; callers scale it up at draw time.
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(false);

  for (let y = 0; y < height; y++) {
    const row = grid[y];
    // Runs of one colour become a single rect, the same trick utils/pixelSvg
    // uses — large flat areas collapse to a few dozen draws.
    let runStart = -1;
    let runColor: string | undefined;

    for (let x = 0; x <= row.length; x++) {
      const cellKey = x < row.length ? row[x] : undefined;
      const color = cellKey && cellKey !== '.' ? palette[cellKey] : undefined;

      if (color === runColor && runStart !== -1) continue;

      if (runStart !== -1 && runColor) {
        paint.setColor(Skia.Color(runColor));
        canvas.drawRect(Skia.XYWHRect(runStart, y, x - runStart, 1), paint);
      }

      runStart = color ? x : -1;
      runColor = color;
    }
  }

  return surface.makeImageSnapshot();
}
