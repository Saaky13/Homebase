/**
 * The hub's day/night material.
 *
 * The town and café both cross over on the shared `isNightAt()` clock, and the
 * hub joins them. Re-checked on a 60s timer for the same reason `CafeCanvas`
 * does it: a screen left open through 7pm should cross over on its own rather
 * than waiting for a reload.
 *
 * This is not dark mode — see the note on `NIGHT_MATERIAL`.
 */

import { useEffect, useState } from 'react';
import { PixelMaterial, materialAt } from '../../constants/pixelTheme';

export function usePixelMaterial(): PixelMaterial {
  const [material, setMaterial] = useState<PixelMaterial>(() => materialAt());

  useEffect(() => {
    const id = setInterval(() => {
      const next = materialAt();
      // Compared by identity: both palettes are module constants, so this only
      // re-renders on an actual crossover, not once a minute.
      setMaterial((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return material;
}
