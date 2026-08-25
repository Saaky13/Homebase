import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';

import { useCafeState, type Plant } from '../hooks/useCafeState';
import { SkiaCanvas2D, type Ctx2D } from './skiaCanvas2d';
import { snap } from './cafePixel';
import {
  greenhouseMaterialFor,
  greenhousePaletteFor,
  isNightAt,
} from '../constants/greenhousePalette';
import {
  getPlant,
  growthStage,
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
  barrelMouthY,
  canStationY,
  getSockets,
  potStationY,
  rackY,
  BARREL,
  CAN_CAPACITY,
  CAN_STATION,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DROP_RADIUS,
  FILL_RADIUS,
  MAX_SCALE,
  MIN_DESIGN_HEIGHT,
  POT_H,
  POT_STATION,
  POT_W,
  RACK,
  WATER_RADIUS,
} from './greenhouseConfig';
import SeedRackSheet from './SeedRackSheet';
import { CoinIcon } from './Icons';
import { PixelPanel, PixelText, PixelToast, type ToastValue } from './pixel';
import { BEVEL, PX } from '../constants/pixelTheme';
import { getTodayDateKey } from '../utils/date';

/** How long a splash stays on screen after the can passes a pot. */
const SPLASH_MS = 900;
/** One gulp of the barrel per tick while the can is held at its mouth. */
const FILL_TICK_MS = 170;
/** A release this close to where it started is a tap, not a drag. */
const TAP_SLOP = 6;

/** Toast tints — the room's own inks, not the hub's accents. */
const TINT_LEAF = '#5D9B5B';
const TINT_GOLD = '#C4A252';
const TINT_WARN = '#C0564E';

type Splash = { id: number; x: number; y: number };
type Flight = { id: number; x: number; y: number; delay: number };

