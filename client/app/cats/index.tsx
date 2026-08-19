import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AdoptionReveal from '../../components/AdoptionReveal';
import CatAlmanacSheet from '../../components/CatAlmanacSheet';
import GachaMachine, { type GachaMachineHandle } from '../../components/GachaMachine';
import { CatSprite } from '../../components/CatSprite';
import { CupSprite } from '../../components/CupSprite';
import { CoinIcon } from '../../components/Icons';
import {
  CAT_ROSTER,
  RARITY_ORDER,
  RARITY_STYLE,
  catsByRarity,
  type CatSpec,
  type Rarity,
} from '../../constants/catSprites';
import { CAPSULE_KEYS } from '../../constants/gachaMachine';
import {
  RARITY_WEIGHTS,
  TOTAL_CATS,
  TOTAL_RECIPES,
  catsOwnedByRarity,
  pullCost,
  recipesOwnedByRarity,
  type Prize,
} from '../../constants/gacha';
import { colors } from '../../constants/colors';
import {
  DRINKS,
  DRINK_FRAME,
  DRINK_ORDER,
  drinksByRarity,
} from '../../constants/drinks';
import { catsFavoring, catsLiking, preferencesFor } from '../../constants/affinity';
import { totalServed } from '../../constants/catLore';
import { useCafeState } from '../../hooks/useCafeState';

type Tab = 'adopt' | 'collection' | 'almanac';

const TAB_LABEL: Record<Tab, string> = {
  adopt: 'Machine',
  collection: 'Collection',
  almanac: 'Almanac',
};

const TOTAL_WEIGHT = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);

