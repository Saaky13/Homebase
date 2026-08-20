import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CatSprite } from './CatSprite';
import { CupSprite } from './CupSprite';
import {
  AFFINITY_COINS,
  AFFINITY_LABEL,
  AFFINITY_PIPS,
  affinityFor,
  catsFavoring,
  catsLiking,
  serveOutcome,
  type Affinity,
} from '../constants/affinity';
import { bondLevel, bondTip, tipLabel } from '../constants/bonds';
import { DRINKS, DRINK_FRAME, type DrinkId } from '../constants/drinks';
import { getCat } from '../constants/catSprites';
import type { CatStat } from '../constants/catLore';

/**
 * What one recipe is worth, held up against the line standing in front of you.
 *
 * This is deliberately *not* the almanac. The almanac answers "what is this
 * drink" from the shelter, at leisure, for every cat in the roster. This
 * answers "what happens if I hand this to the cat at the counter right now" —
 * it is the only view in the app that knows who is waiting, so that is the part
 * it leads with. Strip the queue out and it becomes a worse copy of a screen
 * that already exists.
 *
 * It states numbers and never a verdict. No "best pick" marker, no reordering
 * by payout: the moment the menu names the answer, the affinity system stops
 * being a thing you learn and becomes a thing you tap. The arithmetic is spelled
 * out for the same reason — `26 x 2.0 x 1.10` teaches where the money comes
 * from in a way `57c` cannot.
 *
 * Every number here is the number the till actually pays. `serveOutcome` is
 * what `CafeCanvas` calls on the drop, and the tip is read the same way the
 * serve reads it — the bond you walked in with, before this cup's XP lands
 * (convention 19).
 */

/** Cats shown in the "who loves this" row before it starts wrapping forever. */
const FANS_SHOWN = 8;

export interface QueuedCat {
  /** Roster id. */
  catId: string;
  /** Position in line, 1-based, for the row label. */
  place: number;
}

export interface DrinkDetailProps {
  drink: DrinkId;
  /** Who is in line right now, front first. Empty is a normal state. */
  queue: QueuedCat[];
  catStats: Record<string, CatStat>;
  /** Roster ids the player has adopted — everyone else draws as a silhouette. */
  ownedCats: string[];
}

