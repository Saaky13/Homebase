import React, { useEffect, useRef } from 'react';

import { createCanvasPainter } from '../town/canvasPainter';
import { drawRoamers, drawTown } from '../town/draw';
import { MAP_PX_H, MAP_PX_W } from '../town/map';
import { createRoamers, stepRoamers } from '../town/roam';
import type { TownSurfaceProps } from './TownSurface.types';

/**
 * Web path: paints the town into a real <canvas>.
 *
 * Metro resolves TownSurface.native.tsx on iOS and Android instead, which
 * paints the identical artwork through Skia. Keeping both behind one filename
 * means TownMap holds the labels and tap targets exactly once.
 */
export default function TownSurface({
  grid,
  palette,
  roofs,
  isNight,
  catIds,
  scale,
}: TownSurfaceProps) {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Backing store stays at art resolution; CSS does the scaling so the
    // pixels stay square.
    canvas.width = MAP_PX_W;
    canvas.height = MAP_PX_H;
    ctx.imageSmoothingEnabled = false;

    // The town is thousands of one-pixel rects and never changes. Painting it
    // once into an offscreen layer and blitting that each frame is the
    // difference between redrawing a whole tilemap 60 times a second and
    // copying one image.
    const base =
      typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let baseCtx: CanvasRenderingContext2D | null = null;
    if (base) {
      base.width = MAP_PX_W;
      base.height = MAP_PX_H;
      baseCtx = base.getContext('2d');
    }

    if (baseCtx) {
      baseCtx.imageSmoothingEnabled = false;
      drawTown(createCanvasPainter(baseCtx), palette, roofs, grid, { night: isNight });
    } else {
      // No offscreen canvas available — fall back to a single static paint so
      // the town still renders, just without wandering cats.
      ctx.clearRect(0, 0, MAP_PX_W, MAP_PX_H);
      drawTown(createCanvasPainter(ctx), palette, roofs, grid, { night: isNight });
      return;
    }

    const painter = createCanvasPainter(ctx);
    const roamers = createRoamers(grid, catIds, performance.now());

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      stepRoamers(roamers, grid, now - last, now);
      last = now;

      ctx.clearRect(0, 0, MAP_PX_W, MAP_PX_H);
      ctx.drawImage(base as HTMLCanvasElement, 0, 0);
      drawRoamers(painter, roamers, isNight);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [grid, palette, roofs, isNight, catIds]);

  const canvasStyle = {
    width: MAP_PX_W * scale,
    height: MAP_PX_H * scale,
    display: 'block',
    imageRendering: 'pixelated',
  };

  return <canvas ref={canvasRef} style={canvasStyle as any} />;
}
