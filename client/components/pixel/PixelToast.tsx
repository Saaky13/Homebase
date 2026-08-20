/**
 * A transient confirmation in the pixel idiom.
 *
 * Exists because most of the hub's payout feedback used to go through
 * `Alert.alert`, which react-native-web renders as nothing at all — so on the
 * one platform this app actually runs on, checking in, reflecting and
 * claiming achievements were all silent. This is the visible replacement.
 *
 * Appears instantly and disappears instantly, like every other state change
 * in the kit — a fade would be the one soft edge in a hard-edged room. The
 * parent owns the toast value; this component times its own visibility, so
 * showing the same message twice needs a fresh `id`.
 */

import { useEffect, useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { BEVEL, PX, PixelMaterial } from '../../constants/pixelTheme';
import { PixelPanel } from './PixelPanel';
import { PixelText } from './PixelText';

export interface ToastValue {
  id: number;
  text: string;
  /** Accent bar colour — usually the section that produced the toast. */
  tint?: string;
}

const HOLD_MS = 2200;

export interface PixelToastProps {
  toast: ToastValue | null;
  material: PixelMaterial;
  style?: ViewStyle;
}

export function PixelToast({ toast, material, style }: PixelToastProps) {
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;

    setVisibleId(toast.id);
    const timeout = setTimeout(() => {
      setVisibleId((current) => (current === toast.id ? null : current));
    }, HOLD_MS);

    return () => clearTimeout(timeout);
  }, [toast]);

  if (!toast || visibleId !== toast.id) return null;

  return (
    <View pointerEvents="none" style={[{ alignItems: 'center' }, style]}>
      <PixelPanel material={material} behind="transparent" style={toastFace}>
        {toast.tint ? (
          <View
            style={{
              width: PX * 2,
              alignSelf: 'stretch',
              backgroundColor: toast.tint,
              marginRight: PX * 3,
            }}
          />
        ) : null}
        <PixelText size="small" color={material.ink}>
          {toast.text}
        </PixelText>
      </PixelPanel>
    </View>
  );
}

const toastFace: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: PX * 3,
  paddingHorizontal: PX * 4,
  // Sits over content, so it throws the app's hard shadow to separate.
  shadowColor: '#26364C',
  shadowOffset: { width: 0, height: BEVEL },
  shadowOpacity: 0.25,
  shadowRadius: 0,
};
