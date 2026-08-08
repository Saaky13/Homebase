import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCafeState } from '../hooks/useCafeState';
import { colors } from '../constants/colors';

function CurrencyChip({
  label,
  value,
  bg,
  border,
}: {
  label: string;
  value: number;
  bg: string;
  border: string;
}) {
  return (
    <View style={[styles.chipWrap, { backgroundColor: border }]}>
      <View style={[styles.chip, { backgroundColor: bg }]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

export default function CurrencyBar() {
  const { state } = useCafeState();

  return (
    <View style={styles.container}>
      <CurrencyChip
        label="Coins"
        value={state.coins}
        bg={colors.gold}
        border="#C58F2D"
      />
      <CurrencyChip
        label="Pearls"
        value={state.pearls}
        bg={colors.lavender}
        border="#8B73CC"
      />
      <CurrencyChip
        label="Pop"
        value={state.popularity}
        bg={colors.blush}
        border="#B86883"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderBottomWidth: 2,
    borderBottomColor: colors.brown300,
  },
  chipWrap: {
    flex: 1,
    borderRadius: 16,
    paddingBottom: 4,
  },
  chip: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    color: colors.brown900,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.brown900,
  },
});