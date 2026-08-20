import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatSprite } from './CatSprite';
import { CupSprite } from './CupSprite';
import { preferencesFor } from '../constants/affinity';
import { CUP_PALETTES, DRINKS, DRINK_FRAME, type DrinkId } from '../constants/drinks';
import { RARITY_STYLE, type CatSpec } from '../constants/catSprites';
import { STARTER_CATS } from '../constants/gacha';
import { BOND_TIP, MAX_BOND_LEVEL, bondProgress, tipLabel } from '../constants/bonds';
import {
  DAY_PART_LABEL,
  catBio,
  catObservations,
  favouredPart,
  liveOdds,
  baselineOdds,
  oddsLabel,
  totalServed,
  type CatStat,
} from '../constants/catLore';
import { colors } from '../constants/colors';

/**
 * One almanac entry: everything the app can say about a single cat.
 *
 * Nothing here is authored per-cat. The prose comes from `catBio`, the taste
 * from `preferencesFor`, the tallies from the player's own `CatStat` — this
 * file only decides what a fact looks like once it exists. Adding a cat to the
 * roster therefore adds a complete entry with no work here at all.
 *
 * A locked cat gets the silhouette, its rarity, its odds and the one drink it
 * loves. That last one is given away on purpose: the almanac's job is to make
 * you want a cat, and "this one drinks Aurora Fizz" does that better than
 * another row of question marks.
 */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * One drink on an entry. The almanac states preferences outright — there is no
 * testing, no unlocking, nothing to discover. It is a catalogue you browse to
 * decide what you want, not a puzzle you solve.
 */
function DrinkLine({
  drink,
  tone,
  onMenu,
}: {
  drink: DrinkId;
  tone: 'favorite' | 'likes';
  /** Whether the player can actually brew it. Undefined leaves it unsaid. */
  onMenu?: boolean;
}) {
  const spec = DRINKS[drink];
  const favorite = tone === 'favorite';

  return (
    <View
      style={[
        styles.drinkLine,
        favorite && {
          backgroundColor: CUP_PALETTES[drink].l,
          borderColor: DRINK_FRAME[spec.rarity],
        },
      ]}
    >
      <CupSprite drink={drink} width={favorite ? 30 : 24} />
      <View style={styles.drinkLineBody}>
        <Text style={[styles.drinkLineLabel, favorite && styles.drinkLineLabelHero]}>
          {favorite ? 'LOVES' : 'LIKES'}
        </Text>
        <Text style={styles.drinkLineName}>{spec.name}</Text>
        {/* The one place the two collections meet: knowing what a cat wants is
            worth nothing until the recipe is on your board, and this is where
            you find out it isn't. */}
        {onMenu === false && (
          <Text style={styles.drinkLineMissing}>not on your menu yet</Text>
        )}
      </View>
      <View style={styles.drinkLinePrice}>
        <Text style={styles.drinkLinePearls}>{spec.pearls}◆</Text>
        <Text style={styles.drinkLineCoins}>{spec.baseCoins}c</Text>
      </View>
    </View>
  );
}

/**
 * The relationship, given the space the card can't spare.
 *
 * The inspect card compresses this to one line; here it gets the headline
 * treatment, because the almanac is where you come to ask "how far along am I
 * with this cat" rather than "what do I pour it right now". `bonds.ts` derives
 * every number below from the single stored XP total.
 */
