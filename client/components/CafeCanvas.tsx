import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
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
  drawBrewMachine,
  CUP_STATION,
  BREW_MACHINE,
  type BrewMachineView,
} from './cafeRender';
import { snap } from './cafePixel';
import { cafePaletteFor, isNightAt } from '../constants/cafePalette';
import { hasJoined, type CafeCustomer } from '../constants/cafeVisit';
import { CUP_ASPECT } from './BobaCupSprite';
import { PearlIcon } from './Icons';
import { getCat } from '../constants/catSprites';
import { bondTip } from '../constants/bonds';
import { serveOutcome } from '../constants/affinity';
import { DRINKS, STARTER_RECIPES, type DrinkId } from '../constants/drinks';
import { CupSprite } from './CupSprite';
import { RecipeSheet } from './RecipeSheet';
import type { CatStat } from '../constants/catLore';
import CatInspectCard, { CARD_H_ESTIMATE, anchorCard } from './CatInspectCard';
import { ServeReceipt } from './ServeReceipt';
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

/**
 * How long the dispense button is held to fill a cup, in ms. Linear, and
 * emphatically not a timing game — there is no window to hit and no penalty
 * for holding longer. The bar exists so the wait is legible, not so it can be
 * failed.
 */
const HOLD_MS = 600;
/** Release before full and the gauge drains back. No penalty, just undone. */
const DRAIN_MS = 200;
/** A dumped cup empties over this, matching the drain. Cancel is not a penalty. */
const DUMP_MS = 200;
/**
 * Screen px a receipt is raised above the top of a cat's head. Has to clear the
 * plate's own height as well as the gap, or the bottom edge lands on the ears —
 * a sprite's silhouette is all ears, and a number resting on them reads as a hat.
 */
const RECEIPT_LIFT = 46;

/**
 * What one serve moved, floated off the cat it moved it for.
 *
 * Position is sampled at the moment of the serve and never tracked — the cat
 * is on its way to a chair by the next frame, and a receipt that chased it
 * would read as part of the cat rather than as a number leaving the till.
 */
interface Receipt {
  id: string;
  screenX: number;
  screenY: number;
  coins: number;
  pearls: number;
  xp: number;
}

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
/**
 * What the drop costs. Read off the recipe rather than a flat rate — handing a
 * legendary to a cat that merely tolerates it is the expensive mistake the
 * menu exists to let you avoid. Brewing itself is free; pearls go on the drop.
 */
const pearlsPerCat = (drink: DrinkId) => DRINKS[drink]?.pearls ?? 5;

/**
 * How far a cat steps aside to leave the queue, in design units.
 *
 * The line is single-file down the middle of the room, so a cat walking out
 * from the *front* of it has every other cat between itself and the door.
 * Walked straight, it passes through the whole queue and the sprite you watch
 * reach the door is the one at the back — the wrong cat looks like the one
 * that gave up. Stepping into the aisle first is what makes the departure
 * legible: it breaks ranks, walks down past the line, and only then leaves.
 *
 * 66 clears a cat's own width and still lands between the queue and the left
 * column of tables (x 64–106), so nobody walks out through the furniture.
 */
