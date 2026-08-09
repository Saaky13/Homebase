import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Vibration,
  Modal,
} from 'react-native';
import { useCafeState } from '../../../hooks/useCafeState';
import { CATS_DATA, REFLECTION_PROMPTS } from '../../../constants/cafeData';
import { colors } from '../../../constants/colors';
import { POPULARITY_GAINS } from '../../../constants/popularity';

export default function FocusTab() {
  const {
    addPearl,
    addBoba,
    addCatToQueue,
    addPopularity,
    updateState,
    state,
    resetCafe,
    setGuideContext,
    setFocusSessionActive,
  } = useCafeState();

  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  const timerIntervalRef = useRef<NodeJS.Timeout | ReturnType<typeof setInterval> | null>(null);
  const elapsedSecondsRef = useRef(0);

  useEffect(() => {
    if (isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev > 0) return prev - 1;

          if (timerMinutes > 0) {
            setTimerMinutes((m) => m - 1);
            return 59;
          }

          completeSession();
          return 0;
        });

        elapsedSecondsRef.current += 1;

        if (elapsedSecondsRef.current % 300 === 0) {
          addPearl(1);
        }

        if (elapsedSecondsRef.current % 60 === 0) {
          addBoba('classic', 1);
          addPopularity(POPULARITY_GAINS.focusPerMinute);
          updateState({
            totalFocusMinutes: state.totalFocusMinutes + 1,
          });
        }
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [
    isRunning,
    timerMinutes,
    addPearl,
    addBoba,
    addPopularity,
    updateState,
    state.totalFocusMinutes,
  ]);

  const startFocusSession = () => {
    setGuideContext('focus:start');
    setFocusSessionActive(true);
    setIsRunning(true);
  };

  const pauseFocusSession = () => {
    setGuideContext('focus:breaks');
    setFocusSessionActive(false);
    setIsRunning(false);
  };

  const completeSession = () => {
    setIsRunning(false);
    setFocusSessionActive(false);
    setGuideContext('focus:goodBreak');
    Vibration.vibrate([0, 100, 50, 100]);

    const randomCat = CATS_DATA[Math.floor(Math.random() * CATS_DATA.length)];
    addCatToQueue({
      name: randomCat.name,
      emoji: randomCat.emoji,
      type: randomCat.type,
    });

    Alert.alert('Session Complete!', `${randomCat.name} wandered into your café.`);
    resetTimer();
  };

  const resetTimer = () => {
    setIsRunning(false);
    setFocusSessionActive(false);
    setTimerMinutes(25);
    setTimerSeconds(0);
    elapsedSecondsRef.current = 0;
  };

  const handlePresetPress = (value: number) => {
    setTimerMinutes(value);
    setTimerSeconds(0);
    elapsedSecondsRef.current = 0;

    if (value <= 15) {
      setGuideContext('focus:shortSession');
    } else {
      setGuideContext('focus:longSession');
    }
  };

  const handleReflectionAnswer = (option: { id: string; label: string; pearls: number }) => {
    addPearl(option.pearls);
    Alert.alert('Reflection logged', `+${option.pearls} pearls`);
    setShowReflection(false);
  };

  const prompt = REFLECTION_PROMPTS[currentPromptIndex];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.cardWrap, styles.heroWrap]}>
          <View style={styles.card}>
            <Text style={styles.label}>Focus Session</Text>

            <Text style={styles.timerDisplay}>
              {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
            </Text>

            <Text style={styles.status}>
              {isRunning
                ? 'Brewing in progress...'
                : timerMinutes === 25 && timerSeconds === 0
                ? 'Ready to focus'
                : 'Paused'}
            </Text>

            <PixelButton
              title={isRunning ? 'Running...' : 'Start Focus'}
              onPress={startFocusSession}
              disabled={isRunning}
            />

            <PixelButton
              title="Pause / Break"
              onPress={pauseFocusSession}
              disabled={!isRunning}
              variant="sky"
            />

            <PixelButton title="Reset Timer" onPress={resetTimer} variant="pink" />

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
            <Text style={styles.sectionTitle}>Daily Reflection</Text>
            <Text style={styles.desc}>Check in with your day after a work session.</Text>

            <PixelButton
              title="Open Reflection"
              onPress={() => {
                setGuideContext('focus:reflection');
                setShowReflection(true);
              }}
            />
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

          <TouchableOpacity style={[styles.debugButton, styles.resetButton]} onPress={resetCafe}>
            <Text style={styles.debugButtonText}>Fresh Start</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={showReflection} animationType="slide" transparent>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReflection(false)}>
              <Text style={styles.closeButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reflection</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.reflectionContent}>
            <View style={styles.cardWrap}>
              <View style={styles.card}>
                <Text style={styles.promptText}>{prompt.question}</Text>

                {prompt.options.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.optionButton}
                    onPress={() => handleReflectionAnswer(option)}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
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
  modalContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.brown300,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    fontSize: 14,
    color: colors.brown900,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.brown900,
  },
  reflectionContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  promptText: {
    fontSize: 14,
    color: colors.brown900,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: '800',
  },
  optionButton: {
    backgroundColor: '#FBE6ED',
    borderColor: '#C987A0',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 13,
    color: colors.brown900,
    fontWeight: '800',
  },
});