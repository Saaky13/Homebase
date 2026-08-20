/**
 * A sliding on/off switch in the pixel idiom.
 *
 * A sunken track with a square knob that sits at one end or the other. The
 * knob jumps rather than glides — same reasoning as `PixelButton`: pixel UI
 * has no sub-pixel positions to ease through, so animating the travel would
 * be the one soft-edged movement in a hard-edged room.
 */

import { Pressable, View, ViewStyle } from 'react-native';
import { BEVEL_THIN, PX, PixelMaterial } from '../../constants/pixelTheme';

const TRACK_W = PX * 22;
const TRACK_H = PX * 9;
const KNOB = TRACK_H - PX * 2;

export interface PixelToggleProps {
  material: PixelMaterial;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Knob colour while on; off falls back to the lit face. */
  accent: string;
  /** Dims and refuses the press — how "locked while running" looks. */
  disabled?: boolean;
  style?: ViewStyle;
}

export function PixelToggle({
  material,
  value,
  onValueChange,
  accent,
  disabled,
  style,
}: PixelToggleProps) {
  const track: ViewStyle = {
    width: TRACK_W,
    height: TRACK_H,
    backgroundColor: value ? material.track : material.sunk,
    // Inverted bevel — the track is a well the knob slides in.
    borderTopWidth: BEVEL_THIN,
    borderLeftWidth: BEVEL_THIN,
    borderBottomWidth: BEVEL_THIN,
    borderRightWidth: BEVEL_THIN,
    borderTopColor: material.trackEdge,
    borderLeftColor: material.trackEdge,
    borderBottomColor: material.faceLt,
    borderRightColor: material.faceLt,
    borderRadius: 0,
    justifyContent: 'center',
  };

  const knob: ViewStyle = {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    left: value ? TRACK_W - KNOB - PX * 2 - BEVEL_THIN * 2 : PX,
    backgroundColor: value ? accent : material.faceLt,
    borderTopWidth: BEVEL_THIN,
    borderLeftWidth: BEVEL_THIN,
    borderBottomWidth: BEVEL_THIN,
    borderRightWidth: BEVEL_THIN,
    borderTopColor: material.faceLt,
    borderLeftColor: material.faceLt,
    borderBottomColor: material.faceDk,
    borderRightColor: material.faceDk,
    borderRadius: 0,
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
      hitSlop={PX * 3}
    >
      <View style={track}>
        <View style={knob} />
      </View>
    </Pressable>
  );
}
