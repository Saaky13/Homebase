import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import {
  CAPSULE_GRIDS,
  CAPSULE_KEYS,
  CRANK_CENTER,
  CRANK_GRID,
  MACHINE_GRID,
  MACHINE_H,
  MACHINE_PALETTE,
  MACHINE_W,
  TRAY_CENTER,
} from '../constants/gachaMachine';
import { gridToPaths, type PixelPaths } from '../utils/pixelSvg';
import { PixelSprite } from './PixelSprite';

// Walked once at module load — none of this art ever changes, and the shelter
// mounts this component on every visit.
const MACHINE_PATHS = gridToPaths(MACHINE_GRID, MACHINE_PALETTE);
const CRANK_PATHS = gridToPaths(CRANK_GRID, MACHINE_PALETTE);
const CAPSULE_PATHS: Record<string, PixelPaths> = Object.fromEntries(
  CAPSULE_KEYS.map((k) => [k, gridToPaths(CAPSULE_GRIDS[k], MACHINE_PALETTE)])
);

const CRANK_CELLS = CRANK_GRID[0].length;
const CAPSULE_CELLS = 11;

/** Crank turn (620ms) plus the capsule drop (420ms). */
const TURN_MS = 1040;

export type GachaMachineHandle = {
  /** Turns the crank and drops a capsule. `onDone` fires when it lands. */
  play: (onDone: () => void) => void;
};

/**
 * The capsule machine, and the little performance it puts on when you adopt.
 *
 * The animation is driven imperatively rather than from an effect watching a
 * `spinning` prop. Adopting re-renders this component (coins and the
 * collection both change), and an effect-driven version got torn down and
 * restarted mid-turn by its own cleanup, so the sequence never reached its
 * completion callback and the reveal never opened.
 */
const GachaMachine = forwardRef<
  GachaMachineHandle,
  {
    width?: number;
    /** Which colour capsule drops. Picked by the caller so it varies per pull. */
    capsuleKey: string;
  }
>(function GachaMachine({ width = 168, capsuleKey }, ref) {
  const scale = width / MACHINE_W;
  const height = MACHINE_H * scale;

  const crankSpin = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const capsuleDrop = useRef(new Animated.Value(0)).current;
  const capsuleFade = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    play(onDone: () => void) {
      crankSpin.setValue(0);
      shake.setValue(0);
      capsuleDrop.setValue(0);
      capsuleFade.setValue(0);

      // Whichever lands first wins, and the loser is ignored.
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(fallback);
        onDone();
      };

      /**
       * Animated is driven by requestAnimationFrame, which browsers suspend
       * for a backgrounded tab. Without this, backgrounding the app mid-turn
       * would strand the reveal forever: the coins are already spent and the
       * cat already granted, but the animation that opens the reveal never
       * reaches its callback. The cat should always arrive.
       */
      const fallback = setTimeout(finish, TURN_MS + 400);

      buildSequence().start(({ finished }) => {
        if (finished) finish();
      });
    },
  }));

  const buildSequence = () =>
    Animated.sequence([
      // The crank turns a full revolution while the machine rattles.
      Animated.parallel([
        Animated.timing(crankSpin, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: false }),
          Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: false }),
          Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: false }),
          Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: false }),
          Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: false }),
        ]),
      ]),
      // Then the capsule falls and bounces into the tray.
      Animated.parallel([
        Animated.timing(capsuleFade, { toValue: 1, duration: 90, useNativeDriver: false }),
        Animated.timing(capsuleDrop, {
          toValue: 1,
          duration: 420,
          easing: Easing.bounce,
          useNativeDriver: false,
        }),
      ]),
    ]);

  const crankSize = CRANK_CELLS * scale;
  const capsuleSize = CAPSULE_CELLS * scale;

  // The capsule starts up behind the collar and ends in the tray.
  const dropFrom = (CRANK_CENTER.y - 12) * scale;
  const dropTo = TRAY_CENTER.y * scale;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width,
          height,
          transform: [
            {
              translateX: shake.interpolate({
                inputRange: [-1, 1],
                outputRange: [-3, 3],
              }),
            },
          ],
        },
      ]}
    >
      <PixelSprite paths={MACHINE_PATHS} width={width} height={height} />

      <Animated.View
        style={[
          styles.overlay,
          {
            width: crankSize,
            height: crankSize,
            left: CRANK_CENTER.x * scale - crankSize / 2,
            top: CRANK_CENTER.y * scale - crankSize / 2,
            transform: [
              {
                rotate: crankSpin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          },
        ]}
      >
        <PixelSprite paths={CRANK_PATHS} width={crankSize} height={crankSize} />
      </Animated.View>

      <Animated.View
        style={[
          styles.overlay,
          {
            width: capsuleSize,
            height: capsuleSize,
            left: TRAY_CENTER.x * scale - capsuleSize / 2,
            opacity: capsuleFade,
            transform: [
              {
                translateY: capsuleDrop.interpolate({
                  inputRange: [0, 1],
                  outputRange: [dropFrom, dropTo],
                }),
              },
            ],
          },
        ]}
      >
        <PixelSprite
          paths={CAPSULE_PATHS[capsuleKey] ?? CAPSULE_PATHS['1']}
          width={capsuleSize}
          height={capsuleSize}
        />
      </Animated.View>
    </Animated.View>
  );
});

export default GachaMachine;

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  overlay: { position: 'absolute' },
});
