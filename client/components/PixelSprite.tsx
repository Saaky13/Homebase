import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { PixelPaths } from '../utils/pixelSvg';

/**
 * Draws pixel art as real SVG, one <Path> per colour.
 *
 * This is the one sprite path that works everywhere. The obvious alternative —
 * an SVG data-URI in an <Image> — renders nothing on iOS or Android, because
 * React Native's <Image> decodes PNG/JPEG/GIF/WebP but not SVG. That only ever
 * worked on web, where <Image> becomes a browser <img>.
 *
 * It takes pre-computed paths rather than a grid and palette on purpose: a
 * scrolling list mounts and unmounts these constantly, and the grid walk should
 * run once per sprite for the life of the app, not once per mount. Callers own
 * that cache — see `getCatPaths` in CatSprite.tsx.
 *
 * Skia would draw these too, but a <Canvas> is a GPU-backed surface per
 * instance, which is the wrong trade for three dozen static cells in a list.
 */

export interface PixelSpriteProps {
  paths: PixelPaths;
  /** Width in points. Height follows the grid's aspect unless given. */
  width: number;
  height?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function PixelSprite({ paths, width, height, label, style }: PixelSpriteProps) {
  const { paths: shapes, cols, rows } = paths;
  if (!cols || !rows) return null;

  const h = height ?? Math.round(width * (rows / cols));

  return (
    <Svg
      width={width}
      height={h}
      viewBox={`0 0 ${cols} ${rows}`}
      style={style}
      accessibilityLabel={label}
    >
      {shapes.map((shape) => (
        <Path key={shape.color} d={shape.d} fill={shape.color} />
      ))}
    </Svg>
  );
}

export default PixelSprite;
