import React, { useEffect, useMemo } from 'react';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { drawRoamers, drawTown } from '../town/draw';
import { MAP_PX_H, MAP_PX_W } from '../town/map';
import { createRoamers, stepRoamers } from '../town/roam';
import { createSkiaPainter } from '../town/skiaPainter';
import type { TownSurfaceProps } from './TownSurface.types';

const MAP_RECT = { x: 0, y: 0, w: MAP_PX_W, h: MAP_PX_H };

/**
 * Native path: paints the town through Skia.
 *
 * <canvas> does not exist in React Native, so this is what makes the home
 * screen render on iOS and Android at all.
 *
 * Same two-layer structure as the web path: the streets and buildings are
 * static, so they are recorded once into an SkPicture, and each frame replays
 * that and paints only the wandering cats on top. drawPicture is the Skia
 * equivalent of blitting the offscreen canvas.
 */
export default function TownSurface({
  grid,
  palette,
  roofs,
  isNight,
  catIds,
  scale,
}: TownSurfaceProps) {
  // Frames are published through a shared value so the repaint happens on the
  // render thread — a setState per frame would re-render React 60 times a
  // second for a picture it never inspects.
  const picture = useSharedValue(Skia.PictureRecorder().finishRecordingAsPicture());

  const base = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(MAP_RECT.x, MAP_RECT.y, MAP_RECT.w, MAP_RECT.h)
    );
    drawTown(createSkiaPainter(canvas), palette, roofs, grid, { night: isNight });
    return recorder.finishRecordingAsPicture();
  }, [grid, palette, roofs, isNight]);

  useEffect(() => {
    const roamers = createRoamers(grid, catIds, performance.now());

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      stepRoamers(roamers, grid, now - last, now);
      last = now;

      // A fresh picture per frame rather than one mutated in place — that is
      // what lets Skia hand the finished frame to the render thread.
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(
        Skia.XYWHRect(MAP_RECT.x, MAP_RECT.y, MAP_RECT.w, MAP_RECT.h)
      );
      canvas.drawPicture(base);
      drawRoamers(createSkiaPainter(canvas), roamers, isNight);
      picture.value = recorder.finishRecordingAsPicture();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [base, grid, catIds, isNight, picture]);

  return (
    <Canvas style={{ width: MAP_PX_W * scale, height: MAP_PX_H * scale }}>
      {/* Art is authored at MAP_PX_W; scaling the whole picture here keeps the
          pixel grid square instead of resampling each recorded rect. */}
      <Group transform={[{ scale }]}>
        <Picture picture={picture} />
      </Group>
    </Canvas>
  );
}