export default function GreenhouseCanvas() {
  const {
    state, plantSeed, waterPlants, harvestPlant, clearHusk,
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
  const [flights, setFlights] = useState<Flight[]>([]);
  const [rackOpen, setRackOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastValue | null>(null);
  const [husking, setHusking] = useState<Plant | null>(null);
  // Water aboard the can, 0..CAN_CAPACITY. Deliberately not persisted: the can
  // is empty when you walk in, the way the café's cup is, and filling it is
  // the first beat of the ritual rather than a chore to skip.
  const [canWater, setCanWater] = useState(0);

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
  const material = useMemo(() => greenhouseMaterialFor(night), [night]);
  const sockets = useMemo(() => getSockets(), []);

  /* ------------------------------- seeds -------------------------------- */

  // What the pot is loaded with. Purely a menu choice — there is no seed
  // inventory to reconcile against. Coins leave your hand when the pot lands
  // on a bench (`plantSeed` charges at the drop), so carrying a seed you
  // can't afford is allowed, the same way the café lets you load a recipe
  // you're short the pearls for. The refusal happens at the moment of truth.
  const loaded = selected && getPlant(selected) ? selected : null;
  const loadedSpec = loaded ? getPlant(loaded) : undefined;
  const affordable = !loadedSpec || state.coins >= loadedSpec.cost;

  const toastId = useRef(0);
  const flash = useCallback((text: string, tint?: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, tint });
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

  // Re-recorded per fill level, not per frame: the gauge only moves when a
  // gulp lands or a pot drinks, which is a handful of times a visit.
  const canPicture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, CAN_W, CAN_H));
    drawWateringCan(new SkiaCanvas2D(canvas), pal, canWater / CAN_CAPACITY);
    return recorder.finishRecordingAsPicture();
  }, [pal, canWater]);

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

  // The can's water, mirrored for the responder. The ref is the authority
  // during a gesture — the fill interval and the pour both move it between
  // renders — and the state trails it for the gauge redraw.
  const canWaterRef = useRef(0);

  const splashId = useRef(0);
  const addSplash = useCallback((x: number, y: number) => {
    const id = ++splashId.current;
    setSplashes((prev) => [...prev, { id, x, y }]);
    setTimeout(
      () => setSplashes((prev) => prev.filter((s) => s.id !== id)),
      SPLASH_MS
    );
  }, []);

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
      // Always grabbable. A pot that silently refuses to move when nothing is
      // loaded reads as broken rather than as empty — it should lift, find
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

        // A tap on the pot opens the menu — the pot is the thing you load, so
        // it is also the obvious place to ask "with what".
        if (Math.hypot(gesture.dx, gesture.dy) < TAP_SLOP) {
          setRackOpen(true);
          return;
        }

        if (slot === null) {
          if (!loadedRef.current) {
            actions.current.flash('Pick a seed from the rack first', TINT_WARN);
          }
          return;
        }

        const spec = getPlant(loadedRef.current as string);
        const result = actions.current.plantSeed(loadedRef.current as string, slot);
        // `'reason' in result` rather than `!result.ok`: the project extends
        // expo/tsconfig.base, which leaves strictNullChecks off, and without it
        // TypeScript won't narrow a union on a boolean discriminant. The `in`
        // operator narrows either way.
        if ('reason' in result) {
          if (result.reason === 'coins' && spec) {
            actions.current.flash(`Need ${spec.cost} coins for a ${spec.name}`, TINT_WARN);
          } else if (result.reason === 'occupied') {
            actions.current.flash('That socket is taken', TINT_WARN);
          } else if (result.reason === 'locked') {
            actions.current.flash('That bench is still locked', TINT_WARN);
          }
          return;
        }
        if (spec) {
          actions.current.flash(`Planted ${spec.name} · −${spec.cost} coins`, TINT_LEAF);
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
  // The empty-can toast fires once per drag, not once per pot passed.
  const flaggedEmpty = useRef(false);
  const fillTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopFilling = useCallback(() => {
    if (fillTimer.current) {
      clearInterval(fillTimer.current);
      fillTimer.current = null;
    }
  }, []);

  const canResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        wateredThisDrag.current = new Set();
        flaggedEmpty.current = false;
        setDragging('can');
      },
      onPanResponderMove: (_e, gesture) => {
        canPan.setValue({ x: gesture.dx, y: gesture.dy });

        const v = view.current;
        const spout = basePoint(canHomeRef.current, gesture.dx, gesture.dy, CAN_W, CAN_H);

        // Held at the barrel's mouth, the can drinks — one gulp per tick, so
        // you watch the gauge climb rather than getting a full can for free.
        // An interval because a hand held still fires no move events, and
        // "hold it there" is exactly the gesture being asked for.
        const mouthY = barrelMouthY(v.designHeight);
        const overBarrel =
          Math.hypot(BARREL.x - spout.x, mouthY - spout.y) < FILL_RADIUS;
        if (overBarrel && canWaterRef.current < CAN_CAPACITY) {
          if (!fillTimer.current) {
            const gulp = () => {
              if (canWaterRef.current >= CAN_CAPACITY) {
                stopFilling();
                return;
              }
              canWaterRef.current += 1;
              setCanWater(canWaterRef.current);
              addSplash(BARREL.x, barrelMouthY(view.current.designHeight) - 4);
            };
            gulp(); // The first gulp lands the moment you arrive.
            fillTimer.current = setInterval(gulp, FILL_TICK_MS);
          }
        } else if (fillTimer.current) {
          stopFilling();
        }

        // The can hit-tests continuously *during* the drag rather than on
        // drop, so one sweep along a bench waters everything it passes —
        // until the can runs dry. Each pot drinks one gulp of the gauge.
        // Read fresh rather than captured: this responder is built once, and a
        // date from the first render is wrong for anyone who leaves the app
        // open across midnight.
        const all = getSockets();
        const today = getTodayDateKey();

        plantsRef.current.forEach((plant) => {
          if (plant.dead || wateredThisDrag.current.has(plant.id)) return;
          if (plant.lastWateredDate === today) return;
          const socket = all[plant.slot];
          if (!socket) return;
          if (Math.hypot(socket.x - spout.x, socket.y - 24 - spout.y) > WATER_RADIUS) {
            return;
          }

          if (canWaterRef.current <= 0) {
            if (!flaggedEmpty.current) {
              flaggedEmpty.current = true;
              actions.current.flash('The can is empty — dip it in the rain barrel', TINT_WARN);
            }
            return;
          }

          canWaterRef.current -= 1;
          setCanWater(canWaterRef.current);
          wateredThisDrag.current.add(plant.id);
          addSplash(socket.x, socket.y - 30);
        });
      },
      onPanResponderRelease: () => {
        setDragging(null);
        stopFilling();
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
            : `Watered ${result.watered}`,
          TINT_LEAF
        );
      },
      onPanResponderTerminate: () => {
        setDragging(null);
        stopFilling();
        wateredThisDrag.current = new Set();
        springHome(canPan);
      },
    })
  ).current;

  // A live interval outliving the component would keep filling a can that no
  // longer exists.
  useEffect(() => stopFilling, [stopFilling]);

  /* ------------------------------- the taps ----------------------------- */

  const flightId = useRef(0);
  const endFlight = useCallback((id: number) => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /** Coins fly from the pot toward the TopBar's coin pill. */
  const spawnFlights = useCallback((x: number, y: number, amount: number) => {
    const count = Math.min(6, Math.max(3, Math.ceil(amount / 12)));
    const added: Flight[] = [];
    for (let i = 0; i < count; i++) {
      flightId.current += 1;
      added.push({
        id: flightId.current,
        x: x + (i - (count - 1) / 2) * 7,
        y,
        delay: i * 70,
      });
    }
    setFlights((prev) => [...prev, ...added]);
  }, []);

  const onPlantPress = (plant: Plant) => {
    if (plant.dead) {
      setHusking(plant);
      return;
    }
    if (plant.pendingCoins > 0) {
      const collected = harvestPlant(plant.id);
      if (collected > 0) {
        const socket = sockets[plant.slot];
        if (socket) {
          spawnFlights(
            offsetX + socket.x * scale,
            (socket.y - POT_H / 2) * scale,
            collected
          );
        }
        flash(`+${collected} coins`, TINT_GOLD);
      }
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

      {/* The pot you drag onto a bench. Tapping it opens the rack. */}
      <Animated.View
        {...potResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          loadedSpec
            ? `Drag the ${loadedSpec.name} pot onto a bench — ${loadedSpec.cost} coins when it lands`
            : 'Empty pot. Tap it to pick a seed from the rack.'
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
        {/* The price rides on the pot, because the pot is what you pay for.
            Red means the drop will refuse — the same warning the café's menu
            gives, at the same moment: before you commit, never after. */}
        {loadedSpec ? (
          <View
            style={[
              styles.priceTag,
              {
                top: POT_H * scale - 2,
                backgroundColor: material.face,
                borderColor: material.faceDk,
              },
            ]}
          >
            <CoinIcon size={9} />
            <PixelText
              size={12}
              color={affordable ? material.ink : TINT_WARN}
              style={styles.priceText}
            >
              {String(loadedSpec.cost)}
            </PixelText>
          </View>
        ) : null}
      </Animated.View>

      {/* The can. The water is free — but you fetch it from the barrel. */}
      <Animated.View
        {...canResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          canWater > 0
            ? `Drag the watering can across your plants — ${canWater} of ${CAN_CAPACITY} waterings aboard`
            : 'The watering can is empty. Hold it at the rain barrel to fill it.'
        }
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

      {/* Harvested coins on their way to the pill that counts them. */}
      {flights.map((flight) => (
        <CoinFlight
          key={flight.id}
          flight={flight}
          targetX={layout.width - 52}
          targetY={-36}
          onDone={endFlight}
        />
      ))}

      <PixelToast toast={toast} material={material} style={styles.toast} />

      {husking ? (
        <View style={styles.sheetBackdrop}>
          <PixelPanel material={material} style={styles.huskCard}>
            <PixelText size="title" color={material.ink}>
              Your {getPlant(husking.species)?.name} didn&apos;t make it
            </PixelText>
            <PixelText plain size={12} color={material.inkDim} style={styles.huskBody}>
              Compost it and you get one fertilizer — enough to skip a growth
              day on the next thing you plant here.
            </PixelText>
            <View style={styles.huskRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  clearHusk(husking.id, false);
                  setHusking(null);
                }}
                style={({ pressed }) => [
                  styles.huskBtn,
                  {
                    backgroundColor: material.sunk,
                    borderColor: material.faceDk,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <PixelText size="label" color={material.inkDim}>
                  Just clear it
                </PixelText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  clearHusk(husking.id, true);
                  setHusking(null);
                  flash('+1 fertilizer', TINT_LEAF);
                }}
                style={({ pressed }) => [
                  styles.huskBtn,
                  styles.huskPrimary,
                  pressed && styles.pressed,
                ]}
              >
                <PixelText size="label" color="#2F6B54">
                  Compost
                </PixelText>
              </Pressable>
            </View>
          </PixelPanel>
        </View>
      ) : null}

      {rackOpen ? (
        <SeedRackSheet
          coins={state.coins}
          level={state.level}
          fertilizer={gh.fertilizer}
          selected={loaded}
          material={material}
          onSelect={(id) => {
            const spec = getPlant(id);
            if (!spec) return;
            if (state.level < spec.level) {
              flash(`Reach level ${spec.level} to unlock ${spec.name}`, TINT_WARN);
              return;
            }
            setSelected(id);
            setRackOpen(false);
            flash(`${spec.name} loaded — drag the pot to a bench`, TINT_LEAF);
          }}
          onClose={() => setRackOpen(false)}
        />
      ) : null}
    </View>
  );
}

/**
 * One coin arcing from a harvested pot toward the TopBar's coin pill. Pops up
 * off the pot first, then commits to the corner — a straight line reads as
 * the coin being sucked away, not tossed.
 */
function CoinFlight({
  flight,
  targetX,
  targetY,
  onDone,
}: {
  flight: Flight;
  targetX: number;
  targetY: number;
  onDone: (id: number) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(flight.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: 620,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onDone(flight.id);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dx = targetX - flight.x;
  const dy = targetY - flight.y;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: flight.x,
        top: flight.y,
        opacity: progress.interpolate({
          inputRange: [0, 0.1, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        }),
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, dx],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.22, 1],
              outputRange: [0, -26, dy],
            }),
          },
        ],
      }}
    >
      <CoinIcon size={14} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#BFD9D6', overflow: 'hidden' },
  fill: { flex: 1 },
  hit: { position: 'absolute' },
  hitPressed: { backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 6 },
  drag: { position: 'absolute' },
  toast: { position: 'absolute', left: 0, right: 0, top: 12 },
  priceTag: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: PX * 2,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: 0,
  },
  priceText: { lineHeight: 14 },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40,30,24,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  huskCard: {
    padding: 14,
    gap: 8,
    maxWidth: 320,
  },
  huskBody: { lineHeight: 17 },
  huskRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  huskBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: BEVEL,
    borderRadius: 0,
  },
  huskPrimary: { backgroundColor: '#B8E1C6', borderColor: '#8FC8A4' },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
});