function BondCard({ cat, xp }: { cat: CatSpec; xp: number }) {
  const bond = bondProgress(xp, cat.rarity);
  const tip = BOND_TIP[bond.level] ?? 0;

  return (
    <Card title="Bond">
      <View style={styles.bondHead}>
        <Text style={styles.bondLevel}>
          Level {bond.level}
          <Text style={styles.bondOf}> of {MAX_BOND_LEVEL}</Text>
        </Text>
        <Text style={styles.bondTip}>
          {tip > 0 ? `${tipLabel(bond.level)} coins` : 'No tip yet'}
        </Text>
      </View>

      <View style={styles.bondTrack}>
        <View style={[styles.bondFill, { width: `${Math.round(bond.fraction * 100)}%` }]} />
      </View>

      <Text style={styles.bondFoot}>
        {bond.maxed
          ? `Fully bonded — ${xp} XP poured into this one.`
          : `${bond.into} / ${bond.span} XP toward Level ${bond.level + 1}.`}
      </Text>

      {/* The one sentence that tells you how to move the bar. Serving a cat
          something it won't drink pays no XP at all, which is not guessable
          from a bar that only ever goes up. */}
      <Text style={styles.bondHint}>
        Earned by serving. A favourite pours three times the XP of a drink it
        merely tolerates; something it won&apos;t drink pours none.
      </Text>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function CatAlmanacSheet({
  cat,
  owned,
  stat,
  ownedIds,
  recipes,
  onClose,
}: {
  cat: CatSpec | null;
  owned: boolean;
  stat?: CatStat | null;
  ownedIds: string[];
  /** The player's menu, so an entry can say whether it can be brewed. */
  recipes: DrinkId[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  const rarity = cat ? RARITY_STYLE[cat.rarity] : null;
  const prefs = cat ? preferencesFor(cat) : null;

  const served = totalServed(stat);
  const part = favouredPart(stat);

  // No date means one of two different things, and guessing wrong on either
  // reads as a bug: the starters genuinely were never adopted, while anyone
  // else without a date was adopted before the almanac started keeping one.
  const arrival = stat?.adoptedOn
    ? stat.adoptedOn
    : cat && STARTER_CATS.includes(cat.id)
      ? 'Came with the café'
      : 'Not recorded';

  // An owned cat can't be drawn again, so its live odds are zero and the
  // baseline is the honest number to quote. A locked one wants the live odds,
  // which drift upward as the rest of its rarity gets adopted.
  const odds = useMemo(() => {
    if (!cat) return 0;
    return owned ? baselineOdds(cat.rarity) : liveOdds(ownedIds, cat.id);
  }, [cat, owned, ownedIds]);

  if (!cat || !rarity) return null;

  return (
    <View style={styles.scrim}>
      {/* Tapping the backdrop dismisses, the way the rest of the app lets you
          out of things without hunting for a button. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.grabber} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.hero, { backgroundColor: rarity.tint, borderColor: rarity.ring }]}>
              <CatSprite catId={cat.id} size={112} locked={!owned} />
              <Text style={styles.name}>{owned ? cat.name : '???'}</Text>
              <View style={[styles.rarityChip, { backgroundColor: rarity.ring }]}>
                <Text style={styles.rarityText}>{rarity.label}</Text>
              </View>
            </View>

            {owned ? (
              <>
                <Text style={styles.bio}>{catBio(cat, stat)}</Text>

                <Card title="Taste">
                  <DrinkLine
                    drink={prefs!.favorite}
                    tone="favorite"
                    onMenu={recipes.includes(prefs!.favorite)}
                  />
                  {prefs!.likes.map((id) => (
                    <DrinkLine key={id} drink={id} tone="likes" />
                  ))}
                  {prefs!.dislikes.length > 0 && (
                    <Text style={styles.dislikeLine}>
                      Turns its nose up at{' '}
                      {prefs!.dislikes.map((id) => DRINKS[id].name).join(', ')}.
                    </Text>
                  )}
                </Card>

                <Card title="Observations">
                  {catObservations(cat).map((o) => (
                    <Row key={o.label} label={o.label} value={o.value} />
                  ))}
                </Card>

                <BondCard cat={cat} xp={stat?.bondXp ?? 0} />

                <Card title="Your record">
                  <Row label="Adopted" value={arrival} />
                  <Row
                    label="Cups poured"
                    value={served === 0 ? 'None yet' : String(served)}
                  />
                  {served > 0 && (
                    <Row
                      label="First served"
                      value={stat?.firstServedOn ?? '—'}
                    />
                  )}
                  <Row
                    label="Usually served"
                    value={part ? `In ${DAY_PART_LABEL[part]}` : 'Still working it out'}
                  />
                  <Row label="Draw chance" value={oddsLabel(odds)} />
                </Card>
              </>
            ) : (
              <>
                <Text style={styles.bio}>
                  This one hasn&apos;t been to the shelter yet. What it drinks
                  is known; everything else — its name, its coat, its markings,
                  and every cup you pour it — fills itself in the moment you
                  bring it home.
                </Text>

                <Card title="What is known">
                  <Row label="Rarity" value={rarity.label} />
                  <Row label="Draw chance" value={oddsLabel(odds)} />
                </Card>

                {/* The one real fact a locked entry gives up. It is the whole
                    reason to scroll this tab: you see a drink you like the
                    look of, and now there is a specific cat you want. */}
                <Card title="Known to drink">
                  <DrinkLine
                    drink={prefs!.favorite}
                    tone="favorite"
                    onMenu={recipes.includes(prefs!.favorite)}
                  />
                </Card>
              </>
            )}
          </ScrollView>

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bondHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  bondLevel: { fontSize: 17, fontWeight: '900', color: colors.darkBrown },
  bondOf: { fontSize: 12, fontWeight: '700', color: colors.mediumGray },
  bondTip: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '900',
    color: colors.accentGold,
  },
  bondTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: colors.lightGray,
  },
  bondFill: { height: '100%', borderRadius: 5, backgroundColor: colors.lavender },
  bondFoot: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '700',
    color: colors.brown700,
  },
  bondHint: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: colors.mediumGray,
  },

  /**
   * An absolutely-positioned overlay rather than a <Modal>, which is what
   * AdoptionReveal does and for the same reason: React Native Web renders a
   * Modal into a container the app root has already given a containing block,
   * so its `position: fixed` resolves against that box and the sheet lands a
   * full viewport below the fold. Insetting to the screen sidesteps it, and
   * it is one less platform difference to reason about.
   *
   * Below AdoptionReveal's 300 — the two are never open together, but a
   * reveal must win if they ever are — and above GuideOverlay's 200.
   */
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(60,40,32,0.45)',
    zIndex: 250,
  },

  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.warmTan,
    marginTop: 10,
    marginBottom: 6,
  },

  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 12 },

  hero: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.4,
    paddingTop: 14,
    paddingBottom: 16,
    marginTop: 6,
  },
  name: { fontSize: 24, fontWeight: '900', color: colors.darkBrown, marginTop: 6 },
  rarityChip: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rarityText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.6 },

  bio: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.brown700,
    marginTop: 16,
    marginBottom: 4,
  },


  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: colors.warmTan,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.mediumGray,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 13, color: colors.mediumGray, fontWeight: '600' },
  rowValue: {
    fontSize: 13,
    color: colors.darkBrown,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },

  close: {
    backgroundColor: colors.brown700,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  closeText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  /* ------------------------------- taste -------------------------------- */

  drinkLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  drinkLineBody: { flex: 1, gap: 1 },
  drinkLineLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.mediumGray,
  },
  drinkLineLabelHero: { color: colors.brown700 },
  drinkLineName: { fontSize: 13, fontWeight: '800', color: colors.brown900 },
  drinkLineMissing: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.coral,
    marginTop: 1,
  },
  drinkLinePrice: { alignItems: 'flex-end', gap: 1 },
  drinkLinePearls: { fontSize: 11, fontWeight: '800', color: '#7A5AA8' },
  drinkLineCoins: { fontSize: 11, fontWeight: '800', color: '#9A7420' },
  dislikeLine: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.mediumGray,
    marginTop: 6,
    paddingHorizontal: 2,
  },
});
