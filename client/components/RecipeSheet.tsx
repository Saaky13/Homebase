import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CupSprite } from './CupSprite';
import { CoinIcon, PearlIcon } from './Icons';
import { DrinkDetail, type QueuedCat } from './DrinkDetail';
import {
  DRINKS,
  DRINK_FRAME,
  DRINK_INK,
  DRINK_ORDER,
  type DrinkId,
} from '../constants/drinks';
import {
  affinityFor,
  preferencesFor,
  serveOutcome,
  type Affinity,
} from '../constants/affinity';
import { bondTip } from '../constants/bonds';
import { getCat } from '../constants/catSprites';
import type { CatStat } from '../constants/catLore';

/**
 * The full menu, as a sheet off the machine's `≡` tab.
 *
 * `MACHINE.md` §3. The machine's face holds three presets; everything else you
 * know lives here. A grid rather than the horizontal rail this replaced: a rail
 * shows four cells and hides the rest behind a scroll, which is fine for a
 * short menu and wrong for a growing one — the whole point of the almanac is
 * that the list gets long.
 *
 * **Selecting does not brew and does not spend.** Pearls are paid on the drop.
 * Picking a recipe here loads it into the machine, promotes it to the front of
 * the presets, and dismisses.
 *
 * **Ordered for the cat at the front of the line**, because that is the cat
 * this menu is about to pour for. Four sections — loves, likes, fine, won't
 * drink — rarest first inside each, exactly the ordering the inspect card
 * uses, so the two never teach different lists. The sections re-derive as the
 * queue moves: serve the front cat and the whole menu reshuffles around
 * whoever steps up. With nobody in line there is no cat to sort for, and it
 * falls back to `DRINK_ORDER` — pearl-ascending, cheap workhorses first.
 *
 * **Tap loads, hold inspects.** Holding a cup covers the grid with
 * `DrinkDetail` — what the line in front of you would actually pay for it —
 * and releasing puts the grid back. Peek rather than navigate: comparing two
 * recipes should cost two presses, not four, and a detail view you have to
 * close is one you stop opening. A long press also suppresses the tap, so
 * looking never loads by accident.
 */

/**
 * One affinity band of the menu. `key` is an `Affinity` except on the no-queue
 * fallback, where there is no cat to have one.
 */
interface Section {
  key: string;
  label: string;
  tint: string;
  entries: Entry[];
}

/**
 * One cell's drink and what pouring it would move.
 *
 * Priced for the cat at the front, tip included — the same call the till makes
 * (convention 19), so the menu and the receipt agree to the coin. With nobody
 * in line there is no affinity to score: `coins` falls back to the drink's base
 * and `xp` is null, which the cell draws as a dash rather than a zero.
 */
interface Entry {
  id: DrinkId;
  coins: number;
  xp: number | null;
}

/** Section inks. The inspect card's three, plus a quiet one for the middle. */
const TONE = {
  favorite: '#D87E97',
  likes: '#68A594',
  fine: '#A08C82',
  dislikes: '#8F7C72',
};

const COLUMNS = 4;
const CELL_H = 88;
/** Cell face drop on press. Pixel UI has no sub-pixel positions to ease through. */
const PRESS_DROP = 4;
/**
 * How long a press has to last to count as a look rather than a choice, in ms.
 * Short enough that curiosity is cheap; long enough that a decisive tap on a
 * cell you already know never flashes the panel at you.
 */
const PEEK_MS = 220;

export interface RecipeSheetProps {
  /** What the player knows — `state.recipes`. */
  recipes: DrinkId[];
  /** Who is waiting at the counter right now, front first. */
  queue: QueuedCat[];
  /** Per-cat bond records, for the tip each waiting cat is currently worth. */
  catStats: Record<string, CatStat>;
  /** Adopted roster ids; the rest draw as silhouettes in the detail panel. */
  ownedCats: string[];
  /** The recipe currently loaded in the machine. */
  loaded: DrinkId | null;
  /** Pearls on hand, for affordability. Greys the cell; never blocks selection. */
  pearls: number;
  onSelect: (id: DrinkId) => void;
  onDismiss: () => void;
}

