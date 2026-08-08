export const CATS_DATA = [
  { name: 'Luna', emoji: '🐈‍⬛', type: 'cat-black' },
  { name: 'Whiskers', emoji: '🧡', type: 'cat-orange' },
  { name: 'Mittens', emoji: '🤍', type: 'cat-white' },
  { name: 'Sage', emoji: '💚', type: 'cat-green' },
  { name: 'Jazz', emoji: '🟠', type: 'cat-ginger' },
  { name: 'Shadow', emoji: '⬛', type: 'cat-shadow' },
  { name: 'Sunny', emoji: '🌟', type: 'cat-sunny' },
];

export const SHOP_ITEMS = [
  {
    id: 'cat-orange',
    title: 'Orange Cat',
    emoji: '🧡',
    price: 50,
    category: 'cats',
  },
  {
    id: 'cat-white',
    title: 'White Cat',
    emoji: '⚪',
    price: 50,
    category: 'cats',
  },
  {
    id: 'cat-green',
    title: 'Green Cat',
    emoji: '💚',
    price: 50,
    category: 'cats',
  },
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

export const REFLECTION_PROMPTS = [
  {
    question: 'How aligned were you with your mission today?',
    options: [
      { id: 'perfect', label: 'Completely aligned 🎯', pearls: 5 },
      { id: 'good', label: 'Mostly aligned 📈', pearls: 4 },
      { id: 'trying', label: 'Getting there 🌱', pearls: 3 },
      { id: 'reset', label: 'Reset day, that\'s okay 💭', pearls: 2 },
    ],
  },
  {
    question: 'What was your biggest win today?',
    options: [
      { id: 'focus', label: 'Stayed focused longer 🔥', pearls: 5 },
      { id: 'health', label: 'Took care of myself 💪', pearls: 4 },
      { id: 'learn', label: 'Learned something new 🧠', pearls: 4 },
      { id: 'connection', label: 'Connected with someone 🤝', pearls: 3 },
    ],
  },
  {
    question: 'How did you handle challenges today?',
    options: [
      { id: 'overcame', label: 'Overcame obstacles 💪', pearls: 5 },
      { id: 'adapted', label: 'Adapted and adjusted 🔄', pearls: 4 },
      { id: 'rested', label: 'Took a break when needed 🌙', pearls: 3 },
      { id: 'learning', label: 'Still learning how 📚', pearls: 2 },
    ],
  },
  {
    question: 'How did your focus sessions go today?',
    options: [
      { id: 'amazing', label: 'Amazing—fully immersed ✨', pearls: 5 },
      { id: 'good', label: 'Good—steady progress 📈', pearls: 4 },
      { id: 'okay', label: 'Okay—some distractions 🤔', pearls: 3 },
      { id: 'tough', label: 'Tough—but I tried 💪', pearls: 2 },
    ],
  },
];

export const CAFE_LEVELS = [
  { level: 1, name: 'Just Opening', emoji: '🧋', description: 'A tiny café just starting out' },
  { level: 2, name: 'Growing', emoji: '☕', description: 'More customers, more charm' },
  { level: 3, name: 'Thriving', emoji: '🏪', description: 'A cozy gathering place' },
  { level: 4, name: 'Bustling', emoji: '🌟', description: 'Everyone knows your place' },
  { level: 5, name: 'Legendary', emoji: '👑', description: 'The best café in town' },
];
