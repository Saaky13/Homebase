/**
 * The Deep Work curtain — a full-screen overlay that takes over while a focus
 * session runs, so the phone can go face-down.
 *
 * It mounts in the root layout, outside the Stack, and covers everything —
 * TopBar included. While it's up the only live control is "Stop focusing",
 * which pauses the session; every other touch lands on the overlay and stops.
 *
 * It also *owns the settle tick*. The tick used to live in FocusSection,
 * which meant the timer only paid out while that section was mounted — walk
 * to the café mid-session and your minutes accrued but nothing settled until
 * you came back. The overlay is mounted for exactly as long as a session
 * runs, wherever you are, so it is the one right home for the interval.
 *
 * The night-sky palette is deliberate and local: the app has no dark mode
 * (convention 8), but this screen's entire job is "make the screen dark so
 * you put the phone down" — it's a curtain, not a theme.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, Vibration, View } from 'react-native';
import { getCat } from '../constants/catSprites';
import {
  ACCENTS,
  PX,
  type PixelMaterial,
} from '../constants/pixelTheme';
import { useCafeState } from '../hooks/useCafeState';
import { getTodayDateKey } from '../utils/date';
import { CatSprite } from './CatSprite';
import { PixelButton, PixelChip, PixelPanel, PixelProgress, PixelText } from './pixel';

const NIGHT_SKY: PixelMaterial = {
  bg: '#101828',
  face: '#1B2740',
  faceLt: '#2E3D5E',
  faceDk: '#0A1120',
  sunk: '#141E33',
  ink: '#EAF1FC',
  inkDim: '#8FA3C4',
  track: '#141E33',
  trackEdge: '#2E3D5E',
};

// A fixed constellation. Positions are percentages of the screen; hardcoded
// rather than rolled so the sky doesn't rearrange itself every render.
const STARS: Array<{ x: number; y: number; s: number; dim?: boolean }> = [
  { x: 8, y: 6, s: 2 },
  { x: 22, y: 12, s: 1, dim: true },
  { x: 38, y: 5, s: 1 },
  { x: 55, y: 10, s: 2, dim: true },
  { x: 71, y: 4, s: 1 },
  { x: 86, y: 9, s: 2 },
  { x: 94, y: 18, s: 1, dim: true },
  { x: 14, y: 20, s: 1 },
  { x: 47, y: 17, s: 1, dim: true },
  { x: 64, y: 22, s: 1 },
  { x: 80, y: 27, s: 1, dim: true },
  { x: 5, y: 33, s: 1, dim: true },
  { x: 30, y: 28, s: 2 },
  { x: 92, y: 38, s: 1 },
  { x: 12, y: 78, s: 1, dim: true },
  { x: 88, y: 82, s: 1 },
  { x: 45, y: 88, s: 1, dim: true },
  { x: 68, y: 92, s: 1 },
];

/** Stable all day, different tomorrow — which cat keeps you company. */
function companionCatId(ownedCats: string[], todayKey: string): string | null {
  if (ownedCats.length === 0) return null;
  const day = Number(todayKey.replace(/-/g, '')) || 0;
  return ownedCats[day % ownedCats.length];
}

export default function FocusOverlay() {
  const { state, pauseFocusTimer, settleFocusTimer, setGuideContext } =
    useCafeState();

  const timer = state.focusTimer;

  useEffect(() => {
    if (!timer.isRunning) return;

    const interval = setInterval(() => {
      const completed = settleFocusTimer();
      if (!completed) return;

      Vibration.vibrate([0, 100, 50, 100]);
      // The guide handles the celebration — an Alert would be invisible on
      // web, and the overlay itself is gone the frame the session ends.
      setGuideContext('focus:complete');
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, settleFocusTimer, setGuideContext]);

  if (!timer.isRunning) return null;

  const m = NIGHT_SKY;
  const remaining = timer.endsAt
    ? Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000))
    : timer.remainingSeconds;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const elapsedFraction = timer.durationSeconds
    ? 1 - remaining / timer.durationSeconds
    : 0;
  const bobaSoFar = Math.floor(timer.creditedSeconds / 60);

  const catId = companionCatId(state.ownedCats, getTodayDateKey());
  const catName = catId ? getCat(catId)?.name ?? 'A cat' : null;

  return (
    // A Pressable root so every stray touch is swallowed here instead of
    // reaching whatever screen is underneath.
    <Pressable style={[styles.fill, { backgroundColor: m.bg }]} onPress={() => {}}>
      <View pointerEvents="none" style={styles.fill}>
        {STARS.map((star, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: PX * star.s,
              height: PX * star.s,
              backgroundColor: star.dim ? m.inkDim : m.ink,
            }}
          />
        ))}
      </View>

      <View style={styles.content}>
        {timer.deepFocus ? (
          <PixelChip
            label="DEEP FOCUS · 2x PEARLS"
            material={m}
            tint={ACCENTS.focus}
            color="#123528"
            style={styles.chip}
          />
        ) : null}

        <PixelText size={64} color={m.ink} style={styles.clock}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </PixelText>

        <PixelProgress
          value={elapsedFraction}
          material={m}
          fill={ACCENTS.focus}
          style={styles.bar}
        />

        {catId ? <CatSprite catId={catId} size={72} style={styles.cat} /> : null}

        <PixelText size="body" color={m.ink} style={styles.line}>
          {catName ? `${catName} is holding your seat.` : 'Your seat is waiting.'}
        </PixelText>
        <PixelText size="small" color={m.inkDim} style={styles.subline}>
          {bobaSoFar > 0
            ? `${bobaSoFar} boba brewed so far · phone down`
            : 'Phone down. The café will handle the rest.'}
        </PixelText>

        <PixelButton
          material={m}
          behind={m.bg}
          accent={ACCENTS.habits}
          onPress={pauseFocusTimer}
          style={styles.stop}
          contentStyle={styles.stopFace}
        >
          <PixelText size="label" color={m.ink}>
            Stop focusing
          </PixelText>
        </PixelButton>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    // Above the TopBar and the GuideOverlay (zIndex 200) both.
    zIndex: 300,
    elevation: 30,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PX * 12,
  },
  chip: {
    marginBottom: PX * 6,
  },
  clock: {
    textAlign: 'center',
  },
  bar: {
    alignSelf: 'stretch',
    maxWidth: 320,
    marginTop: PX * 4,
    marginBottom: PX * 10,
  },
  cat: {
    marginBottom: PX * 5,
  },
  line: {
    textAlign: 'center',
  },
  subline: {
    textAlign: 'center',
    marginTop: PX * 2,
  },
  stop: {
    marginTop: PX * 12,
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  stopFace: {
    paddingVertical: PX * 5,
    alignItems: 'center',
  },
});