export function DrinkDetail({ drink, queue, catStats, ownedCats }: DrinkDetailProps) {
  const spec = DRINKS[drink];
  const frame = DRINK_FRAME[spec.rarity];

  // The fan row is roster-wide and never changes for a given drink, so it is
  // worth memoising past the re-render a hold causes.
  const fans = useMemo(() => {
    const owned = new Set(ownedCats);
    // `catsLiking` returns favourites too, so the two lists overlap and have to
    // be merged rather than concatenated — otherwise every cat that favours the
    // drink appears twice and eats a slot from the eight.
    const favs = catsFavoring(drink);
    const favIds = new Set(favs.map((c) => c.id));
    const all = [...favs, ...catsLiking(drink).filter((c) => !favIds.has(c.id))];
    // Yours first. A row that opens with eight silhouettes reads as a locked
    // cabinet; one that opens with cats you actually have is a fact about your
    // café that happens to also show what you're missing.
    return [
      ...all.filter((c) => owned.has(c.id)),
      ...all.filter((c) => !owned.has(c.id)),
    ].slice(0, FANS_SHOWN);
  }, [drink, ownedCats]);

  return (
    <View style={[styles.panel, { borderColor: frame }]}>
      <View style={[styles.header, { borderBottomColor: frame }]}>
        <CupSprite drink={drink} width={34} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{spec.name}</Text>
          <Text style={styles.meta}>
            <Text style={styles.rarity}>{spec.rarity}</Text> · {spec.pearls}◆ to
            serve · {spec.baseCoins}c base
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>In line now</Text>

        {queue.length === 0 ? (
          // Not an error and not empty state furniture — an empty counter is
          // most of the day. It says which half of the panel is asleep.
          <Text style={styles.quiet}>
            Nobody waiting. The payout depends on who walks in.
          </Text>
        ) : (
          queue.map((q) => (
            <QueueRow
              key={`${q.catId}-${q.place}`}
              drink={drink}
              catId={q.catId}
              bondXp={catStats[q.catId]?.bondXp ?? 0}
            />
          ))
        )}

        <View style={styles.rule} />

        <Text style={styles.section}>Who goes for it</Text>
        {fans.length === 0 ? (
          <Text style={styles.quiet}>Nobody in the roster favours this one.</Text>
        ) : (
          <View style={styles.fans}>
            {fans.map((cat) => {
              const owned = ownedCats.includes(cat.id);
              const aff = affinityFor(cat, drink);
              return (
                <View key={cat.id} style={styles.fan}>
                  <CatSprite catId={cat.id} size={22} locked={!owned} />
                  <Text style={[styles.fanName, !owned && styles.fanLocked]}>
                    {owned ? cat.name : '???'}
                  </Text>
                  <Text style={[styles.fanPips, pipStyle(aff)]}>
                    {AFFINITY_PIPS[aff]}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        {fans.some((c) => !ownedCats.includes(c.id)) && (
          <Text style={styles.footnote}>
            Faded cats are ones you haven&apos;t adopted yet.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

/** One waiting cat, and the arithmetic of handing it this cup. */
function QueueRow({
  drink,
  catId,
  bondXp,
}: {
  drink: DrinkId;
  catId: string;
  bondXp: number;
}) {
  const cat = getCat(catId);
  if (!cat) return null;

  const tip = bondTip(bondXp, cat.rarity);
  const out = serveOutcome(cat, drink, { bondTip: tip });
  const level = bondLevel(bondXp, cat.rarity);
  const mult = out.coins / DRINKS[drink].baseCoins;

  return (
    <View style={styles.row}>
      <CatSprite catId={catId} size={24} />

      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.catName} numberOfLines={1}>
            {cat.name}
          </Text>
          <Text style={[styles.pips, pipStyle(out.affinity)]}>
            {AFFINITY_PIPS[out.affinity]}
          </Text>
          <Text style={styles.affLabel}>{AFFINITY_LABEL[out.affinity]}</Text>
        </View>

        {/* The multipliers, in the order serveOutcome applies them. A dislike
            shows x0.5 rather than being hidden — losing money on a bad match is
            the lesson, and a menu that only prints good news never teaches it. */}
        <Text style={styles.math}>
          {DRINKS[drink].baseCoins} base × {AFFINITY_MULT[out.affinity]} taste
          {tip > 0 ? ` × ${(1 + tip).toFixed(2)} bond L${level}` : ''}
        </Text>
      </View>

      <View style={styles.payout}>
        <Text style={[styles.coins, out.affinity === 'dislikes' && styles.coinsBad]}>
          {out.coins}c
        </Text>
        <Text style={styles.xp}>+{out.xp} xp</Text>
      </View>
    </View>
  );
}

/**
 * `AFFINITY_COINS` as the row prints it.
 *
 * Formatted rather than computed so 2 reads as "2.0" beside "1.4" and the
 * column of multipliers lines up down the panel.
 */
const AFFINITY_MULT: Record<Affinity, string> = {
  favorite: AFFINITY_COINS.favorite.toFixed(1),
  likes: AFFINITY_COINS.likes.toFixed(1),
  fine: AFFINITY_COINS.fine.toFixed(1),
  dislikes: AFFINITY_COINS.dislikes.toFixed(1),
};

function pipStyle(a: Affinity) {
  if (a === 'favorite') return styles.pipLove;
  if (a === 'likes') return styles.pipLike;
  if (a === 'dislikes') return styles.pipBad;
  return styles.pipFine;
}

const INK = '#4E3226';
const DIM = '#8F7C72';

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF7EC',
    borderWidth: 2,
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 2,
  },
  headerText: { flex: 1, gap: 1 },
  name: { fontSize: 14, fontWeight: '800', color: INK },
  meta: { fontSize: 9, fontWeight: '700', color: DIM },
  rarity: { textTransform: 'capitalize' },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },

  section: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8A5A33',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  quiet: { fontSize: 10, color: DIM, fontStyle: 'italic', paddingVertical: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rowText: { flex: 1, gap: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  catName: { fontSize: 11, fontWeight: '800', color: INK, maxWidth: 84 },
  affLabel: { fontSize: 9, fontWeight: '700', color: DIM },
  math: { fontSize: 9, color: DIM, fontVariant: ['tabular-nums'] },

  payout: { alignItems: 'flex-end' },
  coins: { fontSize: 13, fontWeight: '800', color: '#7A5418' },
  coinsBad: { color: '#C0564E' },
  xp: { fontSize: 8, fontWeight: '700', color: '#4C3A7A' },

  pips: { fontSize: 10, fontWeight: '800' },
  fanPips: { fontSize: 7, fontWeight: '800' },
  pipLove: { color: '#D87E97' },
  pipLike: { color: '#C89BB0' },
  pipFine: { color: '#B9AFA6' },
  pipBad: { color: '#C0564E' },

  rule: { height: 2, backgroundColor: '#EADCC9', marginVertical: 9 },

  fans: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 6 },
  fan: { alignItems: 'center', width: 46 },
  fanName: { fontSize: 8, fontWeight: '700', color: '#7B5240' },
  fanLocked: { color: '#B9AFA6' },

  footnote: { fontSize: 8, color: '#B9AFA6', marginTop: 8 },
});

export default DrinkDetail;
