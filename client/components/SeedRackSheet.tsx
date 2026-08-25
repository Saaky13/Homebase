import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PLANT_ORDER, PLANT_SPECIES, type PlantSpec } from '../constants/plants';
import { CoinIcon } from './Icons';
import { PixelButton, PixelPanel, PixelText } from './pixel';
import { BEVEL, PX, type PixelMaterial } from '../constants/pixelTheme';

/**
 * The seed rack — a menu, not a shop.
 *
 * It used to sell packets into an invisible stockpile, which meant you could
 * buy nine Moonflowers without ever touching a pot: the buying and the doing
 * had come apart. It now works the way the café's recipe sheet does —
 * **tapping a seed loads the pot and spends nothing.** Coins leave your hand
 * when the pot lands on a bench, so the gesture chain is pick → carry → pay,
 * one seed at a time, and there is no inventory to manage or forget.
 *
 * A species you can't afford is still selectable (its price just shows red):
 * you may be about to harvest the difference, and the refusal belongs at the
 * drop — the moment of truth — not at the menu. Same rule as the café.
 *
 * Drawn on the pixel kit in the greenhouse's own seed-paper material, so the
 * sheet reads as something picked up off the potting bench rather than a
 * browser dialog floating over the room.
 */

interface Props {
  coins: number;
  level: number;
  fertilizer: number;
  /** The species currently loaded in the pot, if any. */
  selected: string | null;
  material: PixelMaterial;
  onSelect: (speciesId: string) => void;
  onClose: () => void;
}

const WARN = '#C0564E';
const LEAF = '#5D9B5B';

function Stat({
  label,
  value,
  material,
}: {
  label: string;
  value: string;
  material: PixelMaterial;
}) {
  return (
    <View style={styles.stat}>
      <PixelText size={12} color={material.ink} style={styles.statValue}>
        {value}
      </PixelText>
      <PixelText plain size={9} color={material.inkDim}>
        {label}
      </PixelText>
    </View>
  );
}

function Packet({
  spec,
  loaded,
  locked,
  affordable,
  material,
  onSelect,
}: {
  spec: PlantSpec;
  loaded: boolean;
  locked: boolean;
  affordable: boolean;
  material: PixelMaterial;
  onSelect: () => void;
}) {
  return (
    <PixelButton
      material={material}
      behind={material.bg}
      accent={loaded ? LEAF : undefined}
      dimmed={locked}
      disabled={locked}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${spec.name} unlocks at level ${spec.level}`
          : `Load a ${spec.name} into the pot — ${spec.cost} coins when planted`
      }
      contentStyle={styles.packetFace}
    >
      {/* The two-colour band stands in for the plant — leaf green over its
          flower or accent, so species stay distinguishable at a glance. */}
      <View style={[styles.swatch, { borderColor: material.faceDk }]}>
        <View style={[styles.swatchHalf, { backgroundColor: spec.swatch[0] }]} />
        <View style={[styles.swatchHalf, { backgroundColor: spec.swatch[1] }]} />
      </View>

      <View style={styles.packetBody}>
        <View style={styles.packetHead}>
          <PixelText size="label" color={material.ink}>
            {spec.name}
          </PixelText>
          {loaded ? (
            <PixelText size={12} color={LEAF}>
              in the pot
            </PixelText>
          ) : null}
        </View>

        <PixelText plain size={10.5} color={material.inkDim}>
          {spec.blurb}
        </PixelText>

        <View style={styles.stats}>
          <Stat material={material} label="to mature" value={`${spec.daysToMature}d`} />
          <Stat material={material} label="per water" value={`${spec.coinsPerDay}`} />
          {/* The fragility ladder is the point of the expensive plants, so it
              is stated on the packet rather than discovered by losing one. */}
          <Stat
            material={material}
            label="dies after"
            value={spec.dieAfter === 1 ? '1 dry day' : `${spec.dieAfter} dry`}
          />
        </View>
      </View>

      {/* The price, or the gate. Red is a warning, not a lock — the drop is
          where an unaffordable seed actually gets refused. */}
      <View style={styles.price}>
        {locked ? (
          <PixelText size={12} color={material.inkDim}>
            Lv {spec.level}
          </PixelText>
        ) : (
          <>
            <CoinIcon size={11} />
            <PixelText size="label" color={affordable ? material.ink : WARN}>
              {String(spec.cost)}
            </PixelText>
          </>
        )}
      </View>
    </PixelButton>
  );
}

export default function SeedRackSheet({
  coins,
  level,
  fertilizer,
  selected,
  material,
  onSelect,
  onClose,
}: Props) {
  return (
    <View style={styles.backdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the seed rack"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />

      <PixelPanel material={material} style={styles.sheet}>
        <View style={styles.header}>
          <PixelText size="title" color={material.ink}>
            Seed Rack
          </PixelText>
          <View style={styles.headerRight}>
            {fertilizer > 0 ? (
              <View style={[styles.chip, { backgroundColor: material.sunk }]}>
                <PixelText size={12} color={material.ink}>
                  {fertilizer} fertilizer
                </PixelText>
              </View>
            ) : null}
            <View style={[styles.chip, styles.coinChip]}>
              <CoinIcon size={12} />
              <PixelText size={12} color="#6B4A16">
                {String(coins)}
              </PixelText>
            </View>
          </View>
        </View>

        <PixelText plain size={11} color={material.inkDim} style={styles.hint}>
          Tap a seed to load the pot — you pay when it lands on a bench. Water
          it every day you show up; growth counts waterings, never days.
        </PixelText>

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
                loaded={selected === id}
                locked={level < spec.level}
                affordable={coins >= spec.cost}
                material={material}
                onSelect={() => onSelect(id)}
              />
            );
          })}
        </ScrollView>

        <PixelButton
          material={material}
          behind={material.bg}
          onPress={onClose}
          accessibilityRole="button"
          contentStyle={styles.closeFace}
        >
          <PixelText size="label" color={material.inkDim}>
            Back to the bench
          </PixelText>
        </PixelButton>
      </PixelPanel>
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
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    maxHeight: '84%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PX * 4,
    paddingVertical: PX,
    borderRadius: 0,
  },
  coinChip: { backgroundColor: '#F5D273' },
  hint: { lineHeight: 16, marginBottom: 10 },
  list: { flexGrow: 0 },
  listContent: { gap: BEVEL * 2, paddingBottom: 6 },
  packetFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
  },
  swatch: {
    width: 26,
    height: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 0,
  },
  swatchHalf: { flex: 1 },
  packetBody: { flex: 1, gap: 2 },
  packetHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  stats: { flexDirection: 'row', gap: 12, marginTop: 2 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: { lineHeight: 14 },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  closeFace: {
    alignItems: 'center',
    paddingVertical: 9,
    marginTop: 10,
  },
});
