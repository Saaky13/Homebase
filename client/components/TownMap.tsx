import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
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

/** Keeps the town lively without turning the paths into a parade. */
const MAX_ROAMERS = 16;

/** The café's footprint, for hanging the waiting-customer indicator off. */
const CAFE_SPEC = BUILDINGS.find((b) => b.id === 'cafe') ?? null;

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

/**
 * The box `drawRoamers` paints a cat into, in map pixels.
 *
 * Shared by the tap test and the card's anchor so the two can never disagree
 * about where a cat is — the tap would land on one box and the card point at
 * another.
 */
function roamerBox(r: Roamer): { x: number; y: number; w: number; h: number } | null {
  const spec = getCat(r.catId);
  if (!spec) return null;

  // Mini grids are trimmed to their own ink, so the size depends on the pose.
  const grid = getMiniCatGrid(spec, r.dir);
  const w = grid[0]?.length ?? 0;
  const h = grid.length;

  return { x: r.tx * TILE + TILE / 2 - w / 2, y: r.ty * TILE + TILE / 2 - h + 2, w, h };
}

export default function TownMap({ night }: { night?: boolean }) {
  const canvasRef = useRef<any>(null);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { state, isLoading } = useCafeState();

  const isNight = night ?? isNightAt();
  // The grid comes from stable noise, so it only needs building once.
  const grid = useMemo(() => buildTownGrid(), []);

  // The cats out walking are exactly the ones you've adopted — a cat you don't
  // own is nowhere in the app. Joined into a string so the animation effect
  // restarts only when the cast actually changes, not on every state write.
  const catKey = state.ownedCats.slice(0, MAX_ROAMERS).join(',');
  const catIds = useMemo(() => (catKey ? catKey.split(',') : []), [catKey]);

  /**
   * The café roster, read through a ref by the render loop rather than as an
   * effect dependency: a cat walking in the door is a routine event, and
   * restarting the effect would rebuild every roamer and send the whole cast
   * back to its spawn tile each time one did.
   */
  const visitRef = useRef(state.cafeVisit);
  visitRef.current = state.cafeVisit;

  const catIdsRef = useRef(catIds);
  catIdsRef.current = catIds;

  /**
   * What the café-door indicator counts: cats standing in line, not seated
   * ones. State rather than a memo, because a cat *joins* the line by a
   * timestamp going stale — no state changes at that moment — so the render
   * loop samples `countWaiting` each frame and pushes the number here when it
   * moves. The effect covers the other direction (serving, going home), which
   * does change state, and keeps the badge honest even when the tab is
   * backgrounded and frames stop.
   */
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    setWaiting(countWaiting(state.cafeVisit, Date.now()));
  }, [state.cafeVisit]);

  // The map is 384px wide; narrower phones scale it down rather than clip.
  const scale = Math.min(1, width / MAP_PX_W);

  // `stepRoamers` mutates this array in place every frame — the ref just
  // needs to point at whatever `createRoamers` built for the live effect, so
  // a tap always hits where a cat actually is rather than a stale snapshot.
  const roamersRef = useRef<Roamer[]>([]);

  // There is exactly one roamer per owned cat, so the roster id identifies the
  // cat on the map as well as the entry on the card.
  const [inspectedCatId, setInspectedCatId] = useState<string | null>(null);
  const inspectedRef = useRef<string | null>(null);
  inspectedRef.current = inspectedCatId;

  /**
   * The card follows a cat that is walking across town, so its position is
   * driven straight from the render loop rather than through props. Feeding
   * it through state would re-render the whole map sixty times a second.
   */
  const cardPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cardPointerX = useRef(new Animated.Value(0)).current;
  const cardHRef = useRef(CARD_H_ESTIMATE);
  const cardFlip = useRef(new Animated.Value(0)).current;

  // Read by the render loop, which must not re-run on a resize — restarting it
  // would rebuild every roamer and send the whole cast back to its spawn tile.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

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
      roamersRef.current = [];
      return;
    }

    // Before the save loads, `cafeVisit` is the empty default and every cat
    // looks like it's out here — including whoever has been standing in line
    // since yesterday. Paint the town and wait: the effect re-runs on load
    // with a cast that is right from the first frame, instead of spawning
    // cats it then has to march back through the café door.
    if (isLoading) {
      ctx.clearRect(0, 0, MAP_PX_W, MAP_PX_H);
      ctx.drawImage(base, 0, 0);
      roamersRef.current = [];
      return;
    }

    const painter = createCanvasPainter(ctx);
    const door = cafeDoorTile(grid);

    // Whoever is *inside* the café doesn't start out here — a cat already in
    // line stays absent rather than walking in a second time. A cat still on
    // its way over does spawn (wherever it last stood, thanks to the position
    // memory); the frame loop's clock watch sends it back on its way on the
    // first frame, so opening the map mid-journey catches it on the street
    // instead of losing the trip.
    const bootClock = Date.now();
    const inside = catsInside(visitRef.current, bootClock);
    const roamers: Roamer[] = [];
    catIds.forEach((id) => {
      if (inside.has(id)) return;
      const born = createRoamer(grid, id, performance.now());
      if (born) roamers.push(born);
    });
    roamersRef.current = roamers;

    /**
     * The visit state the cast was last reconciled against.
     *
     * `settleCafeVisit` and friends return the same object when nothing
     * changed, so a new identity means the roster actually moved — an identity
     * check skips the diff entirely on the frames in between, which is nearly
     * all of them.
     */
    let syncedTo: CafeVisitState = visitRef.current;

    const syncRoamers = (now: number) => {
      const visit = visitRef.current;
      if (visit === syncedTo) return;
      syncedTo = visit;

      const clock = Date.now();
      const inCafe = catsInside(visit, clock);
      const walking = catsEnRoute(visit, clock);

      // Setting off is the frame loop's job — a departure is a timestamp
      // coming due, not a state change, and staggered groupmates come due
      // one at a time. All this pass handles is a visit *vanishing* while
      // its cat was still walking over (a prune, a reset): finish the
      // roamer and let the re-spawn below put it back on the map.
      roamers.forEach((r) => {
        if (r.leaving && !inCafe.has(r.catId) && !walking.has(r.catId)) r.done = true;
      });

      // Done cats are dropped here as well as in the frame loop so the
      // membership check below sees an accurate cast.
      for (let i = roamers.length - 1; i >= 0; i--) {
        if (roamers[i].done) roamers.splice(i, 1);
      }

      // Finished their drink and gone home. They come back out of the café's
      // own door rather than reappearing wherever they were standing when
      // they went in.
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

      // A visit's two in-between moments — a cat's turn to set off, and its
      // walk window closing — are timestamps coming due, not state changes,
      // so the frame loop is what watches for them. Due to set off: head for
      // the door (staggered groupmates leave one at a time — see
      // WALK_STAGGER_MS). Window closed on a cat still short of the door:
      // it's in line now (the café is drawing it), so it can't also be out
      // here — it slips inside from where it stands, and its spot is
      // remembered like any other despawn.
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

      // A cat that has reached the café door is inside now. Removing it here
      // rather than at sync time is what makes the walk-in read as a walk-in.
      for (let i = roamers.length - 1; i >= 0; i--) {
        if (roamers[i].done) roamers.splice(i, 1);
      }

      ctx.clearRect(0, 0, MAP_PX_W, MAP_PX_H);
      ctx.drawImage(base as HTMLCanvasElement, 0, 0);
      drawRoamers(painter, roamers, isNight);

      // Joining the line is a timestamp going stale, not a state write, so the
      // badge is sampled here. The equality guard keeps the setState free on
      // the frames where nothing moved — which is nearly all of them.
      const inLine = countWaiting(visitRef.current, clock);
      setWaiting((prev) => (prev === inLine ? prev : inLine));

      // Walk the card along with the cat it belongs to. Written straight to
      // the Animated values so a cat crossing town costs no re-renders.
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
      // The town looks how you left it: snapshot everyone's position so the
      // next mount resumes the cast in place instead of rescattering it.
      rememberRoamers(roamersRef.current);
    };
  }, [grid, isNight, catIds, isLoading]);

  /** How close a tap has to land to a roaming cat's sprite box, in design pixels. */
  const INSPECT_PAD = 6;

  /**
   * Tap the map: find the roamer whose sprite box the tap landed in and show
   * its preferences. Mirrors `CafeCanvas`'s `handleInspectTap` — same
   * `clientX`/`clientY` read (react-native-web's `Pressable` never populates
   * `locationX`/`locationY` on `onPress`), but measured against the overlay's
   * own rect, since the canvas here is only ever scaled, never translated.
   */
  const handleInspectTap = useCallback((e: GestureResponderEvent) => {
    const native = e.nativeEvent as unknown as { clientX?: number; clientY?: number };
    const target = e.currentTarget as unknown as { getBoundingClientRect?: () => DOMRect };
    const rect = target?.getBoundingClientRect?.();
    if (native.clientX == null || native.clientY == null || !rect) return;

    const x = (native.clientX - rect.left) / scale;
    const y = (native.clientY - rect.top) / scale;

    let best: Roamer | null = null;
    let bestDist = Infinity;

    roamersRef.current.forEach((r) => {
      // Padded a little so a slightly short tap still lands — a cat is about
      // twelve pixels tall on a 384-wide map.
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
    // Tapping the open cat again closes it, the way tapping away does.
    setInspectedCatId((prev) => (hit && hit === prev ? null : hit));
  }, [scale]);

  const inspectedCat = inspectedCatId ? getCat(inspectedCatId) ?? null : null;

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

          {/* Tap a roaming cat to see what it likes. Rendered beneath the
              building/fountain/greenhouse hit targets below, so a tap that
              lands on a doorway still navigates — this only ever catches taps
              that miss every building. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleInspectTap}
            accessibilityRole="none"
          />

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

          {/* Someone is in line. Pinned to the café's own roofline rather than
              shown as a global counter, because the point of it is to tell you
              *which* door to go to — and it disappears the moment the last cat
              is served, so an empty café never wears a badge. */}
          {CAFE_SPEC && waiting > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.queueBadge,
                isNight ? styles.queueBadgeNight : styles.queueBadgeDay,
                {
                  left: ((CAFE_SPEC.tx + CAFE_SPEC.tw) * TILE - 12) * scale,
                  top: (CAFE_SPEC.ty * TILE - 6) * scale,
                },
              ]}
            >
              <Text style={styles.queueBadgeText}>{waiting}</Text>
            </View>
          )}

          {/* Last in the box so it sits over the buildings, and inside it so
              it scrolls with the cat rather than hanging in the viewport. */}
          {inspectedCat && (
            <CatInspectCard
              cat={inspectedCat}
              recipes={state.recipes ?? []}
              bondXp={state.catStats[inspectedCat.id]?.bondXp ?? 0}
              pos={cardPos}
              pointerX={cardPointerX}
              flip={cardFlip}
              onHeight={(h) => {
                cardHRef.current = h;
              }}
              onOpenAlmanac={() => {
                // Closed before navigating: the town stays mounted under the
                // pushed screen, and coming back to a card pinned on a cat
                // that has since wandered off reads as a glitch.
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

  /**
   * Sized in screen pixels, not map pixels: it's a piece of UI hung on the
   * town, not part of the art, and at map scale on a narrow phone the number
   * would be three pixels tall.
   */
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
  queueBadgeDay: { backgroundColor: '#E88973' },
  queueBadgeNight: { backgroundColor: '#D87E97' },
  queueBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF9F0' },
});
