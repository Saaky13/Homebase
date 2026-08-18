import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PLANT_ORDER, PLANT_SPECIES, type PlantSpec } from '../constants/plants';
import { CoinIcon } from './Icons';

/**
 * The seed rack.
 *
 * The café taught us the object you drag should live in the room you drag it
 * in. Seeds bought at the Market would mean Market → buy → navigate →
 * greenhouse → drag, which is three screens for a daily ritual, so the shop is
 * here on the potting bench instead. The Market keeps the one-off room
 * upgrades — benches, misting, lamps — which you buy once and never think
 * about again.
 *
 * Packets are plain views rather than sprites on purpose. The real plants are
 * on the benches a few pixels away; a second rendering path for tiny previews
 * would be one more thing to keep in sync, and a seed packet is a paper
 * rectangle in real life anyway.
 */

interface Props {
  coins: number;
  level: number;
  seeds: Record<string, number>;
  fertilizer: number;
  onBuy: (speciesId: string) => void;
  onSelect: (speciesId: string) => void;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Packet({
  spec, owned, locked, affordable, onBuy, onSelect,
}: {
  spec: PlantSpec;
  owned: number;
  locked: boolean;
  affordable: boolean;
  onBuy: () => void;
  onSelect: () => void;
}) {
  return (
    <View style={[styles.packet, locked && styles.packetLocked]}>
      {/* The two-colour band stands in for the plant — leaf green over its
          flower or accent, so species stay distinguishable at a glance. */}
      <View style={styles.swatch}>
        <View style={[styles.swatchHalf, { backgroundColor: spec.swatch[0] }]} />
        <View style={[styles.swatchHalf, { backgroundColor: spec.swatch[1] }]} />
      </View>

      <View style={styles.packetBody}>
        <View style={styles.packetHead}>
          <Text style={styles.packetName}>{spec.name}</Text>
          {owned > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Load a ${spec.name} seed into the pot`}
              onPress={onSelect}
              style={({ pressed }) => [styles.owned, pressed && styles.pressed]}
            >
              <Text style={styles.ownedText}>{owned} in hand</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.blurb}>{spec.blurb}</Text>

        <View style={styles.stats}>
          <Stat label="to mature" value={`${spec.daysToMature}d`} />
          <Stat label="per water" value={`${spec.coinsPerDay}`} />
          {/* The fragility ladder is the point of the expensive plants, so it
              is stated on the packet rather than discovered by losing one. */}
          <Stat
            label="dies after"
            value={spec.dieAfter === 1 ? '1 dry day' : `${spec.dieAfter} dry`}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          locked
            ? `${spec.name} unlocks at level ${spec.level}`
            : `Buy a ${spec.name} seed for ${spec.cost} coins`
        }
        disabled={locked}
        onPress={onBuy}
        style={({ pressed }) => [
          styles.buy,
          locked && styles.buyLocked,
          !locked && !affordable && styles.buyPoor,
          pressed && !locked && styles.pressed,
        ]}
      >
        {locked ? (
          <Text style={styles.buyLockedText}>Lv {spec.level}</Text>
        ) : (
          <>
            <CoinIcon size={11} />
            <Text style={styles.buyText}>{spec.cost}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function SeedRackSheet({
  coins, level, seeds, fertilizer, onBuy, onSelect, onClose,
}: Props) {
  return (
    <View style={styles.backdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the seed rack"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.sheet}>
        <View style={styles.grab} />

        <View style={styles.header}>
          <Text style={styles.title}>Seed Rack</Text>
          <View style={styles.headerRight}>
            {fertilizer > 0 ? (
              <View style={styles.fert}>
                <Text style={styles.fertText}>{fertilizer} fertilizer</Text>
              </View>
            ) : null}
            <View style={styles.coins}>
              <CoinIcon size={12} />
              <Text style={styles.coinsText}>{coins}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.hint}>
          Buy a seed, then drag the pot onto a bench. Water it every day you show
          up — growth counts waterings, never days.
        </Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {PLANT_ORDER.map((id) => {
            const spec = PLANT_SPECIES[id];
            return (
              <Packet
                key={id}
                spec={spec}
                owned={seeds[id] ?? 0}
                locked={level < spec.level}
                affordable={coins >= spec.cost}
                onBuy={() => onBuy(id)}
                onSelect={() => {
                  onSelect(id);
                  onClose();
                }}
              />
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>Back to the bench</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40,30,24,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF9F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    maxHeight: '84%',
    borderTopWidth: 1.2,
    borderColor: '#E5D2BC',
  },
  grab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E0CBB3',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  title: { fontSize: 17, fontWeight: '800', color: '#4A3427' },
  coins: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5D273', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  coinsText: { fontSize: 12, fontWeight: '800', color: '#6B4A16' },
  fert: {
    backgroundColor: '#DCE8D4', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  fertText: { fontSize: 10, fontWeight: '800', color: '#4C6B44' },
  hint: { fontSize: 11, color: '#8F7C72', lineHeight: 16, marginBottom: 10 },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingBottom: 6 },
  packet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFDF8',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#EDDCC6',
    padding: 10,
  },
  packetLocked: { opacity: 0.62 },
  swatch: {
    width: 26, height: 40, borderRadius: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(78,56,40,0.18)',
  },
  swatchHalf: { flex: 1 },
  packetBody: { flex: 1, gap: 3 },
  packetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  packetName: { fontSize: 13, fontWeight: '800', color: '#4A3427' },
  owned: {
    backgroundColor: '#D9F5EA', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  ownedText: { fontSize: 9, fontWeight: '800', color: '#2F6B54' },
  blurb: { fontSize: 10.5, color: '#8F7C72' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 2 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: { fontSize: 11, fontWeight: '800', color: '#7B5240' },
  statLabel: { fontSize: 9, color: '#A9968B' },
  buy: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5D273', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: '#DFB955',
  },
  buyPoor: { opacity: 0.5 },
  buyLocked: { backgroundColor: '#F3E7D9', borderColor: '#E0CBB3' },
  buyText: { fontSize: 12, fontWeight: '800', color: '#6B4A16' },
  buyLockedText: { fontSize: 11, fontWeight: '800', color: '#A9968B' },
  close: {
    marginTop: 10, alignItems: 'center',
    paddingVertical: 11, borderRadius: 14,
    backgroundColor: '#F3E7D9', borderWidth: 1, borderColor: '#E0CBB3',
  },
  closeText: { fontSize: 12, fontWeight: '800', color: '#7B5240' },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
});
