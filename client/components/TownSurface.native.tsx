import React, { useMemo } from 'react';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';

import { drawTown } from '../town/draw';
import { MAP_PX_H, MAP_PX_W } from '../town/map';
import { createSkiaPainter } from '../town/skiaPainter';
import type { TownSurfaceProps } from './TownSurface.types';

/**
 * Native path: paints the town through Skia.
 *
 * <canvas> does not exist in React Native — rendering one throws — so this is
 * what makes the home screen work on iOS and Android at all.
 *
 * The town is static apart from the day/night flip, so the whole scene is
 * recorded into an SkPicture once and replayed by the GPU on every frame,
 * rather than re-issuing thousands of rect calls. That's why this is a useMemo
 * keyed on the grid and palette instead of a per-frame draw.
 */
export default function TownSurface({
  grid,
  palette,
  roofs,
  isNight,
  scale,
}: TownSurfaceProps) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, MAP_PX_W, MAP_PX_H)
    );
    drawTown(createSkiaPainter(canvas), palette, roofs, grid, { night: isNight });
    return recorder.finishRecordingAsPicture();
  }, [grid, palette, roofs, isNight]);

  return (
    <Canvas style={{ width: MAP_PX_W * scale, height: MAP_PX_H * scale }}>
      {/* Art is authored at MAP_PX_W; scaling here keeps the pixel grid
          square instead of resampling the recorded picture. */}
      <Group transform={[{ scale }]}>
        <Picture picture={picture} />
      </Group>
    </Canvas>
  );
}
