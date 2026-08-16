import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

import { gridCols, COIN, type IconSpec, PEARL, STAR } from './iconGrids';

/**
 * Currency and popularity icons, drawn from the pixel grids in iconGrids.ts.
 *
 * One path for every platform. The obvious alternative — an SVG data-URI in an
 * <Image> — renders nothing on iOS or Android, because React Native's <Image>
 * decodes PNG/JPEG/GIF/WebP but not SVG; that only ever worked on web, where
 * <Image> becomes a browser <img>.
 *
 * Skia would draw these too, but each <Canvas> is a GPU-backed surface and the
 * top bar keeps three icons mounted on every screen. Skia is worth that for
 * the town and the café, which redraw every frame; static chrome is not.
 */

function PixelIcon({ spec, size }: { spec: IconSpec; size: number }) {
  const { grid, palette, label } = spec;
  const cols = gridCols(grid);

  const cells = useMemo(() => {
    const out: React.ReactElement[] = [];
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const ch = grid[y][x];
        const color = ch === '.' ? undefined : palette[ch];
        if (!color) continue;
        // width/height 1.02 rather than 1: neighbouring cells otherwise leave
        // hairline seams when the viewBox is scaled to a fractional size.
        out.push(
          <Rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} />
        );
      }
    }
    return out;
  }, [grid, palette]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols} ${grid.length}`}
      accessibilityLabel={label}
    >
      {cells}
    </Svg>
  );
}

export function CoinIcon({ size = 14 }: { size?: number }) {
  return <PixelIcon spec={COIN} size={size} />;
}

export function PearlIcon({ size = 14 }: { size?: number }) {
  return <PixelIcon spec={PEARL} size={size} />;
}

export function PopularityIcon({ size = 14 }: { size?: number }) {
  return <PixelIcon spec={STAR} size={size} />;
}
