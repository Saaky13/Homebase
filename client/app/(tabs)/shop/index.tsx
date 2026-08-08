import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  Vibration,
} from 'react-native';
import { useCafeState } from '../../../hooks/useCafeState';
import { SHOP_ITEMS } from '../../../constants/cafeData';
import { colors } from '../../../constants/colors';

const VISUAL_UPGRADES: Record<
  string,
  { type: 'tableStyle' | 'counterStyle' | 'rugStyle'; value: number }
> = {
  table_style_option_2: { type: 'tableStyle', value: 2 },
  counter_style_option_2: { type: 'counterStyle', value: 2 },
  rug_style_option_2: { type: 'rugStyle', value: 2 },
};

export default function ShopTab() {
  const { state, spendCoins, unlockItem, applyVisualUpgrade } = useCafeState();

  const handleUnlockItem = (itemId: string, price: number, title: string) => {
    if (state.unlockedItems.includes(itemId)) {
      Alert.alert('Already owned', `You already have ${title}.`);
      return;
    }

    if (state.coins < price) {
      Alert.alert('Not enough coins', `You need ${price} coins. You have ${state.coins}.`);
      return;
    }

    if (!spendCoins(price)) return;

    const visualUpgrade = VISUAL_UPGRADES[itemId];

    if (visualUpgrade) {
      applyVisualUpgrade(visualUpgrade.type, visualUpgrade.value, itemId);
    } else {
      unlockItem(itemId);
    }

    Vibration.vibrate([0, 50, 100, 50]);
    Alert.alert('Unlocked!', `${title} is now active in your café.`);
  };

  const groupedItems = {
    cats: SHOP_ITEMS.filter((item) => item.category === 'cats'),
    flavors: SHOP_ITEMS.filter((item) => item.category === 'flavors'),
    decor: SHOP_ITEMS.filter((item) => item.category === 'decor'),
    upgrades: SHOP_ITEMS.filter((item) => item.category === 'upgrades'),
  };

  const renderItem = ({ item }: { item: typeof SHOP_ITEMS[0] }) => {
    const isUnlocked = state.unlockedItems.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.shopItemWrap, isUnlocked && styles.shopItemWrapOwned]}
        onPress={() => handleUnlockItem(item.id, item.price, item.title)}
        activeOpacity={0.85}
      >
        <View style={[styles.shopItem, isUnlocked && styles.unlockedItem]}>
          <Text style={styles.shopItemIcon}>{item.emoji}</Text>
          <Text style={[styles.shopItemTitle, isUnlocked && styles.unlockedText]}>
            {item.title}
          </Text>
          {!isUnlocked ? (
            <Text style={styles.shopItemPrice}>{item.price} coins</Text>
          ) : (
            <Text style={[styles.unlockedText, styles.ownedBadge]}>✓ Active</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, styles.coinCard]}>
          <Text style={styles.coinLabel}>Your Coins</Text>
          <Text style={styles.coinAmount}>{state.coins}</Text>
          <Text style={styles.coinSubtext}>Use coins to style your café</Text>
        </View>

        {groupedItems.cats.length > 0 && (
          <Section title="New Cats" data={groupedItems.cats} renderItem={renderItem} />
        )}

        {groupedItems.flavors.length > 0 && (
          <Section title="Boba Flavors" data={groupedItems.flavors} renderItem={renderItem} />
        )}

        {groupedItems.decor.length > 0 && (
          <Section title="Decor" data={groupedItems.decor} renderItem={renderItem} />
        )}

        {groupedItems.upgrades.length > 0 && (
          <Section title="Visual Upgrades" data={groupedItems.upgrades} renderItem={renderItem} />
        )}

        <View style={[styles.card, styles.infoCard]}>
          <Text style={styles.infoTitle}>Retro Café Notes</Text>
          <Text style={styles.infoItem}>• Focus sessions make drinks over time</Text>
          <Text style={styles.infoItem}>• Serving cats earns coins</Text>
          <Text style={styles.infoItem}>• Upgrades immediately change your café visuals</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  data,
  renderItem,
}: {
  title: string;
  data: any[];
  renderItem: any;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.categoryTitle}>{title}</Text>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.shopGrid}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.brown300,
    padding: 16,
    marginBottom: 14,
  },
  coinCard: {
    alignItems: 'center',
    backgroundColor: '#FFF2C8',
  },
  coinLabel: {
    fontSize: 12,
    color: colors.brown700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  coinAmount: {
    fontSize: 46,
    fontWeight: '900',
    color: colors.brown900,
    marginVertical: 8,
  },
  coinSubtext: {
    fontSize: 12,
    color: colors.brown700,
  },
  section: {
    marginBottom: 22,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.brown900,
    marginBottom: 12,
  },
  shopGrid: {
    gap: 12,
    marginBottom: 12,
  },
  shopItemWrap: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#C38A44',
    paddingBottom: 5,
  },
  shopItemWrapOwned: {
    backgroundColor: '#9D5470',
  },
  shopItem: {
    minHeight: 140,
    borderRadius: 16,
    backgroundColor: '#FFF0DA',
    borderWidth: 2,
    borderColor: '#C38A44',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  unlockedItem: {
    backgroundColor: '#F5C5D3',
    borderColor: '#9D5470',
  },
  shopItemIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  shopItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brown900,
    textAlign: 'center',
    marginBottom: 6,
  },
  shopItemPrice: {
    fontSize: 12,
    color: colors.brown700,
    fontWeight: '800',
  },
  unlockedText: {
    color: colors.brown900,
    fontWeight: '900',
  },
  ownedBadge: {
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#DFF3EA',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.brown900,
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 12,
    color: colors.brown700,
    marginBottom: 6,
    lineHeight: 16,
  },
});