import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { useCafeState } from '../hooks/useCafeState';
import { SkiaCanvas2D, type Ctx2D } from './skiaCanvas2d';
import {
  createCat,
  updateCat,
  drawCat,
  drawCatDrink,
  retargetCat,
  sendCatToSeat,
  sendCatOut,
  isCatOffscreen,
  Cat,
} from './Cat';
import {
  getQueueSpots,
  getSeatSpots,
  drawCafeScene,
  drawServeTarget,
  drawWantBubble,
  CUP_STATION,
} from './cafeRender';
import { snap } from './cafePixel';
import { cafePaletteFor, isNightAt } from '../constants/cafePalette';
import { spawnIntervalMs, maxGroupSize } from '../constants/popularity';
import BobaCupSprite, { CUP_ASPECT } from './BobaCupSprite';
import type { BobaFlavor } from '../constants/bobaCup';
import { PearlIcon } from './Icons';

type Table = {
  id: string;
  seatIndexes: number[];
};

// The room is authored 390 wide and scaled *uniformly*, so the art pixels stay
// square — stretching each axis to fit turned a 2px pixel into a 1.9x1.7 smear
// and squashed the cats about a tenth. Only the width is pinned: the height
// flows, so the floorboards run to the bottom edge of whatever screen this is
// instead of being letterboxed or cropped.
const DESIGN_WIDTH = 390;
/** Fallback height before the first layout pass, and the shortest room we draw. */
const DESIGN_HEIGHT = 844;
/** Below this the counter, the ten tables and the door stop fitting. */
const MIN_DESIGN_HEIGHT = 720;
/** Keeps a phone-shaped café phone-shaped in a wide browser window. */
const MAX_SCALE = 1.35;

const CUP_WIDTH = 46;
const CUP_HEIGHT = CUP_WIDTH * CUP_ASPECT;
/** How close the cup has to get, in design units, before a cat counts as hit. */
const DROP_RADIUS = 52;
const PEARLS_PER_CAT = 5;