const QUEUE_EXIT_AISLE = 66;

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
  const flavorRef = useRef<DrinkId>('classic');
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

  /* ---------------------------- the machine ---------------------------- */

  /**
   * The recipe in the machine, and the three cells on its face.
   *
   * Presets are most-recently-used: choosing from the menu promotes to the
   * front. They are local rather than persisted — a save field for MRU order
   * is worth adding once the rest of this settles, and until then the machine
   * opens on the starters, which is where a new player would leave it anyway.
   */
  const [presetIds, setPresetIds] = useState<DrinkId[]>(() => {
    const known = state.recipes ?? [];
    const seed = [...STARTER_RECIPES.filter((id) => known.includes(id)), ...known];
    return Array.from(new Set(seed)).slice(0, 3);
  });
  const [loaded, setLoaded] = useState<DrinkId>(
    () => presetIds[0] ?? STARTER_RECIPES[0]
  );
  // Read by the render loop, which must not be restarted when the selection
  // changes — the frame the change lands on is the one you would drop.
  const loadedRef = useRef<DrinkId>(loaded);
  loadedRef.current = loaded;

  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * The cup on the counter, or null when there is nothing brewed.
   *
   * Nothing sits here speculatively: you cannot brew with an empty queue, and
   * a cup whose cat has left is dumped rather than kept. A drink that outlives
   * its customer is inventory arriving by the back door.
   */
  const [brewed, setBrewed] = useState<DrinkId | null>(null);
  /**
   * **The ref leads the state; it is never mirrored back from render.**
   *
   * Every other ref beside a state here is written `ref.current = state` at
   * render time, and this one used to be as well. That is fine for a value the
   * loop only reads a frame late — and fatally wrong for this one, because
   * `cancelBrew` deliberately clears the ref *before* the state so the cup
   * stops being servable the instant you hit ✕ rather than 200ms later.
   *
   * A render-time mirror undid that on the very next render, which
   * `setDumping(1)` schedules immediately: the ref came back holding the drink,
   * so the dump's closing `if (!brewedRef.current) setBrewed(null)` skipped,
   * `dumping` cleared, and the cup fell back to `brewed ? 1 : 0` — full. The
   * liquid dropped and then returned, which is exactly what ✕ looked like.
   *
   * So the ref is authoritative and every `setBrewed` writes it in the same
   * breath. There are four such sites: the serve, the brew, `selectRecipe` and
   * `cancelBrew`. A fifth that forgets is a bug this comment is here to catch.
   */
  const brewedRef = useRef<DrinkId | null>(null);

  /**
   * The cup emptying after a cancel. `null` when idle; otherwise the fill the
   * dump is currently showing, ticked down to zero and then cleared.
   *
   * A plain state stepped on a timer rather than an `Animated.Value`, because
   * `CupSprite` quantises fill to four steps — the whole dump is four renders,
   * and driving it through the frame loop would re-render the canvas at 60fps
   * to show four pictures.
   */
  const [dumping, setDumping] = useState<number | null>(null);

  /** ms epoch the dispense hold began, or null when not held. */
  const holdRef = useRef<number | null>(null);
  /** Where the gauge was, and when, at the moment of an early release. */
  const drainRef = useRef<{ from: number; at: number } | null>(null);
  /** ms epoch the post-brew steam stops. Read by the loop, never by React. */
  const steamUntilRef = useRef(0);

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
    // An empty cup is not servable. The hold is the whole gate: nothing leaves
    // this counter that you did not stand there and brew.
    if (!brewedRef.current) return false;

    const front = getFrontCatInQueue();
    if (!front) return false;
    if (pearlsRef.current < pearlsPerCat(flavorRef.current)) return false;
    return findSeatIndexForCat(front) !== null;
  };

  const serveFrontCat = () => {
    const front = getFrontCatInQueue();
    if (!front) return false;

    const seatIndex = findSeatIndexForCat(front);
    if (seatIndex === null) return false;

    const seat = getSeatSpots()[seatIndex];
    if (!seat) return false;

    const cost = pearlsPerCat(flavorRef.current);
    if (pearlsRef.current < cost) return false;
    if (!spendPearls(cost)) return false;

    pearlsRef.current -= cost;

    // Sampled before the cat is sent off — `sendCatToSeat` only retargets, so
    // `front.x/y` is still the spot in line it was standing in when you handed
    // the cup over. That is where the numbers belong.
    const view = scaleRef.current;
    const catH = front.size * 1.8 * front.scale * catAspectRatio(front.catId);
    const receiptX = view.offsetX + front.x * view.scale;
    const receiptY = (front.y - catH / 2) * view.scale - RECEIPT_LIFT;

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
    const out = spec ? serveOutcome(spec, flavorRef.current, { bondTip: tip }) : null;
    // The recipe sets the payout, not a flat rate: base coins for the drink,
    // times what this cat thinks of it, times the tip. The menu shows this
    // arithmetic to the pearl, so the serve has to actually run it — a menu
    // quoting numbers the till doesn't pay is worse than no menu.
    const coins = out ? out.coins : DRINKS[flavorRef.current].baseCoins;
    addCoins(coins);

    addDrinkServed(1);
    recordCatsServed([front.catId], flavorRef.current);
    // They stop being *queued* here but stay in the café: a served cat sits
    // with its cup for a minute, and it must not turn up out in the town while
    // it's still visibly at a table.
    serveCustomers([front.id]);

    // The cup goes with them. Brewing again is a fresh hold — which is what
    // keeps a serve a decision rather than a tap you can repeat.
    setBrewed(null);
    brewedRef.current = null;

    // The three numbers the serve moved, said once where it happened. The id
    // carries the clock as well as the customer: the same cat can come back
    // and be served again while its first receipt is still in the air.
    setReceipts((prev) => [
      ...prev,
      {
        id: `${front.id}-${Date.now()}`,
        screenX: receiptX,
        screenY: receiptY,
        coins,
        pearls: cost,
        xp: out ? out.xp : 0,
      },
    ]);

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

  /**
   * The machine's live state, in a ref rather than a dep of the render effect.
   * Everything on its face changes — the lamp with the queue, the cells with
   * what you can pay for — and restarting the game loop on each of those would
   * drop the frame the change happened on.
   *
   * `selectedIndex` is -1 whenever the loaded recipe came from the menu and has
   * not been promoted yet, which is exactly what `drawPresetCell` reads to
   * leave every cell unlit.
   */
  const machineRef = useRef<BrewMachineView>({
    pal: palette,
    presets: [],
    selectedIndex: 0,
    ready: false,
    fill: 0,
    pressed: false,
    shake: 0,
    steam: 0,
  });
  machineRef.current = {
    ...machineRef.current,
    pal: palette,
    presets: presetIds.map((id) => ({
      id,
      affordable: state.pearls >= (DRINKS[id]?.pearls ?? 0),
    })),
    selectedIndex: presetIds.indexOf(loaded),
  };

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

      // Off the list means they've gone home — either the drink is finished
      // or the wait was. They still walk out rather than blinking away;
      // `isCatOffscreen` collects them below once they're through the door.
      const queueSpots = getQueueSpots(width);
      const aisleX = width / 2 - QUEUE_EXIT_AISLE;
      const pastLine = queueSpots[queueSpots.length - 1].y + 46;

      catsRef.current.forEach((cat) => {
        if (cat.state === 'leaving' || live.has(cat.id)) return;

        // A cat going home from a table already has a clear run at the door.
        // Only one leaving the line needs the detour — see `QUEUE_EXIT_AISLE`.
        const inLine = cat.state === 'walkingToLine' || cat.state === 'waiting';
        const via = inLine
          ? [
              { x: aisleX, y: cat.y },
              { x: aisleX, y: Math.max(pastLine, cat.y) },
            ]
          : [];

        sendCatOut(cat, width / 2, height + 110, via);
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

      // The machine is counter furniture but it can't live in the room picture:
      // its lamp, gauge, cells and hum all change, and each change would force
      // the whole room to be re-recorded. It is ~120 rects against the room's
      // several thousand, so it is cheaper to just paint it every frame.
      drawBrewMachine(ctx, machineRef.current);

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

      // No want bubble. A 26x20 thought bubble at PX 2 has about eight pixels
      // to say anything with, so every cat asked for the same generic cup —
      // a permanent smudge beside every head that told you nothing. Tapping
      // the cat opens the inspect card, which answers the same question
      // properly and now loads the drink besides.

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
      // Lit when there is someone to brew for. With an empty queue the machine
      // reads as off, which is why the dispense button is allowed to refuse.
      const ready = getFrontCatInQueue() !== null;
      machineRef.current.ready = ready;

      // Someone leaving mid-brew cancels it, and a cup that outlives its cat is
      // dumped. Both fall out of the same check: no queue, no brew, no cup.
      if (!ready) {
        holdRef.current = null;
        drainRef.current = null;
        machineRef.current.fill = 0;
        if (brewedRef.current) cancelRef.current();
      }

      const now = Date.now();
      if (holdRef.current != null) {
        const held = Math.min(1, (now - holdRef.current) / HOLD_MS);
        machineRef.current.fill = held;

        if (held >= 1 && !brewedRef.current) {
          brewedRef.current = loadedRef.current;
          setBrewed(loadedRef.current);
          steamUntilRef.current = now + 1200;
          // **Full releases the hold, whatever the finger is doing.** Holding
          // past full does nothing by design, so keeping the hold open only
          // gave a lost `onPressOut` somewhere to hide: `holdRef` stayed set,
          // the machine kept humming, and the instant a cancel cleared the cup
          // this branch re-filled it on the very next frame. Cancel looked
          // like a shake that undid itself.
          //
          // The gauge stays full because `fill` is left at 1 and nothing
          // drains it — `endHold` returns early on a null `holdRef`, so the
          // release that eventually arrives is a no-op rather than a drain.
          holdRef.current = null;
          machineRef.current.pressed = false;
        }
      } else if (drainRef.current) {
        // Released early. The gauge runs back down and nothing was spent —
        // letting go is undoing, not failing.
        const { from, at } = drainRef.current;
        const t = Math.min(1, (now - at) / DRAIN_MS);
        machineRef.current.fill = from * (1 - t);
        if (t >= 1) drainRef.current = null;
      }

      // Steam only means something just landed, so it runs off a deadline
      // rather than the gauge — the gauge is still full while the cup waits.
      machineRef.current.steam =
        now < steamUntilRef.current
          ? 1 - (steamUntilRef.current - now) / 1200
          : 0;

      // The hum. A whole design unit either way at PX 2 is one art pixel, which
      // is the smallest shake the room can express.
      machineRef.current.shake =
        holdRef.current != null ? (Math.floor(now / 70) % 3) - 1 : 0;

      const servable = canServeFrontCat();
      setCanServe((prev) => (prev === servable ? prev : servable));
      const short =
        !servable &&
        ready &&
        !!brewedRef.current &&
        pearlsRef.current < pearlsPerCat(flavorRef.current);
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

  // The cup carries the recipe you brewed, not whatever was most abundant.
  flavorRef.current = brewed ?? loaded;

  /* ----------------------------- the receipts ---------------------------- */

  /**
   * The receipts floating off cats that have just been served.
   *
   * A list rather than a single slot, because serves can overlap: the last
   * receipt is still rising when the line steps forward and you hand over the
   * next cup. Each removes itself when its animation ends, so nothing here
   * needs a timer or a sweep.
   */
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  /**
   * Load a recipe and promote it to the front of the presets.
   *
   * Selecting never brews and never spends — pearls are paid on the drop. It
   * does dump whatever is already in the cup: the cup shows the recipe it
   * holds, so leaving a brewed drink there while the face says something else
   * would be the machine lying about what you are about to hand over.
   */
  const selectRecipe = useCallback(
    (id: DrinkId) => {
      setLoaded(id);
      loadedRef.current = id;
      setPresetIds((prev) => [id, ...prev.filter((p) => p !== id)].slice(0, 3));
      setBrewed((prev) => (prev === id ? prev : null));
      if (brewedRef.current !== id) brewedRef.current = null;
      holdRef.current = null;
      drainRef.current = null;
      setDumping(null);
    },
    []
  );

  /**
   * Dump the cup. Cheap by construction, because the brew was free — this is
   * not undoing a cost, it is clearing the counter when you would rather bank
   * the pearls than hand this drink to this cat.
   */
  const cancelBrew = useCallback(() => {
    if (!brewedRef.current) return;
    // The ref goes first and the state follows the animation: the drop reads
    // `brewedRef`, so the cup stops being servable the instant you cancel, not
    // 200ms later when it finishes looking empty.
    brewedRef.current = null;
    holdRef.current = null;
    drainRef.current = null;
    machineRef.current.fill = 0;
    const started = Date.now();
    setDumping(1);
    const tick = setInterval(() => {
      const left = 1 - (Date.now() - started) / DUMP_MS;
      if (left > 0) {
        setDumping(left);
        return;
      }
      clearInterval(tick);
      setDumping(null);
      // A dump is slow enough to start a fresh brew inside, so only clear the
      // cup if nothing has been brewed into it since.
      if (!brewedRef.current) setBrewed(null);
    }, DUMP_MS / 5);
  }, []);

  // The loop dumps too — a cup whose cat has left goes the same way as one you
  // dumped on purpose, so there is one emptying animation rather than two.
  const cancelRef = useRef(cancelBrew);
  cancelRef.current = cancelBrew;

  const beginHold = useCallback(() => {
    // No speculative brewing. With nobody in line the button is inert and says
    // so with a shake rather than silently doing nothing.
    if (!machineRef.current.ready || brewedRef.current) {
      machineRef.current.shake = 1;
      return;
    }
    drainRef.current = null;
    holdRef.current = Date.now();
    machineRef.current.pressed = true;
  }, []);

  const endHold = useCallback(() => {
    machineRef.current.pressed = false;
    if (holdRef.current == null) return;
    const held = Math.min(1, (Date.now() - holdRef.current) / HOLD_MS);
    holdRef.current = null;
    // Full is full — the cup is brewed and the gauge stays up until it is
    // handed over. Anything short drains back with no penalty.
    if (held < 1) drainRef.current = { from: held, at: Date.now() };
  }, []);

  /**
   * The backstop for a release that never reaches the button.
   *
   * `onPressOut` is the normal way out of a hold, and it does not always come:
   * a pointer that leaves the window, a gesture the browser takes over for a
   * scroll or a text selection, a dev-tools focus steal. A hold is the one
   * gesture in the room where a missed release is not harmless — the machine
   * keeps filling a cup nobody is asking for — so the window gets watched too.
   * Both paths call the same `endHold`, which is idempotent on a null hold.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const release = () => endHold();
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
      window.removeEventListener('blur', release);
    };
  }, [endHold]);

  /**
   * The line, for the menu's detail panel.
   *
   * Derived from `cafeVisit` rather than read off `catsRef`, because the sheet
   * is React and has to re-render when the queue moves — the canvas's cat
   * entities live in a ref precisely so they don't cause renders. Same source
   * of truth either way (convention 18); the canvas mirrors this same list.
   *
   * Recomputed only while the sheet is open. `sheetTick` advances on the same
   * 5s settle the provider runs, so a cat joining the line while you are
   * reading updates the payouts under your thumb.
   */
  const sheetQueue = useMemo(() => {
    if (!sheetOpen) return [];
    const now = Date.now();
    return state.cafeVisit.customers
      .filter((c) => c.servedAt === null && hasJoined(c, now))
      .sort((a, b) => a.setOffAt - b.setOffAt)
      .map((c, i) => ({ catId: c.catId, place: i + 1 }));
  }, [sheetOpen, state.cafeVisit.customers]);

  /** Design-space rect -> the absolute box a Pressable needs over the canvas. */
  const overlay = useCallback(
    (r: { x: number; y: number; w: number; h: number }) => ({
      position: 'absolute' as const,
      left: offsetX + r.x * scale,
      top: r.y * scale,
      width: r.w * scale,
      height: r.h * scale,
    }),
    [offsetX, scale]
  );

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

      {/* The machine's controls are real views laid over the canvas at the same
          design rects `drawBrewMachine` paints from, so the art and the touch
          targets cannot drift apart — the bug the seat spots taught us. Above
          the dismissal layer, so tapping the machine never also inspects a cat
          standing behind it. */}
      {presetIds.map((id, i) => {
        const cell = BREW_MACHINE.presets[i];
        if (!cell) return null;
        return (
          <Pressable
            key={id}
            style={overlay(cell)}
            onPress={() => selectRecipe(id)}
            accessibilityRole="button"
            accessibilityLabel={`Load ${DRINKS[id].name}`}
          />
        );
      })}

      <Pressable
        style={overlay(BREW_MACHINE.menuTab)}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open the menu"
      />

      <Pressable
        style={overlay(BREW_MACHINE.button)}
        onPressIn={beginHold}
        onPressOut={endHold}
        accessibilityRole="button"
        accessibilityLabel={`Hold to brew ${DRINKS[loaded].name}`}
      />

      {/* Dump the cup. Only here while there is something to dump — a standing
          ✕ beside an empty cup is a control that spends most of its life
          meaning nothing. Hidden mid-drag, where the cup is in the air and the
          plate would be pointing at a station it has left. */}
      {brewed && !dragging && (
        <Pressable
          style={[styles.cancel, { left: cupHome.x + CUP_WIDTH + 4, top: cupHome.y + 6 }]}
          onPress={cancelBrew}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dump the cup"
        >
          <Text style={styles.cancelMark}>x</Text>
        </Pressable>
      )}

      {/* Above the dismissal layer so it's visible, below the cup so a card
          over the front of the queue never buries the thing you're dragging. */}
      {inspectedCat && (
        <CatInspectCard
          cat={inspectedCat}
          recipes={state.recipes ?? []}
          bondXp={state.catStats[inspectedCat.id]?.bondXp ?? 0}
          // Read off `state`, not `customersRef`: the ref is the render loop's
          // copy and changing it re-renders nothing, so a card fed from it
          // would keep counting down for a cat that has already been served.
          customer={
            state.cafeVisit.customers.find((c) => c.id === inspected?.id) ?? null
          }
          pos={cardPos}
          pointerX={cardPointerX}
          flip={cardFlip}
          onHeight={(h) => {
            cardHRef.current = h;
          }}
          // Tapping the drink a cat wants loads it. The card was already
          // naming the answer; making the name the button removes the step
          // where you read it here and then go hunt for it on the machine.
          // Closes on the way out — the card has done its job, and leaving it
          // pinned over the queue hides the machine you were sent to.
          onPickDrink={(drink) => {
            selectRecipe(drink);
            setInspected(null);
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

      {/* What that serve just moved — coins in, pearls out, bond earned —
          floated off the cat it was handed to. The only numbers the room
          shows: a forecast plate over every waiting head turned the queue
          into a spreadsheet, and the card already prices every drink. */}
      {receipts.map((r) => (
        <ServeReceipt
          key={r.id}
          screenX={r.screenX}
          screenY={r.screenY}
          coins={r.coins}
          pearls={r.pearls}
          xp={r.xp}
          onDone={() => setReceipts((prev) => prev.filter((p) => p.id !== r.id))}
        />
      ))}

      {/* Serving is a gesture, not a button: pick the cup up off the counter
          and hand it to the cat at the front of the line. */}
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          canServe
            ? `Drag the ${DRINKS[flavorRef.current].name} to the cat at the front of the line. Costs ${pearlsPerCat(flavorRef.current)} pearls.`
            : needPearls
              ? `Not enough pearls to serve — it costs ${pearlsPerCat(flavorRef.current)}.`
              : brewed
                ? 'No cat is waiting to be served'
                : `Nothing brewed — hold the machine to fill a ${DRINKS[loaded].name}`
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
        {/* An unbrewed cup stands empty. Showing it full would promise a
            drink the hold has not made yet. */}
        <CupSprite
          drink={brewed ?? loaded}
          fill={dumping ?? (brewed ? 1 : 0)}
          width={CUP_WIDTH}
        />
      </Animated.View>

      {sheetOpen && (
        <RecipeSheet
          recipes={state.recipes ?? []}
          queue={sheetQueue}
          catStats={state.catStats}
          ownedCats={state.ownedCats}
          loaded={loaded}
          pearls={state.pearls}
          onSelect={(id) => {
            selectRecipe(id);
            setSheetOpen(false);
          }}
          onDismiss={() => setSheetOpen(false)}
        />
      )}

      {(canServe || needPearls) && !dragging && (
        <View
          style={[styles.hintRow, { top: cupHome.y + CUP_HEIGHT + 8 }]}
          pointerEvents="none"
        >
          <View style={styles.hint}>
            <Text style={styles.hintText}>{canServe ? 'Drag to serve' : 'Need'}</Text>
            <View style={styles.costRow}>
              <PearlIcon size={9} />
              <Text style={styles.costText}>{pearlsPerCat(brewed ?? loaded)}</Text>
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
  cancel: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // Square, because the room is. A round button here would be the only
    // radius on the counter.
    backgroundColor: 'rgba(255,247,236,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(112,74,48,0.3)',
  },
  cancelMark: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
    color: '#8A4A3A',
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
