/**
 * The Library — the Growth Hub's shelf of borrowed ideas.
 *
 * Each entry is one principle from a book that actually moved the needle for
 * people, restated in the app's own words and credited to its source. Every
 * card points at the place in the app where you can act on it, because a
 * principle you can't practise within two taps is trivia.
 *
 * Deliberately pays no pearls. Pearls are the receipt for real work — habits
 * done, minutes focused, honest reflection — and reading about work isn't
 * work. The reward for the Library is leverage, and saying so out loud is
 * part of the design.
 */

import type { AccentKey } from './pixelTheme';

export interface Principle {
  id: string;
  /** The idea, compressed to a phrase you can carry. */
  title: string;
  /** 2–3 sentences in the app's voice — never quoted from the book. */
  body: string;
  /** A concrete way to practise it in this app, phrased as an action. */
  tryIt: string;
  /**
   * Growth Hub section the "try it" button jumps to. Typed loosely as string
   * because HubSection lives in the screen; the screen validates the jump.
   */
  section: string;
  /** Which accent colours the card — themes, not books, pick the hue. */
  accent: AccentKey;
}

export interface BookShelf {
  book: string;
  author: string;
  principles: Principle[];
}

export const LIBRARY: BookShelf[] = [
  {
    book: 'Atomic Habits',
    author: 'James Clear',
    principles: [
      {
        id: 'ah-tiny',
        title: 'Make it tiny',
        body:
          'A habit survives on its worst day, not its best. Shrink the thing until a terrible, tired, zero-motivation day can still hold it — two minutes counts, one rep counts.',
        tryIt: 'Add a Quick Win habit so small it feels unfair',
        section: 'habits',
        accent: 'habits',
      },
      {
        id: 'ah-never-twice',
        title: 'Never miss twice',
        body:
          'Missing once is an accident. Missing twice is the beginning of a different habit — the not-doing kind. The rep after a miss is worth more than any other rep you log.',
        tryIt: 'Check the calendar for gaps and close the newest one',
        section: 'calendar',
        accent: 'calendar',
      },
      {
        id: 'ah-identity',
        title: 'Cast identity votes',
        body:
          'Every rep is a small vote for the kind of person you are becoming. You do not need a unanimous result — just a steady majority, stacked one unremarkable day at a time.',
        tryIt: 'Log today’s rep, even a partial one',
        section: 'habits',
        accent: 'habits',
      },
      {
        id: 'ah-obvious',
        title: 'Make it obvious',
        body:
          'Habits answer to your environment more than your willpower. Put the running shoes by the door, the book on the pillow — arrange the room so the habit is the path of least resistance.',
        tryIt: 'Write a reminder note on a habit naming where it happens',
        section: 'habits',
        accent: 'todo',
      },
    ],
  },
  {
    book: 'The 7 Habits of Highly Effective People',
    author: 'Stephen Covey',
    principles: [
      {
        id: '7h-end',
        title: 'Begin with the end in mind',
        body:
          'Ladders climb fastest when they lean on the right wall. Decide where you are actually going before optimising the route — everything in this hub works better with a direction over it.',
        tryIt: 'Write or sharpen your mission statement',
        section: 'mission',
        accent: 'mission',
      },
      {
        id: '7h-first',
        title: 'First things first',
        body:
          'The urgent eats the important unless the important is scheduled first. Your Keystone habit is the big rock — it goes in the jar before the day fills up with gravel.',
        tryIt: 'Make your most important habit a Keystone',
        section: 'habits',
        accent: 'habits',
      },
      {
        id: '7h-saw',
        title: 'Sharpen the saw',
        body:
          'Rest is not the opposite of production — it is what keeps production possible. A break that restores attention is part of the work cycle, not time stolen from it.',
        tryIt: 'Take a real break between focus blocks',
        section: 'focus',
        accent: 'focus',
      },
      {
        id: '7h-proactive',
        title: 'Be proactive',
        body:
          'Between what happens and how you respond there is a gap, and the gap belongs to you. Reviewing your day honestly is how the gap gets wider.',
        tryIt: 'Answer today’s reflection truthfully',
        section: 'reflection',
        accent: 'reflection',
      },
    ],
  },
  {
    book: 'Deep Work',
    author: 'Cal Newport',
    principles: [
      {
        id: 'dw-depth',
        title: 'Depth beats duration',
        body:
          'One hour of undivided attention outproduces three hours of half-attention with the phone face-up. The scarce skill is not time management — it is the ability to not switch.',
        tryIt: 'Run a session with Deep Focus on and the phone down',
        section: 'focus',
        accent: 'focus',
      },
      {
        id: 'dw-ritual',
        title: 'Ritualize the start',
        body:
          'Starting is the expensive part. A fixed time, a fixed place and a fixed length make starting cheap enough that you stop negotiating with yourself about it.',
        tryIt: 'Pick one preset length and keep it for a week',
        section: 'focus',
        accent: 'focus',
      },
    ],
  },
  {
    book: 'The Compound Effect',
    author: 'Darren Hardy',
    principles: [
      {
        id: 'ce-compound',
        title: 'Small choices compound',
        body:
          'No single day of a routine looks impressive, which is exactly why most people quit. The curve is flat for weeks and then it is not — the calendar is where you catch it bending.',
        tryIt: 'Look at your month and count the marked days',
        section: 'calendar',
        accent: 'calendar',
      },
    ],
  },
  {
    book: 'Tiny Habits',
    author: 'BJ Fogg',
    principles: [
      {
        id: 'th-celebrate',
        title: 'Celebrate immediately',
        body:
          'Emotion is what wires a habit in, not repetition alone. When the rep lands, let the win actually register — that small feeling of "done" is the glue.',
        tryIt: 'Log a rep and take the pearl without rushing past it',
        section: 'habits',
        accent: 'achievements',
      },
    ],
  },
];

/** Every principle in shelf order — the daily pick indexes into this. */
export const ALL_PRINCIPLES: Principle[] = LIBRARY.flatMap(
  (shelf) => shelf.principles
);

/**
 * The principle of the day. Same selection scheme as the reflection prompt —
 * stable all day, different tomorrow — so the shelf has a reason to be
 * revisited without anything needing to be stored.
 */
export function principleForDate(dateKey: string): Principle {
  const day = Number(dateKey.replace(/-/g, '')) || 0;
  return ALL_PRINCIPLES[day % ALL_PRINCIPLES.length];
}

/** Which shelf a principle sits on, for the daily card's credit line. */
export function sourceOf(principle: Principle): BookShelf {
  return LIBRARY.find((shelf) =>
    shelf.principles.some((p) => p.id === principle.id)
  )!;
}
