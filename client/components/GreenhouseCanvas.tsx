import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';

import { useCafeState, type Plant } from '../hooks/useCafeState';
import { SkiaCanvas2D, type Ctx2D } from './skiaCanvas2d';
import { snap } from './cafePixel';
import {
  greenhousePaletteFor,
  isNightAt,
  type GreenhousePalette,
} from '../constants/greenhousePalette';
import {
  getPlant,
  growthStage,
  PLANT_ORDER,
  type PlantStage,
} from '../constants/plants';
import { getPlantSkImage } from './plantImageCache';
import {
  drawBenchFronts,
  drawGreenhouseScene,
  drawHarvestGlint,
  drawSocketTarget,
  drawSplash,
  drawThirstBubble,
  drawWateringCan,
  CAN_H,
  CAN_W,
} from './greenhouseRender';
import {
  canStationY,
  getSockets,
  potStationY,
  rackY,
  CAN_STATION,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DROP_RADIUS,
  MAX_SCALE,
  MIN_DESIGN_HEIGHT,
  POT_H,
  POT_STATION,
  POT_W,
  RACK,
  WATER_RADIUS,
} from './greenhouseConfig';
import SeedRackSheet from './SeedRackSheet';
import { getTodayDateKey } from '../utils/date';

/** How long a splash stays on screen after the can passes a pot. */
const SPLASH_MS = 900;

type Splash = { id: number; x: number; y: number };