export function RecipeSheet({
  recipes,
  queue,
  catStats,
  ownedCats,
  loaded,
  pearls,
  onSelect,
  onDismiss,
}: RecipeSheetProps) {
  const insets = useSafeAreaInsets();

  const front = queue[0] ? getCat(queue[0].catId) : null;

  /**
   * The menu, cut into affinity sections for whoever is at the counter.
   *
   * Keyed off the front cat's id rather than the whole queue: the cats behind
   * do not change the order, and re-bucketing fourteen drinks every time the
   * back of the line shuffles is work for nothing.
   */
  const sections = useMemo<Section[]>(() => {
    const owned = DRINK_ORDER.filter((id) => recipes.includes(id));
    if (!front) {
      return [
        {
          key: 'all',
          label: 'Your menu',
          tint: TONE.fine,
          entries: owned.map((id) => ({ id, coins: DRINKS[id].baseCoins, xp: null })),
        },
      ];
    }

    const tip = bondTip(catStats[front.id]?.bondXp ?? 0, front.rarity);
    const price = (id: DrinkId): Entry => {
      const out = serveOutcome(front, id, { bondTip: tip });
      return { id, coins: out.coins, xp: out.xp };
    };

    // `ranked` is already favourite → likes → fine → dislikes, rarest first
    // within each, so one index lookup sorts every bucket correctly and the
    // rarity ordering has exactly one definition (`affinity.ts`).
    const order = new Map(preferencesFor(front).ranked.map((id, i) => [id, i]));
    const buckets: Record<Affinity, DrinkId[]> = {
      favorite: [],
      likes: [],
      fine: [],
      dislikes: [],
    };
    owned.forEach((id) => buckets[affinityFor(front, id)].push(id));

    const name = front.name;
    return (
      [
        { key: 'favorite', label: `${name} loves`, tint: TONE.favorite },
        { key: 'likes', label: `${name} likes`, tint: TONE.likes },
        { key: 'fine', label: `Fine by ${name}`, tint: TONE.fine },
        { key: 'dislikes', label: `${name} won't drink`, tint: TONE.dislikes },
      ] as const
    )
      .map((sec) => ({
        ...sec,
        entries: buckets[sec.key as Affinity]
          .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
          .map(price),
      }))
      .filter((sec) => sec.entries.length > 0);
  }, [recipes, front, catStats]);

  /** The cup being held, or null. Cleared on release — this is a peek. */
  const [peek, setPeek] = useState<DrinkId | null>(null);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Tapping off the sheet closes it. The scrim is deliberately light: the
          café keeps running underneath and the queue you are choosing for has
          to stay readable while you choose. */}
      <Pressable style={styles.scrim} onPress={onDismiss} />

      <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{peek ? 'Holding' : 'Menu'}</Text>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close the menu"
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {/* The grid stays mounted under the panel rather than being swapped
            out: unmounting a scrolled list loses its offset, and the peek is
            meant to be something you drop back out of exactly where you were. */}
        <View style={styles.stack}>
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((sec) => (
              <React.Fragment key={sec.key}>
                {/* Full width, so the wrap breaks the row for it — the grid is
                    one flex-wrap list and a header is just a cell that takes
                    the whole line. */}
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionLabel, { color: sec.tint }]}>
                    {sec.label.toUpperCase()}
                  </Text>
                  <View style={[styles.sectionRule, { backgroundColor: sec.tint }]} />
                </View>
                {sec.entries.map((entry) => (
                  <SheetCell
                    key={entry.id}
                    id={entry.id}
                    coins={entry.coins}
                    xp={entry.xp}
                    loaded={entry.id === loaded}
                    affordable={pearls >= DRINKS[entry.id].pearls}
                    dim={sec.key === 'dislikes'}
                    onSelect={onSelect}
                    onPeek={setPeek}
                  />
                ))}
              </React.Fragment>
            ))}
          </ScrollView>

          {peek && (
            <DrinkDetail
              drink={peek}
              queue={queue}
              catStats={catStats}
              ownedCats={ownedCats}
            />
          )}
        </View>

        <Text style={styles.hint}>
          {peek ? 'Let go to go back' : 'Tap to load · hold to see who wants it'}
        </Text>
      </View>
    </View>
  );
}

interface SheetCellProps {
  id: DrinkId;
  /** Coins the front cat would pay for it, tip included. */
  coins: number;
  /** Bond XP it would bank, or null when there is no cat to bank it. */
  xp: number | null;
  loaded: boolean;
  affordable: boolean;
  /** A drink the front cat refuses. Still loadable — it just pays badly. */
  dim?: boolean;
  onSelect: (id: DrinkId) => void;
  /** Called with the id on hold, and with null the moment it is let go. */
  onPeek: (id: DrinkId | null) => void;
}

