export const CATS_DATA = [
  { name: 'Luna', emoji: '🐈‍⬛', type: 'cat-black' },
  { name: 'Whiskers', emoji: '🧡', type: 'cat-orange' },
  { name: 'Mittens', emoji: '🤍', type: 'cat-white' },
  { name: 'Sage', emoji: '💚', type: 'cat-green' },
  { name: 'Jazz', emoji: '🟠', type: 'cat-ginger' },
  { name: 'Shadow', emoji: '⬛', type: 'cat-shadow' },
  { name: 'Sunny', emoji: '🌟', type: 'cat-sunny' },
];

// The Market used to sell three cats that only ever incremented a counter.
// Cats now come from the Cat Shelter, where they're real roster cats you
// actually own. Existing saves migrate their purchases into the collection —
// see seedOwnedCats in constants/gacha.ts.
export const SHOP_ITEMS = [
  {
    id: 'flavor-mango',
    title: 'Mango Boba',
    emoji: '🥭',
    price: 30,
    category: 'flavors',
  },
  {
    id: 'flavor-taro',
    title: 'Taro Boba',
    emoji: '🟣',
    price: 30,
    category: 'flavors',
  },
  {
    id: 'decor-plants',
    title: 'Plant Decor',
    emoji: '🌿',
    price: 40,
    category: 'decor',
  },
  {
    id: 'decor-lights',
    title: 'String Lights',
    emoji: '✨',
    price: 60,
    category: 'decor',
  },
  {
    id: 'decor-paintings',
    title: 'Wall Art',
    emoji: '🖼️',
    price: 50,
    category: 'decor',
  },
  {
    id: 'upgrade-seating',
    title: 'Better Seating',
    emoji: '🪑',
    price: 100,
    category: 'upgrades',
  },
  {
    id: 'upgrade-counter',
    title: 'Modern Counter',
    emoji: '🏪',
    price: 120,
    category: 'upgrades',
  },
];

/**
 * Every option pays the same 4 pearls, on purpose. The old set paid 5 for
 * "completely aligned" and 2 for "reset day", which bribed the player to pick
 * the flattering answer on the one screen whose entire value is honesty. The
 * reward is for reflecting at all; the day you had doesn't change the rate.
 */
export const REFLECTION_PEARLS = 4;