export default function GreenhouseCanvas() {
  const {
    state, buySeed, plantSeed, waterPlants, harvestPlant, clearHusk,
  } = useCafeState();

  const [layout, setLayout] = useState(() => {
    const win = Dimensions.get('window');
    return {
      width: win.width || DESIGN_WIDTH,
      height: win.height || DESIGN_HEIGHT,
    };
  });
  const [night, setNight] = useState(() => isNightAt());
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [splashes, setSplashes] = useState<Splash[]>([]);
  const [rackOpen, setRackOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [husking, setHusking] = useState<Plant | null>(null);

  const gh = state.greenhouse;

  // Height is part of the fit here, unlike the café. The potting table is
  // bottom-anchored and holds both draggables and the seed rack, so a room
  // taller than the viewport would put the whole interaction off-screen.
  // Scaling to whichever axis is tighter guarantees the bottom is reachable.
  const scale = Math.min(
    layout.width / DESIGN_WIDTH,
    layout.height / MIN_DESIGN_HEIGHT,
    MAX_SCALE
  );
  const designHeight = Math.max(snap(layout.height / scale), MIN_DESIGN_HEIGHT);
  const offsetX = (layout.width - DESIGN_WIDTH * scale) / 2;

  // The room lights itself at dusk. On a timer rather than derived at render
  // time, so a greenhouse left open crosses over without a reload.
  useEffect(() => {
    const id = setInterval(() => setNight(isNightAt()), 60000);
    return () => clearInterval(id);
  }, []);

  const pal = useMemo(() => greenhousePaletteFor(night), [night]);
  const sockets = useMemo(() => getSockets(), []);

  /* ------------------------------- seeds -------------------------------- */

  // Whatever you have in hand, cheapest first. Kept as derived-with-override
  // so buying a seed can promote it without stranding the picker on a species
  // you've since planted your last one of.
  const inHand = useMemo(
    () => PLANT_ORDER.filter((id) => (gh.seeds[id] ?? 0) > 0),
    [gh.seeds]
  );
  const loaded = selected && inHand.includes(selected) ? selected : inHand[0] ?? null;

  const flash = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice((n) => (n === message ? null : n)), 2200);
  }, []);

  /* ------------------------------- scene -------------------------------- */

  // The room is static for a given size, palette and bench count, so it is
  // recorded once and replayed. This is the expensive picture — a few thousand
  // rects — and it is the whole reason there is no render loop here.
  const roomPicture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, DESIGN_WIDTH, designHeight)
    );
    drawGreenhouseScene(new SkiaCanvas2D(canvas), {
      width: DESIGN_WIDTH,
      height: designHeight,
      pal,
      night,
      benches: gh.benches,
    });
    return recorder.finishRecordingAsPicture();
  }, [designHeight, pal, night, gh.benches]);

  // Everything that changes: the plants themselves, the coins waiting on a
  // pot, thirst bubbles, splashes, and the ring under a dragged pot. Replayed
  // over the room, and re-recorded only when one of those actually moves —
  // which is a handful of times a session, not sixty times a second.
  const framePicture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, DESIGN_WIDTH, designHeight)
    );
    canvas.drawPicture(roomPicture);
    const ctx: Ctx2D = new SkiaCanvas2D(canvas);

    if (hoverSlot !== null) {
      const socket = sockets[hoverSlot];
      if (socket) drawSocketTarget(ctx, socket.x, socket.y, pal);
    }

    gh.plants.forEach((plant) => {
      const socket = sockets[plant.slot];
      const spec = getPlant(plant.species);
      if (!socket || !spec) return;

      const stage: PlantStage = plant.dead
        ? 'husk'
        : growthStage(plant.waterCount, spec.daysToMature);
      const thirsty = !plant.dead && plant.thirst > 0;

      const image = getPlantSkImage(plant.species, stage, thirsty);
      if (image) {
        // Anchored by the pot's base, so every plant stands on the bench no
        // matter how tall it grew — the same fix the café needed for seats.
        ctx.drawImage(image, socket.x - POT_W / 2, socket.y - POT_H + 4, POT_W, POT_H);
      }
    });

    // The troughs' front lips go on last, over the pots standing in them. That
    // overlap is the whole reason a plant looks planted rather than placed, so
    // it has to come after the sprites — which is why it is not part of the
    // room picture with the rest of the bench.
    drawBenchFronts(ctx, {
      width: DESIGN_WIDTH,
      height: designHeight,
      pal,
      night,
      benches: gh.benches,
    });

    // Bubbles and glints sit above the lip: they are UI, not scenery, and a
    // plant whose warning were half-buried in the zinc would be missable.
    gh.plants.forEach((plant) => {
      const socket = sockets[plant.slot];
      if (!socket) return;
      if (!plant.dead && plant.thirst > 0) {
        // Just above the foliage, not above the sprite box: POT_H is the whole
        // 28x36 cell and a bubble hung off that floated clear of its plant.
        drawThirstBubble(ctx, socket.x + 22, socket.y - 48, pal);
      }
      if (plant.pendingCoins > 0) {
        drawHarvestGlint(ctx, socket.x + 15, socket.y - 12, pal);
      }
    });

    splashes.forEach((s) => drawSplash(ctx, s.x, s.y, pal));

    return recorder.finishRecordingAsPicture();
  }, [roomPicture, designHeight, gh.plants, gh.benches, hoverSlot, splashes, sockets, pal, night]);

  const potPicture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, POT_W, POT_H));
    // An unknown species draws a bare pot, which is exactly what an empty one
    // on the potting table should be.
    const image = getPlantSkImage(loaded ?? '', 'seed');
    if (image) new SkiaCanvas2D(canvas).drawImage(image, 0, 0, POT_W, POT_H);
    return recorder.finishRecordingAsPicture();
  }, [loaded]);

  const canPicture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, CAN_W, CAN_H));
    drawWateringCan(new SkiaCanvas2D(canvas), pal);
    return recorder.finishRecordingAsPicture();
  }, [pal]);

  /* ------------------------------ the drags ----------------------------- */

  const potHome = {
    x: offsetX + POT_STATION.x * scale - (POT_W * scale) / 2,
    y: potStationY(designHeight) * scale - POT_H * scale,
  };
  const canHome = {
    x: offsetX + CAN_STATION.x * scale - (CAN_W * scale) / 2,
    y: canStationY(designHeight) * scale - CAN_H * scale,
  };

  const potPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const canPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState<'pot' | 'can' | null>(null);

  // Both responders are built once and read everything through refs. Rebuilt
  // per render they would capture a stale plant list mid-drag, and the gesture
  // would water a snapshot of the bench rather than what is on it.
  const view = useRef({ scale, offsetX, designHeight });
  view.current = { scale, offsetX, designHeight };
  const potHomeRef = useRef(potHome);
  potHomeRef.current = potHome;
  const canHomeRef = useRef(canHome);
  canHomeRef.current = canHome;
  const plantsRef = useRef(gh.plants);
  plantsRef.current = gh.plants;
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const benchesRef = useRef(gh.benches);
  benchesRef.current = gh.benches;

  const actions = useRef({ plantSeed, waterPlants, flash });
  actions.current = { plantSeed, waterPlants, flash };

  /** Design-space point for the base of a dragged object. */
  const basePoint = (home: { x: number; y: number }, dx: number, dy: number, w: number, h: number) => {
    const v = view.current;
    return {
      x: (home.x + dx + (w * v.scale) / 2 - v.offsetX) / v.scale,
      y: (home.y + dy + h * v.scale) / v.scale,
    };
  };

  const findSocket = useCallback((dx: number, dy: number): number | null => {
    const point = basePoint(potHomeRef.current, dx, dy, POT_W, POT_H);
    const taken = new Set(plantsRef.current.map((p) => p.slot));

    let best: number | null = null;
    let bestDist = DROP_RADIUS;

    getSockets().forEach((socket) => {
      if (taken.has(socket.index)) return;
      if (socket.bench >= benchesRef.current) return;
      const dist = Math.hypot(socket.x - point.x, socket.y - point.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = socket.index;
      }
    });

    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const springHome = (pan: Animated.ValueXY) => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      // Off the native driver: setValue drives the same transform during the
      // drag, and mixing the two on one transform throws.
      useNativeDriver: false,
      friction: 6,
      tension: 70,
    }).start();
  };

  const potResponder = useRef(
    PanResponder.create({
      // Always grabbable. A pot that silently refuses to move when you have no
      // seed reads as broken rather than as empty — it should lift, find
      // nothing to plant, and drop back onto the table.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setDragging('pot'),
      onPanResponderMove: (_e, gesture) => {
        potPan.setValue({ x: gesture.dx, y: gesture.dy });
        setHoverSlot((prev) => {
          const next = loadedRef.current ? findSocket(gesture.dx, gesture.dy) : null;
          return next === prev ? prev : next;
        });
      },
      onPanResponderRelease: (_e, gesture) => {
        const slot = loadedRef.current ? findSocket(gesture.dx, gesture.dy) : null;
        setHoverSlot(null);
        setDragging(null);
        springHome(potPan);

        if (slot === null) {
          if (!loadedRef.current) actions.current.flash('No seed in hand — open the rack');
          return;
        }
        const result = actions.current.plantSeed(loadedRef.current as string, slot);
        // `'reason' in result` rather than `!result.ok`: the project extends
        // expo/tsconfig.base, which leaves strictNullChecks off, and without it
        // TypeScript won't narrow a union on a boolean discriminant. The `in`
        // operator narrows either way.
        if ('reason' in result && result.reason === 'occupied') {
          actions.current.flash('That socket is taken');
        }
      },
      onPanResponderTerminate: () => {
        setHoverSlot(null);
        setDragging(null);
        springHome(potPan);
      },
    })
  ).current;

  // Plants the can has already passed over during *this* drag, so a wobbling
  // hand doesn't splash the same pot ten times.
  const wateredThisDrag = useRef(new Set<string>());
  const splashId = useRef(0);

  const canResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        wateredThisDrag.current = new Set();
        setDragging('can');
      },
      onPanResponderMove: (_e, gesture) => {
        canPan.setValue({ x: gesture.dx, y: gesture.dy });

        // The can hit-tests continuously *during* the drag rather than on
        // drop, so one sweep along a bench waters everything it passes.
        // Twelve plants should not be twelve gestures.
        const spout = basePoint(canHomeRef.current, gesture.dx, gesture.dy, CAN_W, CAN_H);
        const all = getSockets();
        // Read fresh rather than captured: this responder is built once, and a
        // date from the first render is wrong for anyone who leaves the app
        // open across midnight.
        const today = getTodayDateKey();

        plantsRef.current.forEach((plant) => {
          if (plant.dead || wateredThisDrag.current.has(plant.id)) return;
          if (plant.lastWateredDate === today) return;
          const socket = all[plant.slot];
          if (!socket) return;
          if (Math.hypot(socket.x - spout.x, socket.y - 24 - spout.y) > WATER_RADIUS) {
            return;
          }

          wateredThisDrag.current.add(plant.id);
          const id = ++splashId.current;
          const drop = { id, x: socket.x, y: socket.y - 30 };
          setSplashes((prev) => [...prev, drop]);
          setTimeout(
            () => setSplashes((prev) => prev.filter((s) => s.id !== id)),
            SPLASH_MS
          );
        });
      },
      onPanResponderRelease: () => {
        setDragging(null);
        springHome(canPan);

        const ids = [...wateredThisDrag.current];
        wateredThisDrag.current = new Set();
        if (!ids.length) return;

        // One commit for the whole sweep. The splashes already landed, so the
        // feedback is immediate and the state write happens once.
        const result = actions.current.waterPlants(ids);
        if (!result.watered) return;
        actions.current.flash(
          result.earned > 0
            ? `Watered ${result.watered} · +${result.earned} coins${result.bloom ? ' (bloom bonus)' : ''}`
            : `Watered ${result.watered}`
        );
      },
      onPanResponderTerminate: () => {
        setDragging(null);
        wateredThisDrag.current = new Set();
        springHome(canPan);
      },
    })
  ).current;

  /* ------------------------------- the taps ----------------------------- */

  const onPlantPress = (plant: Plant) => {
    if (plant.dead) {
      setHusking(plant);
      return;
    }
    if (plant.pendingCoins > 0) {
      const collected = harvestPlant(plant.id);
      if (collected > 0) flash(`+${collected} coins`);
      return;
    }

    const spec = getPlant(plant.species);
    if (!spec) return;
    const stage = growthStage(plant.waterCount, spec.daysToMature);
    flash(
      stage === 'mature'
        ? `${spec.name} · mature · water it for ${spec.coinsPerDay} coins`
        : `${spec.name} · ${plant.waterCount}/${spec.daysToMature} waterings`
    );
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  const toPx = (x: number, y: number) => ({
    left: offsetX + x * scale,
    top: y * scale,
  });

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={styles.fill}>
        <Group transform={[{ translateX: offsetX }, { scale }]}>
          <Picture picture={framePicture} />
        </Group>
      </Canvas>

      {/* Tap targets sit over the sockets rather than hit-testing the canvas:
          the geometry is already data, so labels and press states come free. */}
      {gh.plants.map((plant) => {
        const socket = sockets[plant.slot];
        if (!socket) return null;
        const spec = getPlant(plant.species);
        const pos = toPx(socket.x - POT_W / 2, socket.y - POT_H + 4);
        return (
          <Pressable
            key={plant.id}
            accessibilityRole="button"
            accessibilityLabel={
              plant.dead
                ? `${spec?.name ?? 'Plant'}, dead. Clear or compost it.`
                : plant.pendingCoins > 0
                  ? `Harvest ${plant.pendingCoins} coins from your ${spec?.name}`
                  : `${spec?.name}, ${plant.waterCount} of ${spec?.daysToMature} waterings`
            }
            onPress={() => onPlantPress(plant)}
            style={({ pressed }) => [
              styles.hit,
              {
                left: pos.left,
                top: pos.top,
                width: POT_W * scale,
                height: POT_H * scale,
              },
              pressed && styles.hitPressed,
            ]}
          />
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the seed rack"
        onPress={() => setRackOpen(true)}
        style={({ pressed }) => [
          styles.hit,
          {
            ...toPx(RACK.x, rackY(designHeight)),
            width: RACK.w * scale,
            height: RACK.h * scale,
          },
          pressed && styles.hitPressed,
        ]}
      />

      {/* The pot you drag onto a bench. */}
      <Animated.View
        {...potResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          loaded
            ? `Drag the ${getPlant(loaded)?.name} pot onto a bench`
            : 'Empty pot. Buy a seed from the rack first.'
        }
        style={[
          styles.drag,
          {
            left: potHome.x,
            top: potHome.y,
            width: POT_W * scale,
            height: POT_H * scale,
            opacity: loaded ? 1 : 0.75,
            transform: [
              ...potPan.getTranslateTransform(),
              { scale: dragging === 'pot' ? 1.1 : 1 },
            ],
          },
        ]}
      >
        <Canvas style={{ width: POT_W * scale, height: POT_H * scale }}>
          <Group transform={[{ scale }]}>
            <Picture picture={potPicture} />
          </Group>
        </Canvas>
      </Animated.View>

      {/* The can. Free to use — the cost of the greenhouse is showing up. */}
      <Animated.View
        {...canResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel="Drag the watering can across your plants"
        style={[
          styles.drag,
          {
            left: canHome.x,
            top: canHome.y,
            width: CAN_W * scale,
            height: CAN_H * scale,
            transform: [
              ...canPan.getTranslateTransform(),
              { rotate: dragging === 'can' ? '-16deg' : '0deg' },
              { scale: dragging === 'can' ? 1.08 : 1 },
            ],
          },
        ]}
      >
        <Canvas style={{ width: CAN_W * scale, height: CAN_H * scale }}>
          <Group transform={[{ scale }]}>
            <Picture picture={canPicture} />
          </Group>
        </Canvas>
      </Animated.View>

      {notice ? (
        <View style={styles.noticeWrap} pointerEvents="none">
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        </View>
      ) : null}

      {husking ? (
        <View style={styles.sheetBackdrop}>
          <View style={styles.huskCard}>
            <Text style={styles.huskTitle}>
              Your {getPlant(husking.species)?.name} didn&apos;t make it
            </Text>
            <Text style={styles.huskBody}>
              Compost it and you get one fertilizer — enough to skip a growth day
              on the next thing you plant here.
            </Text>
            <View style={styles.huskRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  clearHusk(husking.id, false);
                  setHusking(null);
                }}
                style={({ pressed }) => [styles.huskBtn, pressed && styles.pressed]}
              >
                <Text style={styles.huskBtnText}>Just clear it</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  clearHusk(husking.id, true);
                  setHusking(null);
                  flash('+1 fertilizer');
                }}
                style={({ pressed }) => [
                  styles.huskBtn, styles.huskPrimary, pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.huskBtnText, styles.huskPrimaryText]}>Compost</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {rackOpen ? (
        <SeedRackSheet
          coins={state.coins}
          level={state.level}
          seeds={gh.seeds}
          fertilizer={gh.fertilizer}
          onBuy={(id) => {
            const spec = getPlant(id);
            if (!spec) return;
            if (state.level < spec.level) {
              flash(`Reach level ${spec.level} to unlock ${spec.name}`);
              return;
            }
            if (!buySeed(id)) {
              flash('Not enough coins');
              return;
            }
            setSelected(id);
            flash(`${spec.name} seed — drag the pot to a bench`);
          }}
          onSelect={(id) => setSelected(id)}
          onClose={() => setRackOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#BFD9D6', overflow: 'hidden' },
  fill: { flex: 1 },
  hit: { position: 'absolute' },
  hitPressed: { backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 6 },
  drag: { position: 'absolute' },
  noticeWrap: { position: 'absolute', left: 0, right: 0, top: 12, alignItems: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,251,244,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(78,56,40,0.2)',
  },
  noticeText: { fontSize: 11, fontWeight: '800', color: '#4A3427' },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40,30,24,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  huskCard: {
    backgroundColor: '#FFF9F0',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1.2,
    borderColor: '#E5D2BC',
    maxWidth: 320,
  },
  huskTitle: { fontSize: 15, fontWeight: '800', color: '#4A3427' },
  huskBody: { fontSize: 12, color: '#7B5240', lineHeight: 17 },
  huskRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  huskBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3E7D9',
    borderWidth: 1,
    borderColor: '#E0CBB3',
  },
  huskPrimary: { backgroundColor: '#B8E1C6', borderColor: '#8FC8A4' },
  huskBtnText: { fontSize: 12, fontWeight: '800', color: '#7B5240' },
  huskPrimaryText: { color: '#2F6B54' },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
});
