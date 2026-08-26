/**
 * Native (iOS/Android) implementation of TownMap.
 *
 * The web path uses a raw <canvas> DOM element (TownMap.tsx). Metro resolves
 * this file on native, where there is no DOM canvas — instead, a Skia Canvas
 * from @shopify/react-native-skia renders the town through the same `Painter`
 * interface and the same `drawTown`/`drawRoamers` functions. Nothing in those
 * functions knows or cares which painter it receives.
 *
 * Architecture mirrors CafeCanvas:
 *  - The static background is recorded once into an `SkPicture` (re-recorded
 *    only when night/day or catIds changes).
 *  - A `requestAnimationFrame` loop composites the background + roaming cats
 *    into a second `SkPicture` each frame.
 *  - Both are published through Reanimated `SharedValue`s so Skia repaints
 *    without a React re-render.
 *  - The React overlay (tap targets, labels, badge, inspect card) sits in an
 *    absolutely-positioned View over the Canvas — identical to the web path.
 *
 * Tap handling:
 *  On native, `onPress` populates `locationX`/`locationY` in `nativeEvent`,
 *  which is all we need — no `getBoundingClientRect`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import { createSkiaPainter } from '../town/skiaPainter';
import { drawRoamers, drawTown } from '../town/draw';
import {
  BUILDINGS, buildTownGrid, FOUNTAIN, FOUNTAIN_R, GREENHOUSE, MAP_PX_H, MAP_PX_W, TILE,
} from '../town/map';
import {
  DAY_PALETTE, DAY_ROOFS, isNightAt, nightPalette, nightRoofs,
} from '../town/palette';
import {
  cafeDoorTile, createRoamer, rememberRoamers, rememberSpot, sendRoamerToCafe,
  stepRoamers, type Roamer,
} from '../town/roam';
import {
  catsEnRoute, catsInside, countWaiting, hasJoined, type CafeVisitState,
} from '../constants/cafeVisit';
import { useCafeState } from '../hooks/useCafeState';
import { getCat, getMiniCatGrid } from '../constants/catSprites';
import CatInspectCard, { CARD_H_ESTIMATE, anchorCard } from './CatInspectCard';

const MAX_ROAMERS = 16;
const INSPECT_PAD = 6;

const CAFE_SPEC = BUILDINGS.find((b) => b.id === 'cafe') ?? null;

const STATUE_REACH = 70;
const FOUNTAIN_HIT = {
  x: FOUNTAIN.tx * TILE - FOUNTAIN_R.x,
  y: FOUNTAIN.ty * TILE - STATUE_REACH,
  w: FOUNTAIN_R.x * 2,
  h: STATUE_REACH + FOUNTAIN_R.down,
};

const GREENHOUSE_HIT = {
  x: GREENHOUSE.tx * TILE,
  y: GREENHOUSE.ty * TILE,
  w: GREENHOUSE.tw * TILE,
  h: GREENHOUSE.th * TILE,
};

function roamerBox(r: Roamer): { x: number; y: number; w: number; h: number } | null {
  const spec = getCat(r.catId);
  if (!spec) return null;
  const grid = getMiniCatGrid(spec, r.dir);
  const w = grid[0]?.length ?? 0;
  const h = grid.length;
  return { x: r.tx * TILE + TILE / 2 - w / 2, y: r.ty * TILE + TILE / 2 - h + 2, w, h };
}

export default function TownMap({ night }: { night?: boolean }) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  // Prefer the measured container width over the window width: on native
  // the window dimensions are accurate, but guarding against 0 costs nothing.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth || MAP_PX_W;

  const { state, isLoading } = useCafeState();
  const isNight = night ?? isNightAt();
  const grid = useMemo(() => buildTownGrid(), []);

  const catKey = state.ownedCats.slice(0, MAX_ROAMERS).join(',');
  const catIds = useMemo(() => (catKey ? catKey.split(',') : []), [catKey]);

  const visitRef = useRef(state.cafeVisit);
  visitRef.current = state.cafeVisit;

  const catIdsRef = useRef(catIds);
  catIdsRef.current = catIds;

  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    setWaiting(countWaiting(state.cafeVisit, Date.now()));
  }, [state.cafeVisit]);

  const scale = width > 0 ? Math.min(1, width / MAP_PX_W) : 1;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const roamersRef = useRef<Roamer[]>([]);
  const [inspectedCatId, setInspectedCatId] = useState<string | null>(null);
  const inspectedRef = useRef<string | null>(null);
  inspectedRef.current = inspectedCatId;

  const cardPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cardPointerX = useRef(new Animated.Value(0)).current;
  const cardHRef = useRef(CARD_H_ESTIMATE);
  const cardFlip = useRef(new Animated.Value(0)).current;

  // The composite frame (background + cats) published each rAF tick.
  const picture = useSharedValue(Skia.PictureRecorder().finishRecordingAsPicture());

  // The static background is recorded once per palette/night change.
  // Re-recording on every frame would repaint thousands of rects for nothing.
  const backgroundPicture = useMemo(() => {
    const palette = isNight ? nightPalette() : DAY_PALETTE;
    const roofs   = isNight ? nightRoofs()   : DAY_ROOFS;
    const recorder = Skia.PictureRecorder();
    const canvas   = recorder.beginRecording(Skia.XYWHRect(0, 0, MAP_PX_W, MAP_PX_H));
    drawTown(createSkiaPainter(canvas), palette, roofs, grid, { night: isNight });
    return recorder.finishRecordingAsPicture();
  }, [isNight, grid]);

  const backgroundRef = useRef(backgroundPicture);
  backgroundRef.current = backgroundPicture;

  // Animation loop — mirrors the web rAF loop in TownMap.tsx almost exactly,
  // except the composite is written to a SharedValue instead of a 2D canvas.
  useEffect(() => {
    if (isLoading) {
      // Paint the background, no cats yet — the visit isn't settled.
      const recorder = Skia.PictureRecorder();
      const c = recorder.beginRecording(Skia.XYWHRect(0, 0, MAP_PX_W, MAP_PX_H));
      c.drawPicture(backgroundRef.current);
      picture.value = recorder.finishRecordingAsPicture();
      roamersRef.current = [];
      return;
    }

    const bootClock = Date.now();
    const inside = catsInside(visitRef.current, bootClock);
    const roamers: Roamer[] = [];
    catIds.forEach((id) => {
      if (inside.has(id)) return;
      const born = createRoamer(grid, id, performance.now());
      if (born) roamers.push(born);
    });
    roamersRef.current = roamers;

    const door = cafeDoorTile(grid);
    let syncedTo: CafeVisitState = visitRef.current;

    const syncRoamers = (now: number) => {
      const visit = visitRef.current;
      if (visit === syncedTo) return;
      syncedTo = visit;

      const clock = Date.now();
      const inCafe   = catsInside(visit, clock);
      const walking  = catsEnRoute(visit, clock);

      roamers.forEach((r) => {
        if (r.leaving && !inCafe.has(r.catId) && !walking.has(r.catId)) r.done = true;
      });
      for (let i = roamers.length - 1; i >= 0; i--) {
        if (roamers[i].done) roamers.splice(i, 1);
      }

      const onMap = new Set(roamers.map((r) => r.catId));
      catIdsRef.current.forEach((id) => {
        if (inCafe.has(id) || walking.has(id) || onMap.has(id)) return;
        const born = createRoamer(grid, id, now, door ?? undefined);
        if (born) roamers.push(born);
      });
    };

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      syncRoamers(now);
      stepRoamers(roamers, grid, now - last, now);
      last = now;

      const clock = Date.now();
      for (const r of roamers) {
        if (r.done) continue;
        const c = visitRef.current.customers.find((v) => v.catId === r.catId);
        if (!c) continue;
        if (hasJoined(c, clock)) {
          rememberSpot(r.catId, r.tx, r.ty);
          r.done = true;
        } else if (c.setOffAt <= clock && !r.leaving) {
          sendRoamerToCafe(r, grid);
        }
      }
      for (let i = roamers.length - 1; i >= 0; i--) {
        if (roamers[i].done) roamers.splice(i, 1);
      }

      // Composite frame: replay the cached background, then draw roamers on top.
      const palette = isNight ? nightPalette() : DAY_PALETTE;
      const roofs   = isNight ? nightRoofs()   : DAY_ROOFS;
      const recorder = Skia.PictureRecorder();
      const skCanvas = recorder.beginRecording(Skia.XYWHRect(0, 0, MAP_PX_W, MAP_PX_H));
      skCanvas.drawPicture(backgroundRef.current);
      drawRoamers(createSkiaPainter(skCanvas), roamers, isNight);
      picture.value = recorder.finishRecordingAsPicture();

      const inLine = countWaiting(visitRef.current, clock);
      setWaiting((prev) => (prev === inLine ? prev : inLine));

      const watching = inspectedRef.current;
      if (watching) {
        const r = roamers.find((cat) => cat.catId === watching);
        const box = r ? roamerBox(r) : null;
        if (box) {
          const s = scaleRef.current;
          const spot = anchorCard(
            (box.x + box.w / 2) * s,
            box.y * s,
            (box.y + box.h) * s,
            { width: MAP_PX_W * s, height: MAP_PX_H * s },
            cardHRef.current
          );
          cardPos.setValue({ x: spot.x, y: spot.y });
          cardPointerX.setValue(spot.pointerX);
          cardFlip.setValue(spot.below ? 1 : 0);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      rememberRoamers(roamersRef.current);
    };
  }, [grid, isNight, catIds, isLoading, picture, cardPos, cardPointerX, cardFlip]);

  /**
   * Tap a roaming cat to inspect it.
   *
   * On native, `locationX`/`locationY` give us position inside the pressed
   * element directly — no `getBoundingClientRect` needed.
   */
  const handleInspectTap = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const x = locationX / scale;
    const y = locationY / scale;

    let best: Roamer | null = null;
    let bestDist = Infinity;

    roamersRef.current.forEach((r) => {
      const box = roamerBox(r);
      if (!box) return;
      if (x < box.x - INSPECT_PAD || x > box.x + box.w + INSPECT_PAD) return;
      if (y < box.y - INSPECT_PAD || y > box.y + box.h + INSPECT_PAD) return;
      const dist = Math.hypot(box.x + box.w / 2 - x, box.y + box.h / 2 - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = r;
      }
    });

    const hit = best ? (best as Roamer).catId : null;
    setInspectedCatId((prev) => (hit && hit === prev ? null : hit));
  }, [scale]);

  const inspectedCat = inspectedCatId ? getCat(inspectedCatId) ?? null : null;

  const labelBox  = isNight ? styles.labelNight : styles.labelDay;
  const labelText = isNight ? styles.labelTextNight : styles.labelTextDay;

  const renderLabel = (key: string, cx: number, top: number, text: string, big?: boolean) => (
    <View key={key} pointerEvents="none" style={[styles.labelWrap, { left: cx - 40, top }]}>
      <View style={[labelBox, big && styles.hubLabel]}>
        <Text style={[labelText, big && styles.hubLabelText]}>{text}</Text>
      </View>
    </View>
  );

  const w = MAP_PX_W * scale;
  const h = MAP_PX_H * scale;

  return (
    <ScrollView
      style={styles.scroll}
      onLayout={(e) => {
        const mw = e.nativeEvent.layout.width;
        setMeasuredWidth((prev) => (Math.abs(prev - mw) > 0.5 ? mw : prev));
      }}
      contentContainerStyle={[
        styles.content,
        { backgroundColor: isNight ? '#4A5570' : '#A8C98C' },
      ]}
    >
      <View style={{ width: w, height: h }}>
        {/* The Skia Canvas fills the map box exactly; the Group scales art
            pixels to screen pixels. */}
        <Canvas style={{ width: w, height: h }}>
          <Group transform={[{ scale }]}>
            <Picture picture={picture} />
          </Group>
        </Canvas>

        {/* Tap-to-inspect overlay — must be absolutely positioned so it
            doesn't split the height with the Canvas. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleInspectTap}
          accessibilityRole="none"
        />

        {/* Fountain / Growth Hub */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Growth Hub"
          onPress={() => router.push('/habits')}
          style={({ pressed }) => [
            styles.hit,
            {
              left:   FOUNTAIN_HIT.x * scale,
              top:    FOUNTAIN_HIT.y * scale,
              width:  FOUNTAIN_HIT.w * scale,
              height: FOUNTAIN_HIT.h * scale,
            },
            pressed && styles.hitPressed,
          ]}
        />

        {/* Greenhouse */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Greenhouse"
          onPress={() => router.push('/greenhouse' as any)}
          style={({ pressed }) => [
            styles.hit,
            {
              left:   GREENHOUSE_HIT.x * scale,
              top:    GREENHOUSE_HIT.y * scale,
              width:  GREENHOUSE_HIT.w * scale,
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
                left:   b.tx * TILE * scale,
                top:    b.ty * TILE * scale,
                width:  b.tw * TILE * scale,
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

        {CAFE_SPEC && waiting > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.queueBadge,
              isNight ? styles.queueBadgeNight : styles.queueBadgeDay,
              {
                left: ((CAFE_SPEC.tx + CAFE_SPEC.tw) * TILE - 12) * scale,
                top:  (CAFE_SPEC.ty * TILE - 6) * scale,
              },
            ]}
          >
            <Text style={styles.queueBadgeText}>{waiting}</Text>
          </View>
        )}

        {inspectedCat && (
          <CatInspectCard
            cat={inspectedCat}
            recipes={state.recipes ?? []}
            bondXp={state.catStats[inspectedCat.id]?.bondXp ?? 0}
            customer={
              state.cafeVisit.customers.find((c) => c.catId === inspectedCat.id) ?? null
            }
            pos={cardPos}
            pointerX={cardPointerX}
            flip={cardFlip}
            onHeight={(h) => { cardHRef.current = h; }}
            onOpenAlmanac={() => {
              setInspectedCatId(null);
              router.push(`/cats?cat=${inspectedCat.id}`);
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  hit:     { position: 'absolute' },
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
  labelTextDay:   { fontSize: 8, color: 'rgba(94,58,70,0.9)' },
  labelTextNight: { fontSize: 8, color: 'rgba(226,220,238,0.92)' },
  hubLabel:     { paddingHorizontal: 7, paddingVertical: 2 },
  hubLabelText: { fontSize: 9 },
  queueBadge: {
    position: 'absolute',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF7F2',
  },
  queueBadgeDay:   { backgroundColor: '#E88973' },
  queueBadgeNight: { backgroundColor: '#D87E97' },
  queueBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF9F0' },
});