function SheetCell({
  id,
  coins,
  xp,
  loaded,
  affordable,
  dim,
  onSelect,
  onPeek,
}: SheetCellProps) {
  const spec = DRINKS[id];
  const [pressed, setPressed] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  /**
   * Selecting an unaffordable recipe is allowed — you may be about to earn the
   * pearls, and the machine refuses at the drop, not the choice. The shake is
   * a warning, not a rejection.
   */
  const warn = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 20, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 20, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  return (
    <Animated.View
      style={[
        styles.cellSlot,
        {
          transform: [
            {
              translateX: shake.interpolate({
                inputRange: [-1, 1],
                outputRange: [-3, 3],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (!affordable) warn();
          onSelect(id);
        }}
        // React Native suppresses onPress once onLongPress has fired, so the
        // look and the choice can share one gesture without one triggering the
        // other.
        onLongPress={() => onPeek(id)}
        delayLongPress={PEEK_MS}
        onPressIn={() => setPressed(true)}
        onPressOut={() => {
          setPressed(false);
          onPeek(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          xp === null
            ? `${spec.name}, ${spec.pearls} pearls`
            : `${spec.name}, ${spec.pearls} pearls, pays ${coins} coins and ${xp} bond`
        }
        style={[
          styles.cell,
          { borderColor: DRINK_FRAME[spec.rarity] },
          loaded && styles.cellLoaded,
          (dim || !affordable) && styles.cellPoor,
          // Instant, unlike everything in the room — this is pixel UI
          // (convention 5) and the room is a physical space.
          pressed && { transform: [{ translateY: PRESS_DROP }] },
        ]}
      >
        <CupSprite drink={id} width={30} />
        {/* The name carries the rarity, the same five inks the inspect card
            and the almanac use. */}
        <Text numberOfLines={1} style={[styles.name, { color: DRINK_INK[spec.rarity] }]}>
          {spec.name}
        </Text>
        {/* Coins in, pearls out, bond banked. The two currencies wear the top
            bar's own marks rather than a `+` and a `◆`: an 84pt cell can't
            afford a symbol *and* a sign, and the icon is the shorter word —
            it also ties the number to the pill it will land in. Bond has no
            mark in the app, so it stays a bare plum figure, which is enough
            to tell it from the two that do. */}
        <View style={styles.figures}>
          <CoinIcon size={8} />
          <Text style={styles.fCoins}>{coins}</Text>
          <PearlIcon size={8} />
          <Text style={[styles.fPearls, !affordable && styles.costPoor]}>
            {spec.pearls}
          </Text>
          <Text style={styles.fXp}>{xp === null ? '–' : `+${xp}`}</Text>
        </View>
      </Pressable>
      {loaded && <View style={styles.underline} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(60,40,28,0.28)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    backgroundColor: '#FFF7EC',
    borderTopWidth: 3,
    borderTopColor: '#B08A63',
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4E3226',
  },
  close: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8A5A33',
  },
  stack: {
    flexShrink: 1,
  },
  hint: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B9AFA6',
    textAlign: 'center',
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 8,
  },
  sectionHead: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    opacity: 0.35,
  },
  cellSlot: {
    width: `${100 / COLUMNS}%`,
    maxWidth: 84,
    flexGrow: 1,
  },
  cell: {
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 5,
    gap: 1,
    borderWidth: 2,
    borderRadius: 0,
    backgroundColor: '#FFFDF8',
  },
  cellLoaded: {
    backgroundColor: '#FFF3D6',
  },
  cellPoor: {
    opacity: 0.45,
  },
  name: {
    fontSize: 8,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  figures: {
    flexDirection: 'row',
    // `center`, not `baseline`: an icon has no baseline to sit on, and mixing
    // the two drops the marks below the digits.
    alignItems: 'center',
    gap: 2,
  },
  fCoins: { fontSize: 8, fontWeight: '800', color: '#7A5418', marginRight: 2 },
  fPearls: { fontSize: 8, fontWeight: '800', color: '#6B52A8', marginRight: 2 },
  fXp: { fontSize: 8, fontWeight: '800', color: '#8A4A67' },
  costPoor: {
    color: '#C0564E',
  },
  underline: {
    height: 4,
    marginTop: 2,
    backgroundColor: '#E4C983',
  },
});
