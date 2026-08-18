import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { useCafeState } from '../hooks/useCafeState';
import { CoinIcon, PearlIcon } from './Icons';

const TITLES: Record<string, string> = {
  '/cafe': 'Café',
  '/shop': 'Market',
  '/habits': 'Growth Hub',
  '/cats': 'Cat Shelter',
  '/greenhouse': 'Greenhouse',
};

function Pill({
  label,
  value,
  bg,
  fg,
  icon,
}: {
  label: string;
  value: string;
  bg: string;
  fg: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.pillValue, { color: fg }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

/**
 * One bar, two modes. Over the map it floats so the town runs edge to edge;
 * on a destination it becomes a solid header with a way back to town.
 */
export default function TopBar() {
  const { state } = useCafeState();
  const pathname = usePathname();
  const router = useRouter();

  const onMap = pathname === '/' || pathname === '';
  const title = TITLES[pathname];

  return (
    <View style={[styles.bar, onMap ? styles.barFloating : styles.barSolid]}>
      {onMap ? (
        <Text style={styles.brand}>Homebase</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to town"
          onPress={() => router.push('/' as any)}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Text style={styles.backText}>‹ Town</Text>
        </Pressable>
      )}

      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.pills}>
        <Pill label="coins" value={String(state.coins)} bg="#F5D273" fg="#6B4A16" icon={<CoinIcon size={13} />} />
        <Pill label="pearls" value={String(state.pearls)} bg="#E0B8E8" fg="#553067" icon={<PearlIcon size={13} />} />
        <Pill label="level" value={String(state.level)} bg="#F2A0BC" fg="#6B2038" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  // Solid in both modes on purpose: a translucent bar over a busy pixel map
  // costs more legibility than the edge-to-edge look buys.
  barFloating: {
    backgroundColor: '#FFF7F2',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(94,58,70,0.14)',
  },
  barSolid: {
    backgroundColor: '#FFF7F2',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(94,58,70,0.14)',
  },
  brand: { fontSize: 13, fontWeight: '700', color: '#5E3A46' },
  title: { fontSize: 13, fontWeight: '700', color: '#5E3A46' },
  back: {
    backgroundColor: '#FFEFE9',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#EBD3CC',
  },
  backPressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
  backText: { fontSize: 12, fontWeight: '700', color: '#8A5468' },
  pills: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillValue: { fontSize: 12, fontWeight: '800' },
  pillLabel: { fontSize: 9, opacity: 0.75 },
});