export default function CatsTab() {
  const { state, pullPrize, setRevealActive, setGuideContext } = useCafeState();

  const [tab, setTab] = useState<Tab>('adopt');
  const [spinning, setSpinning] = useState(false);
  const [capsuleKey, setCapsuleKey] = useState(CAPSULE_KEYS[0]);
  const [revealed, setRevealed] = useState<Prize | null>(null);
  const [entry, setEntry] = useState<CatSpec | null>(null);
  const [almanacView, setAlmanacView] = useState<'cats' | 'drinks'>('cats');
  const machineRef = useRef<GachaMachineHandle>(null);
  const catButtonScale = useRef(new Animated.Value(1)).current;
  const drinkButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setGuideContext(`cats:${tab}`);
  }, [tab, setGuideContext]);

  const handleAlmanacButtonPress = (view: 'cats' | 'drinks') => {
    const scale = view === 'cats' ? catButtonScale : drinkButtonScale;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    setAlmanacView(view);
  };

  const owned = useMemo(() => new Set(state.ownedCats), [state.ownedCats]);
  const recipes = useMemo(
    () => new Set(state.recipes ?? []),
    [state.recipes]
  );

  const ownedCount = useMemo(
    () => CAT_ROSTER.filter((cat) => owned.has(cat.id)).length,
    [owned]
  );
  const recipeCount = useMemo(
    () => DRINK_ORDER.filter((id) => recipes.has(id)).length,
    [recipes]
  );

  const catsByRarityOwned = useMemo(
    () => catsOwnedByRarity(state.ownedCats),
    [state.ownedCats]
  );
  const recipesByRarityOwned = useMemo(
    () => recipesOwnedByRarity(state.recipes ?? []),
    [state.recipes]
  );

  const catsLeft = TOTAL_CATS - ownedCount;
  const recipesLeft = TOTAL_RECIPES - recipeCount;
  const remaining = catsLeft + recipesLeft;

  // The odds board counts both halves together, because one capsule can hold
  // either. Splitting them would describe two draws that don't exist.
  const byRarity = useMemo(() => {
    return RARITY_ORDER.reduce((acc, rarity) => {
      const cats = catsByRarityOwned[rarity];
      const drinks = recipesByRarityOwned[rarity];
      acc[rarity] = {
        owned: cats.owned + drinks.owned,
        total: cats.total + drinks.total,
      };
      return acc;
    }, {} as Record<Rarity, { owned: number; total: number }>);
  }, [catsByRarityOwned, recipesByRarityOwned]);

  // Climbs with the collection, so it's read fresh on every render rather
  // than being a constant.
  const cost = pullCost(ownedCount, recipeCount);
  const canAfford = state.coins >= cost;
  const canPull = canAfford && remaining > 0 && !spinning;

  const startPull = useCallback(() => {
    if (spinning) return;

    const result = pullPrize();
    if (!result.ok) return;

    // The prize is captured in this closure rather than in state, so the
    // reveal opens on exactly what this turn of the crank produced.
    const { prize } = result;

    setCapsuleKey(CAPSULE_KEYS[Math.floor(Math.random() * CAPSULE_KEYS.length)]);
    setSpinning(true);
    setRevealActive(true);

    machineRef.current?.play(() => {
      setSpinning(false);
      setRevealed(prize);
    });
  }, [pullPrize, spinning, setRevealActive]);

  const closeReveal = useCallback(() => {
    setRevealed(null);
    setRevealActive(false);
  }, [setRevealActive]);

  const pullAgain = useCallback(() => {
    setRevealed(null);
    // Let the reveal's exit animation get going before the crank starts.
    setTimeout(startPull, 180);
  }, [startPull]);

  const renderAdopt = () => (
    <>
      <View style={styles.machineStage}>
        <GachaMachine ref={machineRef} capsuleKey={capsuleKey} />
      </View>

      {remaining > 0 ? (
        <Pressable
          onPress={startPull}
          disabled={!canPull}
          style={({ pressed }) => [
            styles.adoptButton,
            !canPull && styles.adoptButtonDisabled,
            pressed && canPull && styles.pressed,
          ]}
        >
          <Text style={styles.adoptText}>
            {spinning ? 'Turning…' : 'Turn the crank'}
          </Text>
          <View style={styles.costPill}>
            <CoinIcon size={13} />
            <Text style={styles.costText}>{cost}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Nothing left in the machine</Text>
          <Text style={styles.completeBody}>
            All {TOTAL_CATS} cats are out there in town and all {TOTAL_RECIPES}{' '}
            recipes are on the board. Every cat has something it loves.
          </Text>
        </View>
      )}

      {remaining > 0 && !canAfford && (
        <Text style={styles.hint}>
          {cost} coins for the next one — you have {state.coins}. Serve cats in
          the café to earn more.
        </Text>
      )}

      {/* What's actually in the capsule. Shown as live odds rather than a fixed
          split because it is one: the half you've collected less of is the half
          more likely to come out, so both run dry at about the same time. */}
      {remaining > 0 && (
        <View style={styles.capsuleRow}>
          <View style={styles.capsuleHalf}>
            <Text style={styles.capsulePct}>
              {Math.round((catsLeft / remaining) * 100)}%
            </Text>
            <Text style={styles.capsuleLabel}>
              a cat · {catsLeft} left
            </Text>
          </View>
          <View style={styles.capsuleDivider} />
          <View style={styles.capsuleHalf}>
            <Text style={styles.capsulePct}>
              {Math.round((recipesLeft / remaining) * 100)}%
            </Text>
            <Text style={styles.capsuleLabel}>
              a recipe · {recipesLeft} left
            </Text>
          </View>
        </View>
      )}

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {ownedCount}/{TOTAL_CATS} cats · {recipeCount}/{TOTAL_RECIPES} recipes
        </Text>
        <Text style={styles.countText}>{remaining} still in there</Text>
      </View>

      <View style={styles.oddsCard}>
        <Text style={styles.oddsTitle}>Odds</Text>
        {RARITY_ORDER.map((rarity) => {
          const style = RARITY_STYLE[rarity];
          const pct = (RARITY_WEIGHTS[rarity] / TOTAL_WEIGHT) * 100;
          const left = byRarity[rarity].total - byRarity[rarity].owned;

          return (
            <View key={rarity} style={styles.oddsRow}>
              <View style={[styles.rarityDot, { backgroundColor: style.ring }]} />
              <Text style={styles.oddsLabel}>{style.label}</Text>
              <Text style={styles.oddsLeft}>{left ? `${left} left` : 'complete'}</Text>
              <Text style={styles.oddsPct}>{pct % 1 === 0 ? pct : pct.toFixed(1)}%</Text>
            </View>
          );
        })}
        <Text style={styles.oddsFootnote}>
          Cats and recipes share one rarity roll, so a legendary recipe is
          exactly as hard-won as a legendary cat. You never get a duplicate — a
          rarity&apos;s share is shared out among the others once you&apos;ve
          collected them all.
        </Text>
      </View>
    </>
  );

  /** What you own. Your relationship with them, not the catalogue. */
  const renderCollection = () => {
    const mine = CAT_ROSTER.filter((cat) => owned.has(cat.id));

    return (
      <>
        <Text style={styles.almanacHint}>
          {mine.length} cat{mine.length === 1 ? '' : 's'} live here. Tap one to
          open its entry.
        </Text>

        {RARITY_ORDER.map((rarity) => {
          const style = RARITY_STYLE[rarity];
          const cats = catsByRarity(rarity).filter((cat) => owned.has(cat.id));
          if (!cats.length) return null;

          return (
            <View key={rarity} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.rarityDot, { backgroundColor: style.ring }]} />
                <Text style={styles.sectionTitle}>{style.label}</Text>
                <Text style={styles.sectionCount}>
                  {catsByRarityOwned[rarity].owned}/
                  {catsByRarityOwned[rarity].total}
                </Text>
              </View>

              <View style={styles.grid}>
                {cats.map((cat) => {
                  const served = totalServed(state.catStats?.[cat.id]);
                  const loves = preferencesFor(cat).favorite;

                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setEntry(cat)}
                      style={({ pressed }) => [
                        styles.card,
                        { backgroundColor: style.tint, borderColor: style.ring },
                        pressed && styles.pressed,
                      ]}
                    >
                      <CatSprite catId={cat.id} size={44} />
                      <Text style={styles.catName} numberOfLines={1}>
                        {cat.name}
                      </Text>

                      {/* What it drinks, at a glance. Once serving pays by
                          affinity this is the fact you actually came here for. */}
                      <View style={styles.lovesChip}>
                        <CupSprite drink={loves} width={13} />
                        <Text style={styles.lovesText} numberOfLines={1}>
                          {DRINKS[loves].short}
                        </Text>
                      </View>

                      <Text style={styles.catServed}>
                        {served ? `served ${served}` : 'not yet served'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* The other half of what you own. A cat and the drink it wants are
            the same fact from two directions, so the menu belongs on the same
            page as the cats rather than off in the shop. */}
        <View style={styles.drinkHeader}>
          <Text style={styles.drinkHeaderTitle}>Your menu</Text>
          <Text style={styles.sectionCount}>
            {recipeCount}/{TOTAL_RECIPES}
          </Text>
        </View>

        <View style={styles.grid}>
          {DRINK_ORDER.filter((id) => recipes.has(id)).map((id) => {
            const drink = DRINKS[id];
            const wanted = catsFavoring(id).filter((c) => owned.has(c.id));

            return (
              <View
                key={id}
                style={[styles.card, { borderColor: DRINK_FRAME[drink.rarity] }]}
              >
                <CupSprite drink={id} width={30} />
                <Text style={styles.catName} numberOfLines={1}>
                  {drink.short}
                </Text>
                <View style={styles.lovesChip}>
                  <Text style={styles.lovesText} numberOfLines={1}>
                    {drink.pearls}◆ · {drink.baseCoins}c
                  </Text>
                </View>
                <Text style={styles.catServed}>
                  {wanted.length
                    ? wanted.length === 1
                      ? '1 cat loves it'
                      : `${wanted.length} cats love it`
                    : 'nobody home loves it'}
                </Text>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  /**
   * Everything that exists, owned or not — cats and drinks both.
   *
   * Deliberately more catalogue than tool. You are meant to scroll it, see a
   * cat you don't have, and want it.
   */
  const renderAlmanac = () => (
    <>
      {/* Almanac toggle buttons */}
      <View style={styles.almanacToggle}>
        <Animated.View
          style={[
            styles.almanacButtonContainer,
            { transform: [{ scale: catButtonScale }] },
          ]}
        >
          <Pressable
            onPress={() => handleAlmanacButtonPress('cats')}
            style={[
              styles.almanacButton,
              almanacView === 'cats' && styles.almanacButtonActive,
            ]}
          >
            <Text
              style={[
                styles.almanacButtonText,
                almanacView === 'cats' && styles.almanacButtonTextActive,
              ]}
            >
              Cats
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.almanacButtonContainer,
            { transform: [{ scale: drinkButtonScale }] },
          ]}
        >
          <Pressable
            onPress={() => handleAlmanacButtonPress('drinks')}
            style={[
              styles.almanacButton,
              almanacView === 'drinks' && styles.almanacButtonActive,
            ]}
          >
            <Text
              style={[
                styles.almanacButtonText,
                almanacView === 'drinks' && styles.almanacButtonTextActive,
              ]}
            >
              Recipes
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {almanacView === 'cats' ? (
        <>
          <Text style={styles.almanacHint}>
            Every cat in the game. Tap a cat for its entry.
          </Text>

          {RARITY_ORDER.map((rarity) => {
            const style = RARITY_STYLE[rarity];
            const progress = byRarity[rarity];

            return (
              <View key={rarity} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.rarityDot, { backgroundColor: style.ring }]} />
                  <Text style={styles.sectionTitle}>{style.label}</Text>
                  <Text style={styles.sectionCount}>
                    {progress.owned}/{progress.total}
                  </Text>
                </View>

                <View style={styles.grid}>
                  {catsByRarity(rarity).map((cat) => {
                    const isOwned = owned.has(cat.id);

                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setEntry(cat)}
                        style={({ pressed }) => [
                          styles.card,
                          isOwned
                            ? { backgroundColor: style.tint, borderColor: style.ring }
                            : styles.cardLocked,
                          pressed && styles.pressed,
                        ]}
                      >
                        <CatSprite catId={cat.id} size={44} locked={!isOwned} />
                        <Text
                          style={[styles.catName, !isOwned && styles.catNameLocked]}
                          numberOfLines={1}
                        >
                          {isOwned ? cat.name : '???'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <>
          <Text style={styles.almanacHint}>
            Every drink in the game. Tap one to see which cats will take it.
          </Text>

          {RARITY_ORDER.map((rarity) => {
            const menu = drinksByRarity(rarity);
            if (!menu.length) return null;
            const progress = recipesByRarityOwned[rarity];

            return (
              <View key={rarity} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[styles.rarityDot, { backgroundColor: DRINK_FRAME[rarity] }]}
                  />
                  <Text style={styles.sectionTitle}>
                    {RARITY_STYLE[rarity].label}
                  </Text>
                  <Text style={styles.sectionCount}>
                    {progress.owned}/{progress.total}
                  </Text>
                </View>

                {menu.map((drink) => {
                  const known = recipes.has(drink.id);
                  // Everyone who'll happily take it, not just the handful who
                  // rank it first — a drink entry should read as a crowd.
                  const lovers = catsLiking(drink.id);

                  return (
                    <View
                      key={drink.id}
                      style={[
                        styles.drinkRow,
                        { borderColor: DRINK_FRAME[drink.rarity] },
                        !known && styles.drinkRowLocked,
                      ]}
                    >
                      {/* The cup still draws when it's locked. A silhouette would
                          hide the one thing that makes you want it — a recipe you
                          can't make yet is meant to be legible from across the
                          list, unlike a cat, whose sprite *is* the reward. */}
                      <CupSprite drink={drink.id} width={34} />

                      <View style={styles.drinkBody}>
                        <View style={styles.drinkTitleRow}>
                          <Text
                            style={[styles.drinkName, !known && styles.drinkNameLocked]}
                          >
                            {drink.name}
                          </Text>
                          {known ? (
                            <View
                              style={[
                                styles.drinkRarity,
                                { backgroundColor: DRINK_FRAME[drink.rarity] },
                              ]}
                            >
                              <Text style={styles.drinkRarityText}>ON MENU</Text>
                            </View>
                          ) : (
                            <View style={[styles.drinkRarity, styles.drinkRarityLocked]}>
                              <Text style={styles.drinkRarityLockedText}>LOCKED</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.drinkNote}>{drink.note}</Text>

                        <View style={styles.drinkStats}>
                          <Text style={styles.drinkCost}>{drink.pearls} pearls</Text>
                          <Text style={styles.drinkCoins}>{drink.baseCoins} coins</Text>
                        </View>

                        {lovers.length > 0 && (
                          <View style={styles.loverRow}>
                            {lovers.map((cat) => (
                              <View key={cat.id} style={styles.lover}>
                                <CatSprite
                                  catId={cat.id}
                                  size={26}
                                  locked={!owned.has(cat.id)}
                                />
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>YOUR COLLECTION</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroHalf}>
              <Text style={styles.heroCount}>
                {ownedCount}
                <Text style={styles.heroTotal}> / {TOTAL_CATS}</Text>
              </Text>
              <Text style={styles.heroCaption}>cats</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round((ownedCount / TOTAL_CATS) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.heroHalf}>
              <Text style={styles.heroCount}>
                {recipeCount}
                <Text style={styles.heroTotal}> / {TOTAL_RECIPES}</Text>
              </Text>
              <Text style={styles.heroCaption}>recipes</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    styles.progressFillRecipes,
                    { width: `${Math.round((recipeCount / TOTAL_RECIPES) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['adopt', 'collection', 'almanac'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {TAB_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'adopt'
          ? renderAdopt()
          : tab === 'collection'
            ? renderCollection()
            : renderAlmanac()}

        <View style={{ height: 30 }} />
      </ScrollView>

      <CatAlmanacSheet
        cat={entry}
        owned={entry ? owned.has(entry.id) : false}
        stat={entry ? state.catStats?.[entry.id] : null}
        ownedIds={state.ownedCats}
        recipes={state.recipes ?? []}
        onClose={() => setEntry(null)}
      />

      <AdoptionReveal
        prize={revealed}
        ownedCats={state.ownedCats}
        recipes={state.recipes ?? []}
        coins={state.coins}
        cost={cost}
        remaining={remaining}
        onClose={closeReveal}
        onAgain={pullAgain}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scrollView: { flex: 1, paddingHorizontal: 16 },

  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: colors.warmTan,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 12,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.mediumGray,
  },
  heroRow: { flexDirection: 'row', gap: 18, width: '100%', marginTop: 2 },
  heroHalf: { flex: 1, alignItems: 'center' },
  heroCount: { fontSize: 32, fontWeight: '900', color: colors.brown900 },
  heroTotal: { fontSize: 17, fontWeight: '800', color: colors.brown300 },
  heroCaption: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.mediumGray,
    marginTop: -2,
  },
  progressTrack: {
    height: 8,
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.gold },
  // The menu reads as its own track rather than more of the same gold bar —
  // two identical bars side by side is one bar cut in half.
  progressFillRecipes: { backgroundColor: colors.accentTeal },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
    backgroundColor: colors.lightGray,
    borderRadius: 14,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  almanacToggle: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  almanacButtonContainer: { flex: 1 },
  almanacButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1.2,
    borderColor: colors.warmTan,
    shadowColor: colors.brown300,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  almanacButtonActive: {
    backgroundColor: colors.accentBlush,
    borderColor: '#B45C7A',
    shadowColor: '#B45C7A',
  },
  almanacButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.mediumGray,
    letterSpacing: 0.4,
  },
  almanacButtonTextActive: { color: colors.white },
  almanacHint: {
    fontSize: 12,
    color: colors.mediumGray,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 2,
    textAlign: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.mediumGray },
  tabTextActive: { color: colors.brown900 },

  machineStage: { alignItems: 'center', marginBottom: 18 },

  adoptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accentBlush,
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#B45C7A',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
  },
  adoptButtonDisabled: { backgroundColor: '#D9C7CE', shadowOpacity: 0 },
  adoptText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  costPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  costText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  pressed: { opacity: 0.85 },
  hint: {
    fontSize: 12,
    color: colors.mediumGray,
    textAlign: 'center',
    marginTop: 10,
  },

  completeCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: colors.warmTan,
    padding: 18,
    alignItems: 'center',
  },
  completeTitle: { fontSize: 17, fontWeight: '900', color: colors.brown900 },
  completeBody: {
    fontSize: 13,
    color: colors.brown700,
    textAlign: 'center',
    marginTop: 6,
  },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 16,
  },
  countText: { fontSize: 12, fontWeight: '700', color: colors.mediumGray },

  oddsCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: colors.warmTan,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  oddsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.brown900,
    marginBottom: 8,
  },
  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  oddsLabel: { fontSize: 13, fontWeight: '700', color: colors.brown700, flex: 1 },
  oddsLeft: { fontSize: 11, fontWeight: '700', color: colors.brown300 },
  oddsPct: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brown900,
    width: 46,
    textAlign: 'right',
  },
  oddsFootnote: {
    fontSize: 11,
    color: colors.mediumGray,
    marginTop: 10,
    lineHeight: 15,
  },

  capsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 12,
    marginTop: 8,
  },
  capsuleHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  capsulePct: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.brown900,
  },
  capsuleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brown700,
    marginTop: 2,
  },
  capsuleDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.lightGray,
    marginHorizontal: 8,
  },

  section: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  rarityDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.brown900, flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: colors.mediumGray },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '30.9%',
    minHeight: 124,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardLocked: { backgroundColor: '#F6F2EE', borderColor: '#E6DDD4' },
  catName: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brown900,
    textAlign: 'center',
  },
  catNameLocked: { color: '#B6ABA1', letterSpacing: 1 },
  catNameLocked2: { color: '#B6ABA1', letterSpacing: 1 },

  /* -------------------------- collection extras ------------------------- */

  lovesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  lovesText: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '800',
    color: colors.brown700,
  },
  catServed: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.mediumGray,
    textAlign: 'center',
  },

  /* ------------------------------ the menu ------------------------------ */

  drinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 2,
    paddingTop: 18,
    borderTopWidth: 1.5,
    borderTopColor: '#EADFD3',
  },
  drinkHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.brown900,
    letterSpacing: 0.3,
  },
  drinkRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  drinkBody: { flex: 1, gap: 5 },
  drinkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  drinkName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: colors.brown900,
  },
  // Locked is a lighter ground and a duller frame, not a hidden one — the
  // recipe stays fully readable, because wanting it is the point.
  drinkRowLocked: { backgroundColor: colors.lightGray, opacity: 0.72 },
  drinkNameLocked: { color: colors.brown500 },
  drinkRarity: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  drinkRarityLocked: { backgroundColor: colors.warmTan },
  drinkRarityLockedText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.brown700,
  },
  drinkRarityText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4E3226',
    letterSpacing: 0.4,
  },
  drinkNote: { fontSize: 11, lineHeight: 15, color: colors.mediumGray },
  drinkStats: { flexDirection: 'row', gap: 12, marginTop: 1 },
  drinkCost: { fontSize: 11, fontWeight: '800', color: '#7A5AA8' },
  drinkCoins: { fontSize: 11, fontWeight: '800', color: '#9A7420' },
  loverRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  lover: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
