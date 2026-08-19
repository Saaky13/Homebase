/**
 * A pressable bevelled panel.
 *
 * The old `ThreeDButton` eased down 5px over 70ms and sprang back. That easing
 * is what made it feel like a web toy: pixel UI has no sub-pixel positions to
 * ease through, so the press is instant and the bevel flips at the same moment.
 * The button moves down by exactly the bevel thickness, so the lit edge it
 * loses is the space it drops into.
 */

import { useState } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { BEVEL, PixelMaterial } from '../../constants/pixelTheme';
import { PixelPanel } from './PixelPanel';

export interface PixelButtonProps extends Omit<PressableProps, 'style'> {
  material: PixelMaterial;
  behind?: string;
  /** Accent stripe along the top edge — how a section identifies itself. */
  accent?: string;
  /**
   * Layout for the button as a whole — width, flex, margins. This lands on the
   * outer pressable rather than the panel: putting a width on the panel left
   * the pressable sizing to its content, so a grid of `width: '47%'` tiles
   * collapsed into narrow columns with the labels wrapping one letter at a time.
   */
  style?: ViewStyle;
  /** Padding and inner layout for the panel face. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Signals "nothing left to do here today" without disabling the press. */
  dimmed?: boolean;
  children?: React.ReactNode;
}

export function PixelButton({
  material,
  behind,
  accent,
  style,
  contentStyle,
  dimmed,
  children,
  ...rest
}: PixelButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        rest.onPressOut?.(e);
      }}
      style={[
        {
          // Drop by the bevel, so the travel equals the depth it implied.
          transform: [{ translateY: pressed ? BEVEL : 0 }],
          opacity: dimmed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <PixelPanel
        material={material}
        behind={behind}
        sunken={pressed}
        // Fills whatever the pressable was sized to.
        style={[{ overflow: 'hidden', flexGrow: 1 }, contentStyle]}
      >
        {accent ? (
          <View style={{ height: BEVEL + 2, backgroundColor: accent }} />
        ) : null}
        {children}
      </PixelPanel>
    </Pressable>
  );
}
