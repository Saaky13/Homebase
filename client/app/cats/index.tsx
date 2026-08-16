import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AdoptionReveal from '../../components/AdoptionReveal';
import GachaMachine, { type GachaMachineHandle } from '../../components/GachaMachine';
import { CatSprite } from '../../components/CatSprite';
import { CoinIcon } from '../../components/Icons';
import {
  CAT_ROSTER,
  RARITY_ORDER,
  RARITY_STYLE,
  catsByRarity,
  type CatSpec,
} from '../../constants/catSprites';
import { CAPSULE_KEYS } from '../../constants/gachaMachine';
import {
  PULL_COST_COINS,
  RARITY_WEIGHTS,
  TOTAL_CATS,
  catsOwnedByRarity,
} from '../../constants/gacha';
import { colors } from '../../constants/colors';
import { useCafeState } from '../../hooks/useCafeState';

type Tab = 'adopt' | 'collection';

const TOTAL_WEIGHT = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);

export default function CatsTab() {
  const { state, adoptCat, setRevealActive, setGuideContext } = useCafeState();

  const [tab, setTab] = useState<Tab>('adopt');
  const [spinning, setSpinning] = useState(false);
  const [capsuleKey, setCapsuleKey] = useState(CAPSULE_KEYS[0]);
  const [revealed, setRevealed] = useState<CatSpec | null>(null);
  const machineRef = useRef<GachaMachineHandle>(null);

  useEffect(() => {
    setGuideContext(`cats:${tab}`);
  }, [tab, setGuideContext]);

  const owned = useMemo(() => new Set(state.ownedCats), [state.ownedCats]);

  const ownedCount = useMemo(
    () => CAT_ROSTER.filter((cat) => owned.has(cat.id)).length,
    [owned]
  );

  const byRarity = useMemo(
    () => catsOwnedByRarity(state.ownedCats),
    [state.ownedCats]
  );

  const remaining = TOTAL_CATS - ownedCount;
  const canAfford = state.coins >= PULL_COST_COINS;
  const canAdopt = canAfford && remaining > 0 && !spinning;

  const startAdoption = useCallback(() => {
    if (spinning) return;

    const result = adoptCat();
    if (!result.ok) return;

    // The cat is captured in this closure rather than in state, so the reveal
    // opens on exactly the cat this turn of the crank produced.
    const { cat } = result;

    setCapsuleKey(CAPSULE_KEYS[Math.floor(Math.random() * CAPSULE_KEYS.length)]);
    setSpinning(true);
    setRevealActive(true);

    machineRef.current?.play(() => {
      setSpinning(false);
      setRevealed(cat);
    });
  }, [adoptCat, spinning, setRevealActive]);

  const closeReveal = useCallback(() => {
    setRevealed(null);
    setRevealActive(false);
  }, [setRevealActive]);

  const adoptAgain = useCallback(() => {
    setRevealed(null);
    // Let the reveal's exit animation get going before the crank starts.
    setTimeout(startAdoption, 180);
  }, [startAdoption]);

  const renderAdopt = () => (
    <>
      <View style={styles.machineStage}>
        <GachaMachine ref={machineRef} capsuleKey={capsuleKey} />
      </View>

      {remaining > 0 ? (
        <Pressable
          onPress={startAdoption}
          disabled={!canAdopt}
          style={({ pressed }) => [
            styles.adoptButton,
            !canAdopt && styles.adoptButtonDisabled,
            pressed && canAdopt && styles.pressed,
          ]}
        >
          <Text style={styles.adoptText}>
            {spinning ? 'Turning…' : 'Turn the crank'}
          </Text>
          <View style={styles.costPill}>
            <CoinIcon size={13} />
            <Text style={styles.costText}>{PULL_COST_COINS}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Every cat has a home</Text>
          <Text style={styles.completeBody}>
            All {TOTAL_CATS} of them are out there in town. Nothing left to adopt.
          </Text>
        </View>
      )}

      {remaining > 0 && !canAfford && (
        <Text style={styles.hint}>
          You have {state.coins} coins. Serve cats in the café to earn more.
        </Text>
      )}

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {ownedCount}/{TOTAL_CATS} adopted
        </Text>
        <Text style={styles.countText}>{remaining} still out there</Text>
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
          You never get a duplicate — a rarity&apos;s share is shared out among the
          others once you&apos;ve collected them all.
        </Text>
      </View>
    </>
  );

  const renderCollection = () => (
    <>
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
                  <View
                    key={cat.id}
                    style={[
                      styles.card,
                      isOwned
                        ? { backgroundColor: style.tint, borderColor: style.ring }
                        : styles.cardLocked,
                    ]}
                  >
                    <CatSprite catId={cat.id} size={44} locked={!isOwned} />
                    <Text
                      style={[styles.catName, !isOwned && styles.catNameLocked]}
                      numberOfLines={1}
                    >
                      {isOwned ? cat.name : '???'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>YOUR COLLECTION</Text>
          <Text style={styles.heroCount}>
            {ownedCount}
            <Text style={styles.heroTotal}> / {TOTAL_CATS}</Text>
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((ownedCount / TOTAL_CATS) * 100)}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.tabs}>
          {(['adopt', 'collection'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'adopt' ? 'Adopt' : 'Collection'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'adopt' ? renderAdopt() : renderCollection()}

        <View style={{ height: 30 }} />
      </ScrollView>

      <AdoptionReveal
        cat={revealed}
        coins={state.coins}
        remaining={remaining}
        onClose={closeReveal}
        onAdoptAgain={adoptAgain}
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
  heroCount: { fontSize: 40, fontWeight: '900', color: colors.brown900, marginTop: 2 },
  heroTotal: { fontSize: 20, fontWeight: '800', color: colors.brown300 },
  progressTrack: {
    height: 8,
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.gold },

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

  section: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  rarityDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.brown900, flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: colors.mediumGray },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '30.9%',
    minHeight: 104,
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
});
