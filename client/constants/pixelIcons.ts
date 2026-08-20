/**
 * Growth Hub section icons, 12x12.
 *
 * These replace the Unicode dingbats the hub used to label its tiles with
 * (`✓ ✦ ☾ ☷ ☑ ⏱ ☰` plus one full-colour 🏆). Those rendered in the system font:
 * thin, antialiased, inconsistent in weight, and next to a screen full of
 * hard-edged pixel art they were the loudest thing announcing that the hub
 * belonged to a different game.
 *
 * Same colour-key-plus-palette contract as `catSprites` and `gachaMachine`, so
 * they render through `utils/pixelSvg`. Two keys only:
 *   a — the accent's dark ink, for outlines and structure
 *   b — the accent itself, for fills
 * `PixelIcon` builds the palette per section, so one grid works in any accent.
 *
 * 12 is a deliberate choice: at PX = 2 it draws 24pt, which matches the cat
 * sprites' density closely enough that icons and cats read at one resolution.
 */

export type IconGrid = readonly string[];

/** Growth, not a tick — the tick is the to-do list's job. */
const habits: IconGrid = [
  '............',
  '.....aa.....',
  '..bbbaa.....',
  '.bbbbaa.....',
  '..bbbaa.bbb.',
  '.....aabbbbb',
  '.....aa.bbb.',
  '.....aa.....',
  '.....aa.....',
  '....aaaa....',
  '............',
  '............',
];

/** A four-point star: direction, the thing a mission gives you. */
const mission: IconGrid = [
  '.....aa.....',
  '.....aa.....',
  '.....aa.....',
  '....aaaa....',
  '...aaaaaa...',
  'aaaaaaaaaaaa',
  'aaaaaaaaaaaa',
  '...aaaaaa...',
  '....aaaa....',
  '.....aa.....',
  '.....aa.....',
  '.....aa.....',
];

/** Crescent — reflection is the end-of-day beat. */
const reflection: IconGrid = [
  '............',
  '....aaaa....',
  '..aaaaaa....',
  '.aaaa.......',
  '.aaa........',
  '.aaa........',
  '.aaa........',
  '.aaaa.......',
  '..aaaaaa....',
  '....aaaa....',
  '............',
  '............',
];

const calendar: IconGrid = [
  '............',
  '..a......a..',
  '..a......a..',
  '.aaaaaaaaaa.',
  '.aaaaaaaaaa.',
  '.a........a.',
  '.a.bb.bb..a.',
  '.a........a.',
  '.a.bb.bb..a.',
  '.a........a.',
  '.aaaaaaaaaa.',
  '............',
];

const todo: IconGrid = [
  '....aaaa....',
  '.aaaaaaaaaa.',
  '.a..aaaa..a.',
  '.a........a.',
  '.a.bb.....a.',
  '.a........a.',
  '.a.bb.....a.',
  '.a........a.',
  '.a.bb.....a.',
  '.a........a.',
  '.aaaaaaaaaa.',
  '............',
];

/** An hourglass reads as elapsed time; a clock face reads as what time it is. */
const focus: IconGrid = [
  '.aaaaaaaaaa.',
  '.aaaaaaaaaa.',
  '..bbbbbbbb..',
  '...bbbbbb...',
  '....bbbb....',
  '.....bb.....',
  '.....bb.....',
  '....bbbb....',
  '...bbbbbb...',
  '..bbbbbbbb..',
  '.aaaaaaaaaa.',
  '.aaaaaaaaaa.',
];

const achievements: IconGrid = [
  '............',
  '.aaaaaaaaaa.',
  '.abbbbbbbba.',
  'aabbbbbbbbaa',
  'a.bbbbbbbb.a',
  'a.bbbbbbbb.a',
  'aa.bbbbbb.aa',
  '...bbbbbb...',
  '.....aa.....',
  '.....aa.....',
  '...aaaaaa...',
  '..aaaaaaaa..',
];

/** A planted pennant — the week closed, the flag set for the next one. */
const review: IconGrid = [
  '............',
  '..aa........',
  '..aabbbbbb..',
  '..aabbbbbbb.',
  '..aabbbbbbb.',
  '..aabbbbbb..',
  '..aabbbb....',
  '..aa........',
  '..aa........',
  '..aa........',
  '..aa........',
  '............',
];

const resources: IconGrid = [
  '............',
  '.aaaa..aaaa.',
  '.abbbaabbba.',
  '.abbbaabbba.',
  '.abbbaabbba.',
  '.abbbaabbba.',
  '.abbbaabbba.',
  '.abbbaabbba.',
  '.abbbaabbba.',
  '.aaaaaaaaaa.',
  '............',
  '............',
];

export const ICON_SIZE = 12;

export const SECTION_ICONS = {
  habits,
  mission,
  reflection,
  review,
  calendar,
  todo,
  focus,
  achievements,
  resources,
} as const;

export type SectionIconKey = keyof typeof SECTION_ICONS;
