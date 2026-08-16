import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { colors } from '../constants/colors';
import { useCafeState } from '../hooks/useCafeState';
import { SkiaCanvas2D, type Ctx2D } from './skiaCanvas2d';
import {
  createCat,
  updateCat,
  drawCat,
  retargetCat,
  sendCatToSeat,
  sendCatOut,
  isCatOffscreen,
  Cat,
} from './Cat';
import {
  getQueueSpots,
  getSeatSpots,
  drawCafeBackground,
  drawSeatingAreas,
} from './cafeRender';
import { spawnIntervalMs, maxGroupSize } from '../constants/popularity';

type Table = {
  id: string;
  seatIndexes: number[];
};

// The café is authored against a fixed 390x844 coordinate space and scaled to
// whatever the device actually gives us, so table and queue positions stay put
// across screen sizes.
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

export default function CafeCanvas() {
  const catsRef = useRef<Cat[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const autoSpawnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrored into a ref so spawning tracks the collection without re-running
  // the main effect, which would tear down the canvas and the render loop.
  const ownedCatsRef = useRef<string[]>([]);
  const pearlsRef = useRef(0);
  const popularityRef = useRef(0);
  const spawnGroupRef = useRef<() => void>(() => {});

  // The frame is published as a SharedValue so Skia repaints without a React
  // re-render on each of the 60 frames per second.
  const picture = useSharedValue(Skia.PictureRecorder().finishRecordingAsPicture());

  const [layout, setLayout] = useState({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT });
  const [canServe, setCanServe] = useState(false);

  const { state, addCoins, spendPearls, addDrinkServed } = useCafeState();

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

    const pearlCost = front.length * 5;
    if (pearlsRef.current < pearlCost) return false;

    const seats = findSeatIndexesForGroup(front.length);
    return !!seats && seats.length >= front.length;
  };

  const serveFrontGroup = () => {
    const front = getFrontGroupInQueue();
    if (!front.length) return;

    const seats = findSeatIndexesForGroup(front.length);
    if (!seats || seats.length < front.length) return;

    const pearlCost = front.length * 5;
    if (pearlsRef.current < pearlCost) return;

    const paid = spendPearls(pearlCost);
    if (!paid) return;

    pearlsRef.current -= pearlCost;

    const allSeats = getSeatSpots();

    front.forEach((cat, index) => {
      const seatIndex = seats[index];
      const seat = allSeats[seatIndex];
      if (!seat) return;

      sendCatToSeat(cat, seat, seatIndex);
      addCoins(25);
      addDrinkServed(1);
    });
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

  useEffect(() => {
    const width = DESIGN_WIDTH;
    const height = DESIGN_HEIGHT;

    const spawnGroupInternal = () => {
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
            height - 72,
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
    const scheduleNextSpawn = () => {
      autoSpawnTimeoutRef.current = setTimeout(() => {
        spawnGroupInternal();
        scheduleNextSpawn();
      }, spawnIntervalMs(popularityRef.current));
    };

    scheduleNextSpawn();

    spawnGroupRef.current = spawnGroupInternal;

    const render = () => {
      // Each frame is recorded into a fresh picture rather than mutated in
      // place, which is what lets Skia hand it to the render thread.
      const recorder = Skia.PictureRecorder();
      const skCanvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
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

      drawCafeBackground(
        ctx,
        width,
        height,
        state.visuals.counterStyle,
        state.visuals.rugStyle
      );

      drawSeatingAreas(ctx, state.visuals.tableStyle);

      catsRef.current.forEach((cat) => drawCat(ctx, cat));

      picture.value = recorder.finishRecordingAsPicture();

      // Drive the Serve button's enabled state from the simulation, but only
      // touch React state when it actually flips.
      const servable = canServeFrontGroup();
      setCanServe((prev) => (prev === servable ? prev : servable));

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (autoSpawnTimeoutRef.current) clearTimeout(autoSpawnTimeoutRef.current);
    };
  }, [state.visuals, addCoins, spendPearls, addDrinkServed, picture]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={styles.fill}>
        <Group
          transform={[
            { scaleX: layout.width / DESIGN_WIDTH },
            { scaleY: layout.height / DESIGN_HEIGHT },
          ]}
        >
          <Picture picture={picture} />
        </Group>
      </Canvas>

      {/* Controls are real views rather than painted into the canvas, so they
          get native touch handling and screen-reader labels for free. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Serve the next group of cats"
        disabled={!canServe}
        onPress={serveFrontGroup}
        style={({ pressed }) => [
          styles.serveButton,
          !canServe && styles.serveButtonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.serveButtonText}>Serve</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Spawn a group of cats"
        onPress={() => spawnGroupRef.current()}
        style={({ pressed }) => [styles.spawnButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.spawnButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  serveButton: {
    position: 'absolute',
    top: 24,
    right: 20,
    width: 72,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#63B97C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serveButtonDisabled: { backgroundColor: '#A8C9B1' },
  serveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  spawnButton: {
    position: 'absolute',
    bottom: 32,
    right: 22,
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E88973',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spawnButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', lineHeight: 32 },
  buttonPressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
});