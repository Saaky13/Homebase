import React, { useEffect, useMemo, useRef } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { createCanvasPainter } from '../town/canvasPainter';
import { drawRoamers, drawTown } from '../town/draw';
import {
  BUILDINGS, buildTownGrid, FOUNTAIN, FOUNTAIN_R, GREENHOUSE, MAP_PX_H, MAP_PX_W, TILE,
} from '../town/map';
import {
  DAY_PALETTE, DAY_ROOFS, isNightAt, nightPalette, nightRoofs,
} from '../town/palette';
import { createRoamers, stepRoamers } from '../town/roam';
import { useCafeState } from '../hooks/useCafeState';

/** Keeps the town lively without turning the paths into a parade. */
const MAX_ROAMERS = 16;

/**
 * Tap target around the fountain — the Growth Hub entrance.
 *
 * Derived from `FOUNTAIN_R` so it can never drift from the basin, and extended
 * upward past it: the centrepiece stands well clear of the water, and the
 * statue is the part of the landmark you actually aim at.
 */
const STATUE_REACH = 70;
const FOUNTAIN_HIT = {
  x: FOUNTAIN.tx * TILE - FOUNTAIN_R.x,
  y: FOUNTAIN.ty * TILE - STATUE_REACH,
  w: FOUNTAIN_R.x * 2,
  h: STATUE_REACH + FOUNTAIN_R.down,
};

/**
 * The greenhouse is drawn from its own spec rather than as a BuildingSpec —
 * it's glass, not brick, and shares none of the roof/window/door vocabulary —
 * so it needs its own hit target instead of riding the BUILDINGS loop.
 */
const GREENHOUSE_HIT = {
  x: GREENHOUSE.tx * TILE,
  y: GREENHOUSE.ty * TILE,
  w: GREENHOUSE.tw * TILE,
  h: GREENHOUSE.th * TILE,
};

export default function TownMap({ night }: { night?: boolean }) {
  const canvasRef = useRef<any>(null);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { state } = useCafeState();

  const isNight = night ?? isNightAt();
  // The grid comes from stable noise, so it only needs building once.
  const grid = useMemo(() => buildTownGrid(), []);

  // The cats out walking are exactly the ones you've adopted — a cat you don't
  // own is nowhere in the app. Joined into a string so the animation effect
  // restarts only when the cast actually changes, not on every state write.
  const catKey = state.ownedCats.slice(0, MAX_ROAMERS).join(',');
  const catIds = useMemo(() => (catKey ? catKey.split(',') : []), [catKey]);

  // The map is 384px wide; narrower phones scale it down rather than clip.
  const scale = Math.min(1, width / MAP_PX_W);

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

    const palette = isNight ? nightPalette() : DAY_PALETTE;
    const roofs = isNight ? nightRoofs() : DAY_ROOFS;

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
  }, [grid, isNight, catIds]);

  const canvasStyle = {
    width: MAP_PX_W * scale,
    height: MAP_PX_H * scale,
    display: 'block',
    imageRendering: 'pixelated',
  };

  const labelBox = isNight ? styles.labelNight : styles.labelDay;
  const labelText = isNight ? styles.labelTextNight : styles.labelTextDay;

  const renderLabel = (key: string, cx: number, top: number, text: string, big?: boolean) => (
    <View
      key={key}
      pointerEvents="none"
      style={[styles.labelWrap, { left: cx - 40, top }]}
    >
      <View style={[labelBox, big && styles.hubLabel]}>
        <Text style={[labelText, big && styles.hubLabelText]}>{text}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { backgroundColor: isNight ? '#4A5570' : '#A8C98C' },
      ]}
    >
      <View style={{ width: MAP_PX_W * scale, height: MAP_PX_H * scale }}>
        {/* Web path. Native draws the same thing through a Skia painter —
            see town/canvasPainter.ts for the seam. */}
        <canvas ref={canvasRef} style={canvasStyle as any} />

        {/* Transparent hit targets rather than canvas hit-testing: the specs
            already carry footprints, so press states and accessibility
            labels come for free. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Growth Hub"
          onPress={() => router.push('/habits')}
          style={({ pressed }) => [
            styles.hit,
            {
              left: FOUNTAIN_HIT.x * scale,
              top: FOUNTAIN_HIT.y * scale,
              width: FOUNTAIN_HIT.w * scale,
              height: FOUNTAIN_HIT.h * scale,
            },
            pressed && styles.hitPressed,
          ]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Greenhouse"
          onPress={() => router.push('/greenhouse' as any)}
          style={({ pressed }) => [
            styles.hit,
            {
              left: GREENHOUSE_HIT.x * scale,
              top: GREENHOUSE_HIT.y * scale,
              width: GREENHOUSE_HIT.w * scale,
              height: GREENHOUSE_HIT.h * scale,
            },
            pressed && styles.hitPressed,
          ]}
        />

        {BUILDINGS.filter((b) => b.route).map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={b.label ?? b.id}
            onPress={() => router.push(b.route as any)}
            style={({ pressed }) => [
              styles.hit,
              {
                left: b.tx * TILE * scale,
                top: b.ty * TILE * scale,
                width: b.tw * TILE * scale,
                height: b.th * TILE * scale,
              },
              pressed && styles.hitPressed,
            ]}
          />
        ))}

        {BUILDINGS.filter((b) => b.label).map((b) =>
          renderLabel(
            b.id,
            (b.tx * TILE + (b.tw * TILE) / 2) * scale,
            (b.ty * TILE + b.th * TILE + 1) * scale,
            b.label as string
          )
        )}

        {renderLabel(
          'greenhouse',
          (GREENHOUSE_HIT.x + GREENHOUSE_HIT.w / 2) * scale,
          (GREENHOUSE_HIT.y + GREENHOUSE_HIT.h + 1) * scale,
          'Greenhouse'
        )}

        {renderLabel(
          'growth-hub',
          FOUNTAIN.tx * TILE * scale,
          (FOUNTAIN.ty * TILE + FOUNTAIN_R.down + 3) * scale,
          'Growth Hub',
          true
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  hit: { position: 'absolute' },
  hitPressed: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 4 },
  labelWrap: { position: 'absolute', width: 80, alignItems: 'center' },
  labelDay: {
    backgroundColor: 'rgba(255,247,242,0.62)',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  labelNight: {
    backgroundColor: 'rgba(40,44,74,0.62)',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  labelTextDay: { fontSize: 8, color: 'rgba(94,58,70,0.9)' },
  labelTextNight: { fontSize: 8, color: 'rgba(226,220,238,0.92)' },
  hubLabel: { paddingHorizontal: 7, paddingVertical: 2 },
  hubLabelText: { fontSize: 9 },
});
