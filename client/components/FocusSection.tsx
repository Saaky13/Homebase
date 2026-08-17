import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration } from 'react-native';
import { useCafeState } from '../hooks/useCafeState';
import { CATS_DATA } from '../constants/cafeData';
import { colors } from '../constants/colors';

/**
 * The focus timer, rendered as a Growth Hub section rather than its own tab.
 *
 * All the session state lives in CafeState — this component only draws it and
 * drives the tick. That split is what lets a running session survive leaving
 * the section, which a hub section otherwise couldn't do because navigating
 * away unmounts it.
 */
export default function FocusSection() {
  const {
    state,
    addPearl,
    addCoins,
    addCatToQueue,
    resetCafe,
    setGuideContext,
    setFocusDuration,
    startFocusTimer,
    pauseFocusTimer,
    resetFocusTimer,
    settleFocusTimer,
  } = useCafeState();

  const timer = state.focusTimer;
  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const isFresh = timer.remainingSeconds === timer.durationSeconds;

  useEffect(() => {
    if (!timer.isRunning) return;

    const interval = setInterval(() => {
      const completed = settleFocusTimer();
      if (!completed) return;

      Vibration.vibrate([0, 100, 50, 100]);

      const randomCat = CATS_DATA[Math.floor(Math.random() * CATS_DATA.length)];
      addCatToQueue({
        name: randomCat.name,
        emoji: randomCat.emoji,
        type: randomCat.type,
      });

      setGuideContext('focus:goodBreak');
      Alert.alert('Session Complete!', `${randomCat.name} wandered into your café.`);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, settleFocusTimer, addCatToQueue, setGuideContext]);

  const handleStart = () => {
    setGuideContext('focus:start');
    startFocusTimer();
  };

  const handlePause = () => {
    setGuideContext('focus:breaks');
    pauseFocusTimer();
  };

  const handlePresetPress = (value: number) => {
    setFocusDuration(value);
    setGuideContext(value <= 15 ? 'focus:shortSession' : 'focus:longSession');
  };

  return (
    <>
      <View style={[styles.cardWrap, styles.heroWrap]}>
        <View style={styles.card}>
          <Text style={styles.label}>Focus Session</Text>

          <Text style={styles.timerDisplay}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>

          <Text style={styles.status}>
            {timer.isRunning
              ? 'Brewing in progress...'
              : isFresh
              ? 'Ready to focus'
              : 'Paused'}
          </Text>

          <PixelButton
            title={timer.isRunning ? 'Running...' : 'Start Focus'}
            onPress={handleStart}
            disabled={timer.isRunning}
          />

          <PixelButton
            title="Pause / Break"
            onPress={handlePause}
            disabled={!timer.isRunning}
            variant="sky"
          />

          <PixelButton title="Reset Timer" onPress={resetFocusTimer} variant="pink" />

          <Text style={styles.hint}>5 min = 1 pearl • 1 min = 1 boba</Text>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick Start</Text>

          <View style={styles.presetGrid}>
            {[5, 15, 25, 45].map((value) => (
              <TouchableOpacity
                key={value}
                style={styles.presetButton}
                onPress={() => handlePresetPress(value)}
                activeOpacity={0.85}
              >
                <Text style={styles.presetText}>{value} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.smallNote}>
            Pick a block that feels realistic. The goal is rhythm, not suffering.
          </Text>
        </View>
      </View>

      <View style={[styles.cardWrap, styles.breakWrap]}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Break Rhythm</Text>

          <Text style={styles.desc}>
            Focus works best when your brain gets little recovery windows. Breaks are not
            quitting. Breaks are part of the work cycle.
          </Text>

          <PixelButton
            title="Why Breaks Matter"
            onPress={() => setGuideContext('focus:breaks')}
            variant="sky"
          />

          <PixelButton
            title="How to Take a Good Break"
            onPress={() => setGuideContext('focus:goodBreak')}
            variant="pink"
          />

          <View style={styles.breakNoteBox}>
            <Text style={styles.breakNoteTitle}>Friendly break note</Text>
            <Text style={styles.breakNoteText}>
              Try not to spend your break giving your attention to another intense thing.
              Let your brain breathe, stretch, drink water, and process what you just learned.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Focus Notes</Text>
          <Text style={styles.tip}>• Start small and protect your momentum</Text>
          <Text style={styles.tip}>• Each minute brews progress into your café</Text>
          <Text style={styles.tip}>• Breaks should restore attention, not spend it somewhere else</Text>
          <Text style={styles.tip}>• Breathe, stretch, hydrate, and let your brain process</Text>
          <Text style={styles.tip}>• Consistency matters more than intensity</Text>
        </View>
      </View>

      <View style={styles.debugRow}>
        <TouchableOpacity style={styles.debugButton} onPress={() => addPearl(50)}>
          <Text style={styles.debugButtonText}>+50 Pearls</Text>
        </TouchableOpacity>

        {/* Dev-only, same as the pearls button beside it: the shelter's prices
            climb into the hundreds, and earning that by serving cats is too
            slow to test an adoption against. */}
        <TouchableOpacity
          style={[styles.debugButton, styles.coinsButton]}
          onPress={() => addCoins(50)}
        >
          <Text style={styles.debugButtonText}>+50 Coins</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.debugButton, styles.resetButton]} onPress={resetCafe}>
          <Text style={styles.debugButtonText}>Fresh Start</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function PixelButton({
  title,
  onPress,
  disabled,
  variant = 'gold',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'gold' | 'sky' | 'pink';
}) {
  const palette = {
    gold: { outer: '#C58F2D', inner: '#E7B85C' },
    sky: { outer: '#679CBC', inner: '#A9D7F3' },
    pink: { outer: '#B86883', inner: '#EAA4B4' },
  }[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pixelWrap, disabled && { opacity: 0.45 }]}
    >
      <View style={[styles.pixelOuter, { backgroundColor: palette.outer }]}>
        <View style={[styles.pixelInner, { backgroundColor: palette.inner }]}>
          <Text style={styles.pixelText}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    backgroundColor: '#B97A43',
    borderRadius: 20,
    paddingBottom: 5,
    marginBottom: 14,
  },
  heroWrap: {
    backgroundColor: '#9D5470',
  },
  breakWrap: {
    backgroundColor: '#679CBC',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.brown300,
    padding: 16,
  },
  label: {
    fontSize: 12,
    color: colors.brown700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  timerDisplay: {
    fontSize: 54,
    fontWeight: '900',
    color: colors.brown900,
    textAlign: 'center',
    marginVertical: 14,
  },
  status: {
    fontSize: 14,
    color: colors.brown700,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '700',
  },
  pixelWrap: {
    marginBottom: 10,
  },
  pixelOuter: {
    borderRadius: 14,
    paddingBottom: 4,
  },
  pixelInner: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pixelText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.brown900,
  },
  hint: {
    fontSize: 12,
    color: colors.brown700,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.brown900,
    marginBottom: 10,
  },
  desc: {
    fontSize: 13,
    color: colors.brown700,
    marginBottom: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  smallNote: {
    fontSize: 12,
    color: colors.brown700,
    marginTop: 10,
    lineHeight: 16,
    fontWeight: '700',
  },
  presetGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#F7D9A7',
    borderColor: '#C58F2D',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.brown900,
  },
  breakNoteBox: {
    backgroundColor: '#FFF2C8',
    borderColor: '#C58F2D',
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
    marginTop: 4,
  },
  breakNoteTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.brown900,
    marginBottom: 6,
  },
  breakNoteText: {
    fontSize: 12,
    color: colors.brown700,
    lineHeight: 17,
    fontWeight: '700',
  },
  tip: {
    fontSize: 12,
    color: colors.brown700,
    marginBottom: 6,
    lineHeight: 16,
    fontWeight: '700',
  },
  debugRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  coinsButton: {
    backgroundColor: colors.gold,
    borderColor: '#B98B2E',
  },
  debugButton: {
    flex: 1,
    backgroundColor: colors.lavender,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B73CC',
  },
  resetButton: {
    backgroundColor: colors.coral,
    borderColor: '#B85A4D',
  },
  debugButtonText: {
    color: colors.brown900,
    fontWeight: '900',
    fontSize: 12,
  },
});
