/**
 * Text in the hub's pixel face.
 *
 * Sizes come from `TYPE` rather than being typed inline. A pixel font blurs at
 * any size that isn't a whole multiple of its design grid, and the old hub had
 * eleven different font sizes between 9 and 26 — most of which would render
 * soft. Passing a raw number is allowed for the odd one-off, but it is quantised
 * to the nearest multiple of 4 on the way through.
 *
 * Body copy stays in the system font on purpose: guide beats and reflection
 * prompts run to several lines, and long pixel-font paragraphs are tiring to
 * read. Pass `plain` for those.
 */

import { Text, TextProps, TextStyle } from 'react-native';
import { PIXEL_FONT, TYPE } from '../../constants/pixelTheme';

type SizeKey = keyof typeof TYPE;

export interface PixelTextProps extends TextProps {
  size?: SizeKey | number;
  color?: string;
  /** Render in the system font — for multi-line prose. */
  plain?: boolean;
}

/** Pixel faces stay crisp on their grid; 4 is the coarsest common divisor. */
const quantise = (n: number) => Math.max(8, Math.round(n / 4) * 4);

export function PixelText({
  size = 'body',
  color,
  plain,
  style,
  ...rest
}: PixelTextProps) {
  const fontSize = typeof size === 'number' ? quantise(size) : TYPE[size];

  const base: TextStyle = {
    fontSize,
    color,
    // Handjet's own line box is tight; without this, descenders clip on web.
    lineHeight: Math.round(fontSize * 1.35),
  };
  if (!plain) base.fontFamily = PIXEL_FONT;

  return <Text {...rest} style={[base, style]} />;
}
