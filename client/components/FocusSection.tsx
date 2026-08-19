import React, { useEffect } from 'react';
import { View, StyleSheet, Vibration } from 'react-native';
import { useCafeState } from '../hooks/useCafeState';
import {
  PixelButton,
  PixelPanel,
  PixelProgress,
  PixelText,
  usePixelMaterial,
} from './pixel';
import { ACCENTS, PX } from '../constants/pixelTheme';

/**
 * The focus timer, rendered as a Growth Hub section rather than its own tab.
 *
 * All the session state lives in CafeState — this component only draws it and
 * drives the tick. That split is what lets a running session survive leaving
 * the section, which a hub section otherwise couldn't do because navigating
 * away unmounts it.
 *
 * Drawn with the hub's pixel kit, on the hub's rose material. It used to run
 * the old soft-card styles — brown wraps, 20px radii, its own local pixel
 * button — which made the one section you sit and stare at the only one that
 * didn't look like the hub it lives in.
 */
export default function FocusSection() {
  const {
    state,
    addPearl,
    addCoins,
    resetCafe,
    setGuideContext,
    setFocusDuration,
    startFocusTimer,
    pauseFocusTimer,
    resetFocusTimer,
    settleFocusTimer,
  } = useCafeState();

  const m = usePixelMaterial();
  const accent = ACCENTS.focus;

  const timer = state.focusTimer;
  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const isFresh = timer.remainingSeconds === timer.durationSeconds;
  const elapsed = timer.durationSeconds
    ? 1 - timer.remainingSeconds / timer.durationSeconds
    : 0;

  useEffect(() => {
    if (!timer.isRunning) return;

    const interval = setInterval(() => {
      const completed = settleFocusTimer();
      if (!completed) return;

      Vibration.vibrate([0, 100, 50, 100]);

      // Finishing a session used to fire `Alert.alert` and push a cat onto the
      // legacy `state.queue` — a field the café canvas stopped reading long
      // ago, and an Alert that react-native-web never renders. So on the one
      // platform this app actually runs on, finishing a focus block produced
      // no feedback at all. The guide says it instead.
      setGuideContext('focus:complete');
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, settleFocusTimer, setGuideContext]);

  // The three handlers below used to write `focus:start`, `focus:shortSession`
  // and `focus:longSession` into guideContext. No beat has ever matched those
  // strings, and setting one wiped `habits:focus`, which is the context the
  // Focus section's own orientation beat keys off — so pressing Start quietly
  // disabled the guide for that whole section.
  const handleStart = () => {
    startFocusTimer();
  };

  const handlePause = () => {
    pauseFocusTimer();
  };

  const handlePresetPress = (value: number) => {
    setFocusDuration(value);
  };

  return (
    <>
      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <PixelText size="small" color={m.inkDim}>
          FOCUS SESSION
        </PixelText>

        <PixelText size={48} color={m.ink} style={pixel.clock}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </PixelText>

        <PixelProgress
          value={elapsed}
          material={m}
          fill={accent}
          style={pixel.clockBar}
        />

        <PixelText size="body" color={m.inkDim} style={pixel.status}>
          {timer.isRunning ? 'Brewing in progress...' : isFresh ? 'Ready to focus' : 'Paused'}
        </PixelText>

        <PixelButton
          material={m}
          behind={m.face}
          accent={accent}
          dimmed={timer.isRunning}
          disabled={timer.isRunning}
          onPress={handleStart}
          style={pixel.action}
          contentStyle={pixel.actionFace}
        >
          <PixelText size="label" color={m.ink}>
            {timer.isRunning ? 'Running...' : 'Start Focus'}
          </PixelText>
        </PixelButton>

        <View style={pixel.actionRow}>
          <PixelButton
            material={m}
            behind={m.face}
            accent={ACCENTS.mission}
            dimmed={!timer.isRunning}
            disabled={!timer.isRunning}
            onPress={handlePause}
            style={pixel.actionHalf}
            contentStyle={pixel.actionFace}
          >
            <PixelText size="small" color={m.ink}>
              Pause / Break
            </PixelText>
          </PixelButton>

          <PixelButton
            material={m}
            behind={m.face}
            accent={ACCENTS.habits}
            onPress={resetFocusTimer}
            style={pixel.actionHalf}
            contentStyle={pixel.actionFace}
          >
            <PixelText size="small" color={m.ink}>
              Reset Timer
            </PixelText>
          </PixelButton>
        </View>

        <PixelText size="small" color={m.inkDim} style={pixel.hint}>
          5 min = 1 pearl · 1 min = 1 boba
        </PixelText>
      </PixelPanel>

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <PixelText size="title" color={m.ink}>
          Quick Start
        </PixelText>

        <View style={pixel.presetGrid}>
          {[5, 15, 25, 45].map((value) => (
            <PixelButton
              key={value}
              material={m}
              behind={m.face}
              accent={timer.durationSeconds === value * 60 ? accent : undefined}
              onPress={() => handlePresetPress(value)}
              style={pixel.preset}
              contentStyle={pixel.presetFace}
            >
              <PixelText size="small" color={m.ink}>
                {value} min
              </PixelText>
            </PixelButton>
          ))}
        </View>

        <PixelText size="small" color={m.inkDim} plain style={pixel.body}>
          Pick a block that feels realistic. The goal is rhythm, not suffering.
        </PixelText>
      </PixelPanel>

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <PixelText size="title" color={m.ink}>
          Break Rhythm
        </PixelText>

        <PixelText size="small" color={m.inkDim} plain style={pixel.body}>
          Focus works best when your brain gets little recovery windows. Breaks are not
          quitting. Breaks are part of the work cycle.
        </PixelText>

        <PixelButton
          material={m}
          behind={m.face}
          accent={ACCENTS.mission}
          onPress={() => setGuideContext('focus:breaks')}
          style={pixel.action}
          contentStyle={pixel.actionFace}
        >
          <PixelText size="small" color={m.ink}>
            Why Breaks Matter
          </PixelText>
        </PixelButton>

        <PixelButton
          material={m}
          behind={m.face}
          accent={ACCENTS.habits}
          onPress={() => setGuideContext('focus:goodBreak')}
          style={pixel.action}
          contentStyle={pixel.actionFace}
        >
          <PixelText size="small" color={m.ink}>
            How to Take a Good Break
          </PixelText>
        </PixelButton>

        <PixelPanel material={m} inset behind={m.face} style={pixel.note}>
          <PixelText size="label" color={m.ink}>
            Friendly break note
          </PixelText>
          <PixelText size="small" color={m.inkDim} plain style={pixel.body}>
            Try not to spend your break giving your attention to another intense thing.
            Let your brain breathe, stretch, drink water, and process what you just learned.
          </PixelText>
        </PixelPanel>
      </PixelPanel>

      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <PixelText size="title" color={m.ink}>
          Focus Notes
        </PixelText>
        {[
          'Start small and protect your momentum',
          'Each minute brews progress into your café',
          'Breaks should restore attention, not spend it somewhere else',
          'Breathe, stretch, hydrate, and let your brain process',
          'Consistency matters more than intensity',
        ].map((tip) => (
          <View key={tip} style={pixel.tipRow}>
            <View style={[pixel.bullet, { backgroundColor: accent }]} />
            <PixelText size="small" color={m.inkDim} plain style={pixel.tipText}>
              {tip}
            </PixelText>
          </View>
        ))}
      </PixelPanel>

      {/* Dev-only. The shelter's prices climb into the hundreds and the
          greenhouse's seeds on top of that; earning it by serving cats is far
          too slow to test an adoption or a full bench against. */}
      <PixelPanel material={m} behind={m.bg} style={pixel.card}>
        <PixelText size="small" color={m.inkDim}>
          DEV
        </PixelText>
        <View style={pixel.debugRow}>
          {[
            { label: '+50 Pearls', accent: ACCENTS.calendar, onPress: () => addPearl(50) },
            { label: '+50 Coins', accent: ACCENTS.achievements, onPress: () => addCoins(50) },
            { label: '+5000 Coins', accent: ACCENTS.achievements, onPress: () => addCoins(5000) },
            { label: 'Fresh Start', accent: ACCENTS.todo, onPress: resetCafe },
          ].map((b) => (
            <PixelButton
              key={b.label}
              material={m}
              behind={m.face}
              accent={b.accent}
              onPress={b.onPress}
              style={pixel.debugButton}
              contentStyle={pixel.actionFace}
            >
              <PixelText size="small" color={m.ink}>
                {b.label}
              </PixelText>
            </PixelButton>
          ))}
        </View>
      </PixelPanel>
    </>
  );
}

/** Layout only — every colour is passed at render time, because it changes at dusk. */
const pixel = StyleSheet.create({
  card: {
    padding: PX * 5,
    marginBottom: PX * 5,
  },
  clock: {
    textAlign: 'center',
    marginTop: PX * 2,
  },
  clockBar: {
    marginBottom: PX * 3,
  },
  status: {
    textAlign: 'center',
    marginBottom: PX * 4,
  },
  action: {
    marginBottom: PX * 3,
  },
  actionFace: {
    paddingVertical: PX * 4,
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: PX * 3,
  },
  actionHalf: {
    flex: 1,
    marginBottom: PX * 3,
  },
  hint: {
    textAlign: 'center',
    marginTop: PX,
  },
  presetGrid: {
    flexDirection: 'row',
    gap: PX * 3,
    marginTop: PX * 3,
  },
  preset: {
    flex: 1,
  },
  presetFace: {
    paddingVertical: PX * 3,
    alignItems: 'center',
  },
  body: {
    marginTop: PX * 2,
    marginBottom: PX * 3,
    lineHeight: 18,
  },
  note: {
    padding: PX * 4,
    marginTop: PX,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: PX * 3,
  },
  // A square bullet: the pixel kit has no round marks, and "•" falls out of the
  // pixel face to the system font mid-line.
  bullet: {
    width: PX * 2,
    height: PX * 2,
    marginTop: PX * 3,
    marginRight: PX * 3,
  },
  tipText: {
    flex: 1,
    lineHeight: 18,
  },
  debugRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PX * 3,
    marginTop: PX * 3,
  },
  debugButton: {
    // Two across, so "+5000 Coins" fits without the pixel face wrapping.
    width: '48%',
  },
});