export default function CafeCanvas() {
  const catsRef = useRef<Cat[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const autoSpawnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrored into a ref so spawning tracks the collection without re-running
  // the main effect, which would tear down the canvas and the render loop.
  const ownedCatsRef = useRef<string[]>([]);
  const pearlsRef = useRef(0);
  const popularityRef = useRef(0);
  // Read by the serve, which runs from a gesture handler rather than a render.
  const flavorRef = useRef<BobaFlavor>('classic');
  // The cat the cup is currently hovering, read by the render loop to draw the
  // target ring. A ref rather than state so dragging doesn't re-render at 60fps.
  const dragTargetRef = useRef<Cat | null>(null);

  // The frame is published as a SharedValue so Skia repaints without a React
  // re-render on each of the 60 frames per second.
  const picture = useSharedValue(Skia.PictureRecorder().finishRecordingAsPicture());

  // Seeded from the window so the very first frame is already about the right
  // size; onLayout corrects it to the actual canvas box a tick later.
  const [layout, setLayout] = useState(() => {
    const win = Dimensions.get('window');
    return {
      width: win.width || DESIGN_WIDTH,
      height: win.height || DESIGN_HEIGHT,
    };
  });
  const [canServe, setCanServe] = useState(false);
  const [serveCost, setServeCost] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [night, setNight] = useState(() => isNightAt());

  const { state, addCoins, spendPearls, addDrinkServed } = useCafeState();

  const scale = Math.min(layout.width / DESIGN_WIDTH, MAX_SCALE);
  // Snapped to the art grid so the floorboard courses don't land on half pixels.
  const designHeight = Math.max(snap(layout.height / scale), MIN_DESIGN_HEIGHT);
  const offsetX = (layout.width - DESIGN_WIDTH * scale) / 2;

  // The render loop reads the room size through a ref so a rotation or a window
  // resize doesn't tear down the canvas and restart the spawn schedule.
  const designHeightRef = useRef(designHeight);
  designHeightRef.current = designHeight;

  useEffect(() => {
    pearlsRef.current = state.pearls;
  }, [state.pearls]);

  useEffect(() => {
    ownedCatsRef.current = state.ownedCats;
  }, [state.ownedCats]);

  // Held in a ref so spawn pacing tracks popularity without re-running the
  // main effect, which would tear down the canvas listeners and render loop.
  useEffect(() => {
    popularityRef.current = state.popularity;
  }, [state.popularity]);

  // The room lights itself at dusk. Checked on a timer rather than derived at
  // render time, so a café left open crosses over without a reload.
  useEffect(() => {
    const id = setInterval(() => setNight(isNightAt()), 60000);
    return () => clearInterval(id);
  }, []);

  const palette = useMemo(() => cafePaletteFor(night), [night]);

  /* ----------------------------- simulation ---------------------------- */

  const getQueueCats = () =>
    catsRef.current.filter(
      (cat) => cat.state === 'walkingToLine' || cat.state === 'waiting'
    );

  const getFrontGroupInQueue = () => {
    const queueCats = getQueueCats();
    if (!queueCats.length) return [];
    return queueCats.filter((cat) => cat.groupId === queueCats[0].groupId);
  };

  const getTables = (): Table[] => {
    const seats = getSeatSpots();
    const grouped: Record<string, number[]> = {};

    seats.forEach((seat, index) => {
      if (!grouped[seat.tableId]) grouped[seat.tableId] = [];
      grouped[seat.tableId].push(index);
    });

    return Object.entries(grouped).map(([id, seatIndexes]) => ({
      id,
      seatIndexes,
    }));
  };

  const getOccupiedSeatIndexes = () =>
    new Set(
      catsRef.current
        .filter((cat) => cat.seatIndex !== null)
        .map((cat) => cat.seatIndex as number)
    );

  const getOpenSeatIndexesForTable = (table: Table) => {
    const occupied = getOccupiedSeatIndexes();
    return table.seatIndexes.filter((seatIndex) => !occupied.has(seatIndex));
  };

  const getCatsAtTable = (table: Table) => {
    const set = new Set(table.seatIndexes);
    return catsRef.current.filter(
      (cat) => cat.seatIndex !== null && set.has(cat.seatIndex)
    );
  };

  function shuffleArray<T>(array: T[]) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const findSeatIndexesForGroup = (groupSize: number): number[] | null => {
    const tables = shuffleArray(getTables());

    if (groupSize > 1) {
      const emptyTable = tables.find((table) => {
        const catsAtTable = getCatsAtTable(table).length;
        const openSeats = getOpenSeatIndexesForTable(table).length;
        return catsAtTable === 0 && openSeats >= groupSize;
      });

      if (!emptyTable) return null;
      return shuffleArray(getOpenSeatIndexesForTable(emptyTable)).slice(0, groupSize);
    }

    const soloWantsOwnTable = Math.random() < 0.8;

    if (soloWantsOwnTable) {
      const emptyTable = tables.find((table) => {
        const catsAtTable = getCatsAtTable(table).length;
        return catsAtTable === 0 && getOpenSeatIndexesForTable(table).length >= 1;
      });

      if (emptyTable) {
        return [shuffleArray(getOpenSeatIndexesForTable(emptyTable))[0]];
      }
    }

    const openTable = tables.find((table) => {
      const catsAtTable = getCatsAtTable(table).length;
      const openSeats = getOpenSeatIndexesForTable(table).length;
      return catsAtTable > 0 && openSeats >= 1;
    });

    if (openTable) {
      return [shuffleArray(getOpenSeatIndexesForTable(openTable))[0]];
    }

    const fallbackEmpty = tables.find(
      (table) => getOpenSeatIndexesForTable(table).length >= 1
    );

    if (!fallbackEmpty) return null;
    return [shuffleArray(getOpenSeatIndexesForTable(fallbackEmpty))[0]];
  };

  const canServeFrontGroup = () => {
    const front = getFrontGroupInQueue();
    if (!front.length) return false;

    const pearlCost = front.length * PEARLS_PER_CAT;
    if (pearlsRef.current < pearlCost) return false;

    const seats = findSeatIndexesForGroup(front.length);
    return !!seats && seats.length >= front.length;
  };

  const serveFrontGroup = () => {
    const front = getFrontGroupInQueue();
    if (!front.length) return false;

    const seats = findSeatIndexesForGroup(front.length);
    if (!seats || seats.length < front.length) return false;

    const pearlCost = front.length * PEARLS_PER_CAT;
    if (pearlsRef.current < pearlCost) return false;

    const paid = spendPearls(pearlCost);
    if (!paid) return false;

    pearlsRef.current -= pearlCost;

    const allSeats = getSeatSpots();

    front.forEach((cat, index) => {
      const seatIndex = seats[index];
      const seat = allSeats[seatIndex];
      if (!seat) return;

      sendCatToSeat(cat, seat, seatIndex);
      // They carry off the cup you actually handed them, not a generic one.
      cat.drink = flavorRef.current;
      addCoins(25);
      addDrinkServed(1);
    });

    return true;
  };

  const updateQueueTargets = (width: number) => {
    const queueCats = getQueueCats();
    const queueSpots = getQueueSpots(width);

    let rowIndex = 0;
    let i = 0;

    while (i < queueCats.length && rowIndex < queueSpots.length) {
      const currentGroupId = queueCats[i].groupId;
      const groupCats = queueCats.filter((cat) => cat.groupId === currentGroupId);

      const firstIndex = queueCats.findIndex((cat) => cat.groupId === currentGroupId);
      if (firstIndex !== i) {
        i++;
        continue;
      }

      const queueSpot = queueSpots[rowIndex];
      if (!queueSpot) break;

      groupCats.forEach((cat) => retargetCat(cat, queueSpot));

      i += groupCats.length;
      rowIndex += 1;
    }
  };

  /* ------------------------------- scene ------------------------------- */

  // The room is static for a given set of upgrades, so it's recorded once and
  // replayed. Repainting a few thousand rects every frame would be pure waste.
  const scenePicture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, DESIGN_WIDTH, designHeight)
    );

    drawCafeScene(new SkiaCanvas2D(canvas), {
      width: DESIGN_WIDTH,
      height: designHeight,
      counterStyle: state.visuals.counterStyle,
      rugStyle: state.visuals.rugStyle,
      tableStyle: state.visuals.tableStyle,
      pal: palette,
      night,
      boba: state.bobaInventory,
      hasLights: state.unlockedItems.includes('decor-lights'),
      hasPlants: state.unlockedItems.includes('decor-plants'),
      hasArt: state.unlockedItems.includes('decor-paintings'),
    });

    return recorder.finishRecordingAsPicture();
  }, [
    state.visuals.counterStyle,
    state.visuals.rugStyle,
    state.visuals.tableStyle,
    state.bobaInventory,
    state.unlockedItems,
    palette,
    night,
    designHeight,
  ]);

  const sceneRef = useRef(scenePicture);
  useEffect(() => {
    sceneRef.current = scenePicture;
  }, [scenePicture]);

  /* ---------------------------- render loop ---------------------------- */

  useEffect(() => {
    const width = DESIGN_WIDTH;

    const spawnGroup = () => {
      const height = designHeightRef.current;
      const queueCats = getQueueCats();
      const queueSpots = getQueueSpots(width);

      // Busier cafés draw bigger groups, not just more of them.
      const sizeCap = maxGroupSize(popularityRef.current);
      const requestedGroupSize = 1 + Math.floor(Math.random() * sizeCap);
      const availableQueueSlots = queueSpots.length - queueCats.length;
      const actualGroupSize = Math.min(requestedGroupSize, availableQueueSlots);
      if (actualGroupSize <= 0) return;

      // Never empty in practice — the collection is seeded with three starters
      // — but with nobody adopted there is simply nobody to visit.
      if (ownedCatsRef.current.length === 0) return;

      const groupId = `group-${Date.now()}-${Math.random()}`;
      const offsets =
        actualGroupSize === 1 ? [0] : actualGroupSize === 2 ? [-22, 22] : [-28, 0, 28];

      for (let i = 0; i < actualGroupSize; i++) {
        const queueSpot = queueSpots[queueCats.length + i];
        if (!queueSpot) break;

        // Visitors are drawn from the cats you've actually adopted, so the
        // café fills up with your own collection rather than stock sprites.
        const roster = ownedCatsRef.current;
        const catId = roster[Math.floor(Math.random() * roster.length)];

        catsRef.current.push(
          createCat(
            `${groupId}-cat-${i}`,
            catId,
            groupId,
            width / 2,
            height - 60,
            queueSpot,
            offsets[i]
          )
        );
      }
    };

    // Self-rescheduling rather than a fixed interval, so each wait is computed
    // from *current* popularity: a thriving café fills up fast, a neglected one
    // slows to a trickle — but never to nothing, so there is always something
    // to come back to.
    const scheduleNextSpawn = (delay = spawnIntervalMs(popularityRef.current)) => {
      autoSpawnTimeoutRef.current = setTimeout(() => {
        spawnGroup();
        scheduleNextSpawn();
      }, delay);
    };

    // Walking into an empty café and waiting three minutes for the first cat is
    // a bad first second, so the door opens shortly after you arrive.
    scheduleNextSpawn(catsRef.current.length ? undefined : 1200);

    const render = () => {
      const height = designHeightRef.current;

      // Each frame is recorded into a fresh picture rather than mutated in
      // place, which is what lets Skia hand it to the render thread.
      const recorder = Skia.PictureRecorder();
      const skCanvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

      // The cached room, then everything that moves on top of it.
      skCanvas.drawPicture(sceneRef.current);

      const ctx: Ctx2D = new SkiaCanvas2D(skCanvas);

      catsRef.current.forEach((cat) => {
        if (
          cat.state === 'seated' &&
          cat.seatedAt &&
          Date.now() - cat.seatedAt >= 60000
        ) {
          sendCatOut(cat, width / 2, height + 110);
        }
      });

      catsRef.current = catsRef.current.filter(
        (cat) => !(cat.state === 'leaving' && isCatOffscreen(cat, width, height))
      );

      updateQueueTargets(width);
      catsRef.current.forEach(updateCat);

      // Target ring goes under the cat it belongs to.
      const target = dragTargetRef.current;
      if (target && catsRef.current.includes(target)) {
        drawServeTarget(ctx, target.x, target.y + 26, palette);
      }

      catsRef.current.forEach((cat) => drawCat(ctx, cat));
      catsRef.current.forEach((cat) => drawCatDrink(ctx, cat));

      // Cats standing in line show what they came for. Keyed off arrival at
      // the queue spot rather than the 'waiting' state: the queue is retargeted
      // every frame, so a lined-up cat is permanently 'walkingToLine'.
      catsRef.current.forEach((cat) => {
        if (cat.state !== 'walkingToLine' && cat.state !== 'waiting') return;
        if (Math.hypot(cat.targetX - cat.x, cat.targetY - cat.y) > 4) return;
        drawWantBubble(ctx, cat.x + 24, cat.y - 44, palette);
      });

      picture.value = recorder.finishRecordingAsPicture();

      // Drive the cup's enabled state from the simulation, but only touch React
      // state when it actually flips.
      const front = getFrontGroupInQueue();
      const cost = front.length * PEARLS_PER_CAT;
      const servable = canServeFrontGroup();
      setCanServe((prev) => (prev === servable ? prev : servable));
      setServeCost((prev) => (prev === cost ? prev : cost));

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (autoSpawnTimeoutRef.current) clearTimeout(autoSpawnTimeoutRef.current);
    };
  }, [palette, addCoins, spendPearls, addDrinkServed, picture]);

  /* ------------------------------ the cup ------------------------------ */

  const cupHome = {
    x: offsetX + CUP_STATION.x * scale - CUP_WIDTH / 2,
    y: CUP_STATION.y * scale - CUP_HEIGHT / 2,
  };

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const bob = useRef(new Animated.Value(0)).current;

  // The pan responder is built once and reads everything it needs through
  // refs. Rebuilding it per render would hand it a stale `serveFrontGroup`
  // mid-drag, and the drag would pay pearls against a snapshot of the queue.
  const cupHomeRef = useRef(cupHome);
  const canServeRef = useRef(false);
  const serveRef = useRef(serveFrontGroup);
  const scaleRef = useRef({ scale, offsetX });

  cupHomeRef.current = cupHome;
  canServeRef.current = canServe;
  serveRef.current = serveFrontGroup;
  scaleRef.current = { scale, offsetX };

  // A cup that's ready to be picked up bobs; one that isn't sits still.
  useEffect(() => {
    if (!canServe || dragging) {
      bob.stopAnimation();
      Animated.timing(bob, { toValue: 0, duration: 160, useNativeDriver: false }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -1,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [canServe, dragging, bob]);

  /** Nearest cat in the front group to the cup's mouth, if it's close enough. */
  const findDropTarget = useCallback((dx: number, dy: number): Cat | null => {
    const home = cupHomeRef.current;
    const view = scaleRef.current;
    // Measured from the base of the cup rather than its centre: you set the cup
    // down in front of the cat, so that's the point that has to reach them.
    const cupX = (home.x + dx + CUP_WIDTH / 2 - view.offsetX) / view.scale;
    const cupY = (home.y + dy + CUP_HEIGHT) / view.scale;

    let best: Cat | null = null;
    let bestDist = DROP_RADIUS;

    getFrontGroupInQueue().forEach((cat) => {
      const dist = Math.hypot(cat.x - cupX, cat.y - cupY);
      if (dist < bestDist) {
        bestDist = dist;
        best = cat;
      }
    });

    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const springHome = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      // Kept off the native driver: the same value is driven by setValue during
      // the drag, and mixing the two on one transform throws.
      useNativeDriver: false,
      friction: 6,
      tension: 70,
    }).start();
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      // Always grabbable. Refusing to move when there's nobody in line is
      // indistinguishable from being broken — the cup should lift, find nobody
      // to hand itself to, and drop back onto the counter.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (_e, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        dragTargetRef.current = canServeRef.current
          ? findDropTarget(gesture.dx, gesture.dy)
          : null;
      },
      onPanResponderRelease: () => {
        const hit = dragTargetRef.current;
        dragTargetRef.current = null;
        setDragging(false);
        if (hit) serveRef.current();
        springHome();
      },
      onPanResponderTerminate: () => {
        dragTargetRef.current = null;
        setDragging(false);
        springHome();
      },
    })
  ).current;

  // The cup carries whatever you've got the most of.
  const flavor = useMemo<BobaFlavor>(() => {
    const { classic, matcha, strawberry } = state.bobaInventory;
    if (matcha >= classic && matcha >= strawberry) return 'matcha';
    if (strawberry >= classic) return 'strawberry';
    return 'classic';
  }, [state.bobaInventory]);

  flavorRef.current = flavor;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={styles.fill}>
        <Group transform={[{ translateX: offsetX }, { scale }]}>
          <Picture picture={picture} />
        </Group>
      </Canvas>

      {/* Serving is a gesture, not a button: pick the cup up off the counter
          and hand it to the cat at the front of the line. */}
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          canServe
            ? `Drag the boba to the waiting cat. Costs ${serveCost} pearls.`
            : 'No cat is waiting to be served'
        }
        style={[
          styles.cup,
          {
            left: cupHome.x,
            top: cupHome.y,
            width: CUP_WIDTH,
            // Still a cup sitting on a counter when there's nobody to serve —
            // at 0.45 it read as broken rather than idle.
            opacity: canServe ? 1 : 0.8,
            transform: [
              ...pan.getTranslateTransform(),
              { translateY: bob.interpolate({ inputRange: [-1, 0], outputRange: [-6, 0] }) },
              { scale: dragging ? 1.12 : 1 },
            ],
          },
        ]}
      >
        <BobaCupSprite flavor={flavor} width={CUP_WIDTH} />
      </Animated.View>

      {canServe && !dragging && (
        <View
          style={[styles.hintRow, { top: cupHome.y + CUP_HEIGHT + 8 }]}
          pointerEvents="none"
        >
          <View style={styles.hint}>
            <Text style={styles.hintText}>Drag to serve</Text>
            <View style={styles.costRow}>
              <PearlIcon size={9} />
              <Text style={styles.costText}>{serveCost}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0BE95',
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  cup: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(255,247,236,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(112,74,48,0.22)',
  },
  hintText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5E3A2E',
    letterSpacing: 0.2,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  costText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A5AA8',
  },
});
