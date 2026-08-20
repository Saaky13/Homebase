import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { hasJoined, type CafeCustomer } from '../constants/cafeVisit';
import BobaCupSprite, { CUP_ASPECT } from './BobaCupSprite';
import type { BobaFlavor } from '../constants/bobaCup';
import { PearlIcon } from './Icons';
import { getCat } from '../constants/catSprites';
import { bondTip } from '../constants/bonds';
import type { CatStat } from '../constants/catLore';
import CatInspectCard, { CARD_H_ESTIMATE, anchorCard } from './CatInspectCard';
import { catAspectRatio } from './catImageCache';

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

/**
 * Whether a cat will answer a tap.
 *
 * Everything but a cat on its way out. It is tempting to restrict this to
 * `waiting` and `seated` — the cats that hold still — but the queue does not
 * work that way: `retargetCat` puts every cat back into `walkingToLine` each
 * time the line shuffles forward, so a cat standing in the queue spends much
 * of its time in a walking state. Gating on stillness meant taps on queued
 * cats mostly did nothing, and an open card vanished the instant the line
 * moved. The card follows a walking cat perfectly well.
 */
function isInspectable(cat: Cat) {
  return cat.state !== 'leaving';
}

export default function CafeCanvas() {
  const catsRef = useRef<Cat[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  // Who the café state says is in the room. The render loop reconciles the
  // floor against this every frame; it never decides for itself who shows up.
  // A ref rather than a dep so an arrival doesn't tear down the render loop.
  const customersRef = useRef<CafeCustomer[]>([]);
  const pearlsRef = useRef(0);
  // Bond XP per cat, mirrored for the same reason as pearls: the serve runs
  // from a gesture handler and needs to know what each cat's tip is worth
  // without waiting for a render.
  const catStatsRef = useRef<Record<string, CatStat>>({});
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
  const [needPearls, setNeedPearls] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [night, setNight] = useState(() => isNightAt());

  /**
   * The cat currently showing its preferences.
   *
   * Both ids are needed and they are not the same thing: several cats in the
   * room can be the same roster cat, so `id` says which one on the floor to
   * follow with the card while `catId` says whose entry to draw in it.
   */
  const [inspected, setInspected] = useState<{ id: string; catId: string } | null>(null);
  const inspectedRef = useRef<typeof inspected>(null);
  inspectedRef.current = inspected;
  const router = useRouter();

  /**
   * The card tracks a cat that shuffles up the queue, so the render loop
   * writes its position directly. Routing it through state would re-render
   * the canvas host on every frame of that shuffle.
   */
  const cardPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cardPointerX = useRef(new Animated.Value(0)).current;
  const cardHRef = useRef(CARD_H_ESTIMATE);
  const cardFlip = useRef(new Animated.Value(0)).current;

  const {
    state,
    addCoins,
    spendPearls,
    addDrinkServed,
    recordCatsServed,
    serveCustomers,
    settleCafeVisitNow,
  } = useCafeState();

  const scale = Math.min(layout.width / DESIGN_WIDTH, MAX_SCALE);
  // Snapped to the art grid so the floorboard courses don't land on half pixels.
  const designHeight = Math.max(snap(layout.height / scale), MIN_DESIGN_HEIGHT);
  const offsetX = (layout.width - DESIGN_WIDTH * scale) / 2;

  // The render loop reads the room size through a ref so a rotation or a window
  // resize doesn't tear down the canvas and restart the spawn schedule.
  const designHeightRef = useRef(designHeight);
  designHeightRef.current = designHeight;

  // The box the inspect card is clamped inside, read the same way.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /**
   * The design-to-screen transform, for everything painted in React over the
   * canvas — the dragged cup and the inspect card.
   *
   * Declared up here rather than beside the cup, because the render loop below
   * reads it: the React Compiler folds captured values into its memo-cache
   * comparisons, so a ref declared under a closure that captures it is touched
   * during render and throws before the effect ever runs.
   */
  const scaleRef = useRef({ scale, offsetX });
  scaleRef.current = { scale, offsetX };

  useEffect(() => {
    pearlsRef.current = state.pearls;
  }, [state.pearls]);

  useEffect(() => {
    customersRef.current = state.cafeVisit.customers;
  }, [state.cafeVisit.customers]);

  useEffect(() => {
    catStatsRef.current = state.catStats;
  }, [state.catStats]);

  // The provider's five-second tick already advances the café, but walking in
  // the door should not mean waiting up to five seconds to see whether anyone
  // is here — settle once on arrival so the room is current on the first frame.
  useEffect(() => {
    settleCafeVisitNow();
  }, [settleCafeVisitNow]);

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

  /** The one cat at the head of the line — the only one a cup can go to. */
  const getFrontCatInQueue = (): Cat | null => getQueueCats()[0] ?? null;

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

  /**
   * A chair for one cat.
   *
   * Cats are served one at a time, so they're seated one at a time — most
   * would rather have a table to themselves, and the rest join one that's
   * already occupied.
   */
  const findOpenSeatIndex = (): number | null => {
    const tables = shuffleArray(getTables());

    const wantsOwnTable = Math.random() < 0.8;

    if (wantsOwnTable) {
      const emptyTable = tables.find((table) => {
        const catsAtTable = getCatsAtTable(table).length;
        return catsAtTable === 0 && getOpenSeatIndexesForTable(table).length >= 1;
      });

      if (emptyTable) {
        return shuffleArray(getOpenSeatIndexesForTable(emptyTable))[0];
      }
    }

    const openTable = tables.find((table) => {
      const catsAtTable = getCatsAtTable(table).length;
      const openSeats = getOpenSeatIndexesForTable(table).length;
      return catsAtTable > 0 && openSeats >= 1;
    });

    if (openTable) {
      return shuffleArray(getOpenSeatIndexesForTable(openTable))[0];
    }

    const fallbackEmpty = tables.find(
      (table) => getOpenSeatIndexesForTable(table).length >= 1
    );

    if (!fallbackEmpty) return null;
    return shuffleArray(getOpenSeatIndexesForTable(fallbackEmpty))[0];
  };

  /**
   * Where this particular cat sits.
   *
   * Cats that walked in together sit together: if a groupmate already has a
   * chair, this one takes an open seat at that table. Serving one drink at a
   * time means a party is seated a cat at a time too, so the table is the only
   * thing left holding them together — without this they'd scatter across the
   * room the moment the group stopped being served as a unit.
   *
   * A groupmate at a table with no free chair falls through to the normal
   * search rather than blocking: better a cat sits somewhere than holds up a
   * line that can never move.
   */
  const findSeatIndexForCat = (cat: Cat): number | null => {
    const mate = catsRef.current.find(
      (other) =>
        other !== cat && other.groupId === cat.groupId && other.seatIndex !== null
    );

    if (mate) {
      const table = getTables().find((t) =>
        t.seatIndexes.includes(mate.seatIndex as number)
      );
      const open = table ? getOpenSeatIndexesForTable(table) : [];
      if (open.length) return shuffleArray(open)[0];
    }

    return findOpenSeatIndex();
  };

  const canServeFrontCat = () => {
    const front = getFrontCatInQueue();
    if (!front) return false;
    if (pearlsRef.current < PEARLS_PER_CAT) return false;
    return findSeatIndexForCat(front) !== null;
  };

  const serveFrontCat = () => {
    const front = getFrontCatInQueue();
    if (!front) return false;

    const seatIndex = findSeatIndexForCat(front);
    if (seatIndex === null) return false;

    const seat = getSeatSpots()[seatIndex];
    if (!seat) return false;

    if (pearlsRef.current < PEARLS_PER_CAT) return false;
    if (!spendPearls(PEARLS_PER_CAT)) return false;

    pearlsRef.current -= PEARLS_PER_CAT;

    sendCatToSeat(front, seat, seatIndex);
    // They carry off the cup you actually handed them, not a generic one.
    front.drink = flavorRef.current;

    // The tip is the bond you had walking in — this cup's XP counts toward the
    // next one. Paying the level the cup itself just bought would mean the
    // serve that levels a cat quietly pays twice for the same drink.
    const spec = getCat(front.catId);
    const tip = spec
      ? bondTip(catStatsRef.current[front.catId]?.bondXp ?? 0, spec.rarity)
      : 0;
    addCoins(Math.round(25 * (1 + tip)));

    addDrinkServed(1);
    recordCatsServed([front.catId], flavorRef.current);
    // They stop being *queued* here but stay in the café: a served cat sits
    // with its cup for a minute, and it must not turn up out in the town while
    // it's still visibly at a table.
    serveCustomers([front.id]);

    return true;
  };

  /**
   * One cat per row — a queue is single file.
   *
   * Cats that arrive together are still a party: they're served in one gesture
   * and seated at one table. They just don't stand three abreast to wait. A cat
   * is ~54px wide on a 390px floor, so a group of three spanned the aisle and
   * read as a crowd milling at the counter rather than a line with a front of it.
   *
   * There are exactly as many spots as `QUEUE_CAPACITY` allows customers, so
   * the `min` only ever guards against the two drifting apart.
   */
  const updateQueueTargets = (width: number) => {
    const queueSpots = getQueueSpots(width);

    getQueueCats().forEach((cat, i) => {
      const spot = queueSpots[Math.min(i, queueSpots.length - 1)];
      if (spot) retargetCat(cat, spot);
    });
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

    /**
     * Brings the floor in line with the café's customer list.
     *
     * The list is the authority on who is here — it survives leaving the
     * screen, and the town map renders its complement so a cat can't be in both
     * places. This only decides where they stand.
     */
    // The list the floor was last reconciled against. It's a fresh array only
    // when the café state actually moved, so an identity check keeps this off
    // the other fifty-nine frames a second.
    let syncedTo: CafeCustomer[] | null = null;

    /**
     * Customers still walking over from the town, oldest first.
     *
     * The floor doesn't draw them yet — out the window they're a roamer
     * crossing the map. Each frame checks the head of this list, and the
     * moment a walk window closes the cat comes through the door for real.
     * That crossing is the *only* walk-in there is: anyone `syncCustomers`
     * first sees already in line was here before you were, and snaps.
     */
    let pending: CafeCustomer[] = [];

    /** Puts one customer on the floor — through the door, or already in place. */
    const spawnCustomer = (customer: CafeCustomer, height: number, walkIn: boolean) => {
      // Any spot will do — `updateQueueTargets` re-assigns the whole line
      // every frame anyway, and a new arrival is at the back by definition.
      const queueSpots = getQueueSpots(width);
      const spot = queueSpots[Math.min(getQueueCats().length, queueSpots.length - 1)];
      if (!spot) return;

      // Born just below the bottom edge — the same doorway `sendCatOut` leaves
      // through — so a walk-in enters the room rather than materialising on
      // the floor.
      const cat = createCat(
        customer.id,
        customer.catId,
        customer.groupId,
        width / 2,
        height + 60,
        spot
      );
      catsRef.current.push(cat);

      // Already in line before you opened the door. Walking them in would
      // replay an arrival that happened while you were somewhere else.
      if (!walkIn) {
        cat.x = cat.targetX;
        cat.y = cat.targetY;
      }

      // Served before you got here — you handed them a cup, left the screen,
      // and came back inside the minute. They should be at a table, not
      // queueing for a drink they already have.
      if (customer.servedAt !== null) {
        // Through `findSeatIndexForCat`, so a party you served before leaving
        // comes back sat at one table rather than scattered.
        const seatIndex = findSeatIndexForCat(cat);
        const seat = seatIndex === null ? null : getSeatSpots()[seatIndex];
        if (seat && seatIndex !== null) {
          sendCatToSeat(cat, seat, seatIndex);
          cat.drink = flavorRef.current;
          // They're mid-drink, not fresh from the counter — the cup should
          // pick up where it left off rather than refilling itself.
          cat.seatedAt = customer.servedAt;
          // Straight into the chair: they were already sitting in it.
          cat.x = cat.targetX;
          cat.y = cat.targetY;
          cat.scale = cat.targetScale;
        }
      }
    };

    const syncCustomers = (height: number) => {
      const customers = customersRef.current;
      if (customers === syncedTo) return;
      syncedTo = customers;

      const now = Date.now();
      const live = new Set(customers.map((c) => c.id));

      // Off the list means the drink is finished and they've gone home. They
      // still walk out rather than blinking away — `isCatOffscreen` collects
      // them below once they're through the door.
      catsRef.current.forEach((cat) => {
        if (cat.state !== 'leaving' && !live.has(cat.id)) {
          sendCatOut(cat, width / 2, height + 110);
        }
      });

      const onFloor = new Set(catsRef.current.map((cat) => cat.id));

      // Rebuilt whole each sync: it's tiny, and the alternative is diffing it.
      pending = [];
      customers.forEach((customer) => {
        if (onFloor.has(customer.id)) return;
        if (customer.servedAt === null && !hasJoined(customer, now)) {
          pending.push(customer);
          return;
        }
        spawnCustomer(customer, height, false);
      });
    };

    const render = () => {
      const height = designHeightRef.current;

      // Each frame is recorded into a fresh picture rather than mutated in
      // place, which is what lets Skia hand it to the render thread.
      const recorder = Skia.PictureRecorder();
      const skCanvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

      // The cached room, then everything that moves on top of it.
      skCanvas.drawPicture(sceneRef.current);

      const ctx: Ctx2D = new SkiaCanvas2D(skCanvas);

      // Arrivals and departures both come off the customer list — a seated cat
      // leaves when the café state drops it, not on a timer of its own, so the
      // town knows it's coming back at the same moment the room does.
      syncCustomers(height);

      // A walk window closing is a timestamp going stale, not a state write,
      // so the door is watched from here: the moment a pending customer's
      // walk ends, it comes in. Oldest set off first, so only the head can be
      // due — the loop almost never runs.
      while (pending.length && hasJoined(pending[0], Date.now())) {
        spawnCustomer(pending.shift() as CafeCustomer, height, true);
      }

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

      // Keep the inspect card over the head of the cat it describes — including
      // while it shuffles up the line, which is most of a queued cat's life.
      // Only a cat leaving drops its card.
      const watching = inspectedRef.current;
      if (watching) {
        const cat = catsRef.current.find((c) => c.id === watching.id);
        if (!cat || !isInspectable(cat)) {
          setInspected(null);
        } else {
          const view = scaleRef.current;
          // `cat.y` is the sprite's centre, and the grid is 28x37 — the head is
          // half a sprite up, not half a width.
          const catH = cat.size * 1.8 * cat.scale * catAspectRatio(cat.catId);
          const spot = anchorCard(
            view.offsetX + cat.x * view.scale,
            (cat.y - catH / 2) * view.scale,
            (cat.y + catH / 2) * view.scale,
            layoutRef.current,
            cardHRef.current
          );
          cardPos.setValue({ x: spot.x, y: spot.y });
          cardPointerX.setValue(spot.pointerX);
          cardFlip.setValue(spot.below ? 1 : 0);
        }
      }

      // Drive the cup's enabled state from the simulation, but only touch React
      // state when it actually flips. "Can't serve" is two different stories:
      // nobody is waiting (the cup just sits), or someone is waiting and the
      // pearls are short — which gets said out loud, because a cup that
      // silently refuses to pour reads as broken, not as unaffordable.
      const servable = canServeFrontCat();
      setCanServe((prev) => (prev === servable ? prev : servable));
      const short =
        !servable &&
        getFrontCatInQueue() !== null &&
        pearlsRef.current < PEARLS_PER_CAT;
      setNeedPearls((prev) => (prev === short ? prev : short));

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
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
  // refs. Rebuilding it per render would hand it a stale `serveFrontCat`
  // mid-drag, and the drag would pay pearls against a snapshot of the queue.
  const cupHomeRef = useRef(cupHome);
  const canServeRef = useRef(false);
  const serveRef = useRef(serveFrontCat);

  cupHomeRef.current = cupHome;
  canServeRef.current = canServe;
  serveRef.current = serveFrontCat;

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

  /** The cat at the front of the line, if the cup came down close enough to it. */
  const findDropTarget = useCallback((dx: number, dy: number): Cat | null => {
    const home = cupHomeRef.current;
    const view = scaleRef.current;
    // The cup is measured as its whole vertical line, top to base, not a
    // single point. It used to be just the base — "you set the cup down in
    // front of the cat" — but the cup stands as tall as a cat, so covering
    // the cat with the cup's *body* (the natural way to hand it over) left
    // the base a full cat-height below the target and the drop silently
    // missed. Any visible overlap should count.
    const cupX = (home.x + dx + CUP_WIDTH / 2 - view.offsetX) / view.scale;
    const cupTopY = (home.y + dy) / view.scale;
    const cupBaseY = (home.y + dy + CUP_HEIGHT) / view.scale;

    const front = getFrontCatInQueue();
    if (!front) return null;

    const nearestY = Math.max(cupTopY, Math.min(cupBaseY, front.y));
    return Math.hypot(front.x - cupX, front.y - nearestY) < DROP_RADIUS ? front : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * How close a tap has to land to a cat's centre, in design units, to inspect
   * it. A cat is ~54x71, so this is roughly its own body: generous enough to
   * hit one in a line without demanding precision. Overlap between neighbours
   * is harmless — the nearest cat wins.
   */
  const INSPECT_RADIUS = 40;

  /**
   * Tap the floor: find the nearest stationary cat and show its preferences.
   *
   * `locationX`/`locationY` are the natural way to read a `Pressable` tap
   * position, but react-native-web's `Pressable` never populates them on
   * `onPress` — only native does. `clientX`/`clientY` are always there
   * (they're the underlying DOM event), so the tap position is read off
   * those instead, measured against the tapped element's own rect rather
   * than the layout-derived `scaleRef.offsetX`, which is a canvas-internal
   * offset, not a screen one.
   */
  const handleInspectTap = useCallback((e: GestureResponderEvent) => {
    const native = e.nativeEvent as unknown as { clientX?: number; clientY?: number };
    const target = e.currentTarget as unknown as { getBoundingClientRect?: () => DOMRect };
    const rect = target?.getBoundingClientRect?.();
    if (native.clientX == null || native.clientY == null || !rect) return;

    const view = scaleRef.current;
    const x = (native.clientX - rect.left - view.offsetX) / view.scale;
    const y = (native.clientY - rect.top) / view.scale;

    let best: Cat | null = null;
    let bestDist = INSPECT_RADIUS;

    catsRef.current.forEach((cat) => {
      if (!isInspectable(cat)) return;
      const dist = Math.hypot(cat.x - x, cat.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = cat;
      }
    });

    const hit = best as Cat | null;
    // Tapping the cat that's already showing puts its card away — with no close
    // button on the card, the cat itself is the toggle.
    setInspected((prev) =>
      !hit ? null : prev?.id === hit.id ? null : { id: hit.id, catId: hit.catId }
    );
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
      // Picking the cup up puts the card away: it sits over the queue, which is
      // exactly where the drag is headed.
      onPanResponderGrant: () => {
        setDragging(true);
        setInspected(null);
      },
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

  const inspectedCat = inspected ? getCat(inspected.catId) ?? null : null;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={styles.fill}>
        <Group transform={[{ translateX: offsetX }, { scale }]}>
          <Picture picture={picture} />
        </Group>
      </Canvas>

      {/* Tap a waiting or seated cat to see what it likes. Sits beneath the
          cup's PanResponder in the tree, so an overlapping drag still wins —
          this only ever fires as a plain tap.

          Absolutely positioned, never `flex: 1`: as a flex child it is a
          sibling of the Canvas and the two split the height between them,
          which crushes the room into the top half and leaves the tap layer
          covering bare floor below it. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleInspectTap} />

      {/* Above the dismissal layer so it's visible, below the cup so a card
          over the front of the queue never buries the thing you're dragging. */}
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
            // Closed before navigating: the café stays mounted under the
            // pushed screen, and coming back to a card pinned on a cat that
            // has since left reads as a glitch.
            setInspected(null);
            router.push(`/cats?cat=${inspectedCat.id}`);
          }}
        />
      )}

      {/* Serving is a gesture, not a button: pick the cup up off the counter
          and hand it to the cat at the front of the line. */}
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          canServe
            ? `Drag the boba to the cat at the front of the line. Costs ${PEARLS_PER_CAT} pearls.`
            : needPearls
              ? `Not enough pearls to serve — it costs ${PEARLS_PER_CAT}.`
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

      {(canServe || needPearls) && !dragging && (
        <View
          style={[styles.hintRow, { top: cupHome.y + CUP_HEIGHT + 8 }]}
          pointerEvents="none"
        >
          <View style={styles.hint}>
            <Text style={styles.hintText}>{canServe ? 'Drag to serve' : 'Need'}</Text>
            <View style={styles.costRow}>
              <PearlIcon size={9} />
              <Text style={styles.costText}>{PEARLS_PER_CAT}</Text>
            </View>
            {!canServe && <Text style={styles.hintText}>to serve</Text>}
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
