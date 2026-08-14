import React, { useEffect, useRef } from 'react';

import { createCanvasPainter } from '../town/canvasPainter';
import { drawTown } from '../town/draw';
import { MAP_PX_H, MAP_PX_W } from '../town/map';
import type { TownSurfaceProps } from './TownSurface.types';

/**
 * Web path: paints the town into a real <canvas>.
 *
 * Metro resolves TownSurface.native.tsx on iOS and Android instead, which
 * paints the identical artwork through a Skia painter. Keeping the two behind
 * one filename means TownMap holds the labels and tap targets exactly once.
 */
export default function TownSurface({ grid, palette, roofs, isNight, scale }: TownSurfaceProps) {
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

    ctx.clearRect(0, 0, MAP_PX_W, MAP_PX_H);
    drawTown(createCanvasPainter(ctx), palette, roofs, grid, { night: isNight });
  }, [grid, palette, roofs, isNight]);

  const canvasStyle = {
    width: MAP_PX_W * scale,
    height: MAP_PX_H * scale,
    display: 'block',
    imageRendering: 'pixelated',
  };

  return <canvas ref={canvasRef} style={canvasStyle as any} />;
}
