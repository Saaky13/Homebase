import React, { useMemo } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { gridToSvgUri } from '../utils/pixelSvg';
import { bobaCupGrid, BOBA_PALETTE, type BobaFlavor } from '../constants/bobaCup';

export const CUP_ASPECT = 30 / 20;

interface Props {
  flavor?: BobaFlavor;
  /** 0–1. The cup empties as it's handed over. */
  fill?: number;
  width?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * The draggable cup. It's a real view rather than something painted into the
 * café canvas so it gets touch handling for free — same reasoning as the
 * controls it replaced.
 */
export default function BobaCupSprite({
  flavor = 'classic',
  fill = 1,
  width = 46,
  style,
}: Props) {
  const uri = useMemo(
    () => gridToSvgUri(bobaCupGrid(fill), BOBA_PALETTE[flavor]),
    [flavor, fill]
  );

  return (
    <Image
      source={{ uri }}
      style={[{ width, height: width * CUP_ASPECT }, style]}
      resizeMode="stretch"
    />
  );
}