export const REFLECTION_PROMPTS = [
  {
    question: 'How aligned were you with your mission today?',
    options: [
      { id: 'perfect', label: 'Completely aligned 🎯', pearls: REFLECTION_PEARLS },
      { id: 'good', label: 'Mostly aligned 📈', pearls: REFLECTION_PEARLS },
      { id: 'trying', label: 'Getting there 🌱', pearls: REFLECTION_PEARLS },
      { id: 'reset', label: 'Reset day, that\'s okay 💭', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'What was your biggest win today?',
    options: [
      { id: 'focus', label: 'Stayed focused longer 🔥', pearls: REFLECTION_PEARLS },
      { id: 'health', label: 'Took care of myself 💪', pearls: REFLECTION_PEARLS },
      { id: 'learn', label: 'Learned something new 🧠', pearls: REFLECTION_PEARLS },
      { id: 'connection', label: 'Connected with someone 🤝', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'How did you handle the hardest moment today?',
    options: [
      { id: 'overcame', label: 'Pushed through it 💪', pearls: REFLECTION_PEARLS },
      { id: 'adapted', label: 'Adapted and adjusted 🔄', pearls: REFLECTION_PEARLS },
      { id: 'rested', label: 'Stepped back and rested 🌙', pearls: REFLECTION_PEARLS },
      { id: 'learning', label: 'It got me today 📚', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'How did your focus go today?',
    options: [
      { id: 'amazing', label: 'Fully immersed ✨', pearls: REFLECTION_PEARLS },
      { id: 'good', label: 'Steady progress 📈', pearls: REFLECTION_PEARLS },
      { id: 'okay', label: 'Some distractions 🤔', pearls: REFLECTION_PEARLS },
      { id: 'tough', label: 'Couldn\'t settle in 🌊', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'What did your energy look like today?',
    options: [
      { id: 'charged', label: 'Charged up all day ⚡', pearls: REFLECTION_PEARLS },
      { id: 'steady', label: 'Steady and even 🌤', pearls: REFLECTION_PEARLS },
      { id: 'low', label: 'Ran low by afternoon 🪫', pearls: REFLECTION_PEARLS },
      { id: 'fumes', label: 'Running on fumes 😮‍💨', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'Who got the best of your attention today?',
    options: [
      { id: 'work', label: 'My real work 🎯', pearls: REFLECTION_PEARLS },
      { id: 'people', label: 'People I care about 🤝', pearls: REFLECTION_PEARLS },
      { id: 'phone', label: 'My phone, honestly 📱', pearls: REFLECTION_PEARLS },
      { id: 'worries', label: 'My worries 🌀', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'What would tomorrow-you thank you for?',
    options: [
      { id: 'started', label: 'Starting the hard thing 🌅', pearls: REFLECTION_PEARLS },
      { id: 'finished', label: 'Finishing something 🏁', pearls: REFLECTION_PEARLS },
      { id: 'rested', label: 'Actually resting 🛋', pearls: REFLECTION_PEARLS },
      { id: 'showed', label: 'Showing up at all 🚪', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'What almost stopped you today?',
    options: [
      { id: 'distraction', label: 'Distraction 🎪', pearls: REFLECTION_PEARLS },
      { id: 'doubt', label: 'Doubt 🌫', pearls: REFLECTION_PEARLS },
      { id: 'tired', label: 'Tiredness 😴', pearls: REFLECTION_PEARLS },
      { id: 'nothing', label: 'Nothing, today was clean ✅', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'If today repeated for a year, where would you land?',
    options: [
      { id: 'great', label: 'Somewhere great 🏔', pearls: REFLECTION_PEARLS },
      { id: 'ahead', label: 'A little ahead 📈', pearls: REFLECTION_PEARLS },
      { id: 'same', label: 'About where I am 🔁', pearls: REFLECTION_PEARLS },
      { id: 'behind', label: 'Somewhere I don\'t want 🥀', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'What did you learn about yourself today?',
    options: [
      { id: 'capable', label: 'I\'m more capable than I thought 💪', pearls: REFLECTION_PEARLS },
      { id: 'rest', label: 'I need more rest than I admit 🌙', pearls: REFLECTION_PEARLS },
      { id: 'avoid', label: 'I dodge hard starts 🙈', pearls: REFLECTION_PEARLS },
      { id: 'figuring', label: 'Still figuring it out 🧭', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'Which habit felt lightest today?',
    options: [
      { id: 'tiny', label: 'The tiny one 🌱', pearls: REFLECTION_PEARLS },
      { id: 'anchored', label: 'The one with a fixed time ⏰', pearls: REFLECTION_PEARLS },
      { id: 'none', label: 'None felt light today 🪨', pearls: REFLECTION_PEARLS },
      { id: 'skipped', label: 'Didn\'t get to them 💭', pearls: REFLECTION_PEARLS },
    ],
  },
  {
    question: 'What deserves more of you tomorrow?',
    options: [
      { id: 'rock', label: 'The one big thing 🪨', pearls: REFLECTION_PEARLS },
      { id: 'health', label: 'My body 💪', pearls: REFLECTION_PEARLS },
      { id: 'someone', label: 'Someone I\'ve been missing 💌', pearls: REFLECTION_PEARLS },
      { id: 'sleep', label: 'My own sleep 🌙', pearls: REFLECTION_PEARLS },
    ],
  },
];

/**
 * Picks the prompt for a given day. Rotating on the date key means every
 * prompt gets used across the week instead of the list sitting dead behind
 * index 0, and it stays stable for the whole day so re-opening the section
 * doesn't reshuffle the question mid-answer.
 */
export function getReflectionPromptForDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const index =
    ((daysSinceEpoch % REFLECTION_PROMPTS.length) + REFLECTION_PROMPTS.length) %
    REFLECTION_PROMPTS.length;
  return REFLECTION_PROMPTS[index];
}

export const CAFE_LEVELS = [
  { level: 1, name: 'Just Opening', emoji: '🧋', description: 'A tiny café just starting out' },
  { level: 2, name: 'Growing', emoji: '☕', description: 'More customers, more charm' },
  { level: 3, name: 'Thriving', emoji: '🏪', description: 'A cozy gathering place' },
  { level: 4, name: 'Bustling', emoji: '🌟', description: 'Everyone knows your place' },
  { level: 5, name: 'Legendary', emoji: '👑', description: 'The best café in town' },
];
