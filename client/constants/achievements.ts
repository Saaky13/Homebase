/**
 * Achievement definitions.
 *
 * Each achievement has a `check` function that receives the full CafeState and
 * returns whether it's been earned. Achievements are evaluated every time the
 * section renders — no polling, no listeners. Once earned they stay earned
 * forever (the conditions are monotonic: you can't un-serve a cat).
 *
 * Claiming an achievement awards its `pearlReward` once. The set of claimed ids
 * lives in `state.claimedAchievements`.
 */

import { SHOP_ITEMS } from './cafeData';
import { STARTER_CATS, TOTAL_CATS } from './gacha';

export type AchievementCategory =
  | 'habits'
  | 'focus'
  | 'cafe'
  | 'cats'
  | 'economy'
  | 'streaks';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  pearlReward: number;
  /** Return true when the achievement is earned. */
  check: (state: AchievementCheckState) => boolean;
}

/**
 * Slimmed-down view of CafeState that `check` receives. Keeps the dependency
 * on the full state interface out of this file — the caller maps once.
 */
export interface AchievementCheckState {
  totalHabits: number;
  totalFocusMinutes: number;
  totalDrinksServed: number;
  totalCoinsEarned: number;
  coins: number;
  pearls: number;
  level: number;
  popularity: number;
  unlockedItems: string[];
  longestStreak: number;         // max streak across all habits
  habitsWithStreak3: number;     // habits currently at 3+ day streak
  habitsWithStreak7: number;
  habitsWithStreak14: number;
  habitsWithStreak30: number;
  totalPearlsEarned: number;
  missionSet: boolean;
  totalReflections: number;      // days where reflection was completed
  totalMissionCheckIns: number;  // days where mission was checked in
  totalWeeklyReviews: number;    // weeks closed with a weekly review
  shopItemsOwned: number;        // owned items that are still sold in the Market
  catsOwned: number;             // size of the shelter collection, starters included
  legendaryCatsOwned: number;    // legendary + ultra, the two rarities worth bragging about
}

const ACHIEVEMENTS: AchievementDef[] = [
  // ── Habits ───────────────────────────────────────────────
  {
    id: 'first-habit',
    title: 'First Seed',
    description: 'Create your first habit',
    emoji: '🌱',
    category: 'habits',
    pearlReward: 10,
    check: (s) => s.totalHabits >= 1,
  },
  {
    id: 'three-habits',
    title: 'Growing Garden',
    description: 'Have 3 habits at once',
    emoji: '🌿',
    category: 'habits',
    pearlReward: 15,
    check: (s) => s.totalHabits >= 3,
  },
  {
    id: 'five-habits',
    title: 'Full Bloom',
    description: 'Have 5 habits at once',
    emoji: '🌸',
    category: 'habits',
    pearlReward: 25,
    check: (s) => s.totalHabits >= 5,
  },
  {
    id: 'mission-set',
    title: 'North Star',
    description: 'Write your mission statement',
    emoji: '✦',
    category: 'habits',
    pearlReward: 10,
    check: (s) => s.missionSet,
  },
  {
    id: 'reflect-7',
    title: 'Inner Mirror',
    description: 'Answer the daily reflection 7 times',
    emoji: '🪞',
    category: 'habits',
    pearlReward: 30,
    check: (s) => s.totalReflections >= 7,
  },
  {
    id: 'review-first',
    title: 'Week One, Closed',
    description: 'Complete your first weekly review',
    emoji: '🚩',
    category: 'habits',
    pearlReward: 20,
    check: (s) => s.totalWeeklyReviews >= 1,
  },
  {
    id: 'review-4',
    title: 'A Month in the Books',
    description: 'Close 4 weeks with a weekly review',
    emoji: '📖',
    category: 'streaks',
    pearlReward: 50,
    check: (s) => s.totalWeeklyReviews >= 4,
  },

  // ── Streaks ──────────────────────────────────────────────
  {
    id: 'streak-3',
    title: 'Three-Peat',
    description: 'Reach a 3-day streak on any habit',
    emoji: '🔥',
    category: 'streaks',
    pearlReward: 15,
    check: (s) => s.longestStreak >= 3,
  },
  {
    id: 'streak-7',
    title: 'Full Week',
    description: 'Reach a 7-day streak on any habit',
    emoji: '🔥',
    category: 'streaks',
    pearlReward: 30,
    check: (s) => s.longestStreak >= 7,
  },
  {
    id: 'streak-14',
    title: 'Fortnight',
    description: 'Reach a 14-day streak on any habit',
    emoji: '🔥',
    category: 'streaks',
    pearlReward: 50,
    check: (s) => s.longestStreak >= 14,
  },
  {
    id: 'streak-30',
    title: 'Monthly Master',
    description: 'Reach a 30-day streak on any habit',
    emoji: '👑',
    category: 'streaks',
    pearlReward: 100,
    check: (s) => s.longestStreak >= 30,
  },
  {
    id: 'multi-streak',
    title: 'Consistency Club',
    description: 'Have 3 habits at a 7+ day streak at once',
    emoji: '⭐',
    category: 'streaks',
    pearlReward: 50,
    check: (s) => s.habitsWithStreak7 >= 3,
  },

  // ── Focus ────────────────────────────────────────────────
  {
    id: 'focus-first',
    title: 'First Focus',
    description: 'Complete your first focus session',
    emoji: '⏱',
    category: 'focus',
    pearlReward: 10,
    check: (s) => s.totalFocusMinutes >= 1,
  },
  {
    id: 'focus-60',
    title: 'Hour Power',
    description: 'Accumulate 60 minutes of focus',
    emoji: '⏳',
    category: 'focus',
    pearlReward: 20,
    check: (s) => s.totalFocusMinutes >= 60,
  },
  {
    id: 'focus-300',
    title: 'Deep Worker',
    description: 'Accumulate 5 hours of focus',
    emoji: '🧠',
    category: 'focus',
    pearlReward: 40,
    check: (s) => s.totalFocusMinutes >= 300,
  },
  {
    id: 'focus-1000',
    title: 'Flow State',
    description: 'Accumulate 1,000 minutes of focus',
    emoji: '🌊',
    category: 'focus',
    pearlReward: 75,
    check: (s) => s.totalFocusMinutes >= 1000,
  },

  // ── Café ─────────────────────────────────────────────────
  {
    id: 'first-serve',
    title: 'First Customer',
    description: 'Serve your first cat',
    emoji: '🐱',
    category: 'cafe',
    pearlReward: 10,
    check: (s) => s.totalDrinksServed >= 1,
  },
  {
    id: 'serve-10',
    title: 'Regular Spot',
    description: 'Serve 10 cats',
    emoji: '☕',
    category: 'cafe',
    pearlReward: 20,
    check: (s) => s.totalDrinksServed >= 10,
  },
  {
    id: 'serve-50',
    title: 'Boba Boss',
    description: 'Serve 50 cats',
    emoji: '🧋',
    category: 'cafe',
    pearlReward: 40,
    check: (s) => s.totalDrinksServed >= 50,
  },
  {
    id: 'serve-100',
    title: 'Cat Whisperer',
    description: 'Serve 100 cats',
    emoji: '✨',
    category: 'cafe',
    pearlReward: 75,
    check: (s) => s.totalDrinksServed >= 100,
  },
  {
    id: 'popularity-50',
    title: 'Rising Star',
    description: 'Reach 50 popularity',
    emoji: '⬆',
    category: 'cafe',
    pearlReward: 30,
    check: (s) => s.popularity >= 50,
  },
  {
    id: 'popularity-100',
    title: 'Famous Café',
    description: 'Reach 100 popularity',
    emoji: '💫',
    category: 'cafe',
    pearlReward: 60,
    check: (s) => s.popularity >= 100,
  },

  // ── Economy ──────────────────────────────────────────────
  {
    id: 'coins-100',
    title: 'First Savings',
    description: 'Earn 100 coins total',
    emoji: '🪙',
    category: 'economy',
    pearlReward: 15,
    check: (s) => s.totalCoinsEarned >= 100,
  },
  {
    id: 'coins-500',
    title: 'Coin Hoarder',
    description: 'Earn 500 coins total',
    emoji: '💰',
    category: 'economy',
    pearlReward: 30,
    check: (s) => s.totalCoinsEarned >= 500,
  },
  {
    id: 'level-3',
    title: 'Thriving',
    description: 'Reach café level 3',
    emoji: '📈',
    category: 'economy',
    pearlReward: 25,
    check: (s) => s.level >= 3,
  },
  {
    id: 'level-5',
    title: 'Legendary Café',
    description: 'Reach café level 5',
    emoji: '🏆',
    category: 'economy',
    pearlReward: 75,
    check: (s) => s.level >= 5,
  },
  {
    id: 'shop-first',
    title: 'First Purchase',
    description: 'Buy something from the shop',
    emoji: '🛍',
    category: 'economy',
    pearlReward: 10,
    check: (s) => s.shopItemsOwned >= 1,
  },
  {
    id: 'shop-all',
    title: 'Collector',
    description: 'Own every shop item',
    emoji: '🎀',
    category: 'economy',
    pearlReward: 100,
    // Counted off the live catalogue rather than a literal — the Market lost
    // its three cats to the Cat Shelter, and a hardcoded 10 would have left
    // this achievement permanently out of reach.
    check: (s) => s.shopItemsOwned >= SHOP_ITEMS.length,
  },

  // ── Shelter ──────────────────────────────────────────────
  {
    id: 'cats-first-adoption',
    title: 'One More Mouth',
    description: 'Adopt your first cat from the shelter',
    emoji: '🐾',
    category: 'cats',
    pearlReward: 15,
    // The three starters arrive for free, so the first *adoption* is the fourth cat.
    check: (s) => s.catsOwned > STARTER_CATS.length,
  },
  {
    id: 'cats-ten',
    title: 'A Proper Clowder',
    description: 'Have 10 cats in your collection',
    emoji: '🐱',
    category: 'cats',
    pearlReward: 30,
    check: (s) => s.catsOwned >= 10,
  },
  {
    id: 'cats-legendary',
    title: 'Rare Company',
    description: 'Adopt a legendary or ultra cat',
    emoji: '👑',
    category: 'cats',
    pearlReward: 60,
    check: (s) => s.legendaryCatsOwned >= 1,
  },
  {
    id: 'cats-all',
    title: 'Every Cat A Home',
    description: `Adopt all ${TOTAL_CATS} cats`,
    emoji: '🏠',
    category: 'cats',
    pearlReward: 150,
    check: (s) => s.catsOwned >= TOTAL_CATS,
  },
];

export interface AchievementCategoryDef {
  id: AchievementCategory;
  label: string;
  emoji: string;
  /** Fill for an earned card, matching the habit-tier tint/ink convention. */
  tint: string;
  /** Border and hard-offset shadow colour for an earned card. */
  edge: string;
  /** Text colour that reads against `tint`. */
  ink: string;
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategoryDef[] = [
  { id: 'habits', label: 'Habits', emoji: '🌱', tint: '#D9F5EA', edge: '#9FD5BF', ink: '#2F6B54' },
  { id: 'streaks', label: 'Streaks', emoji: '🔥', tint: '#FFDDBF', edge: '#E8B38E', ink: '#8A5A33' },
  { id: 'focus', label: 'Focus', emoji: '⏱', tint: '#CFEAFF', edge: '#8FC2E1', ink: '#38617D' },
  { id: 'cafe', label: 'Café', emoji: '☕', tint: '#FFD7EA', edge: '#E7A9C8', ink: '#8A4A67' },
  { id: 'cats', label: 'Cats', emoji: '🐾', tint: '#DDD2FF', edge: '#B8A5EF', ink: '#4C3A7A' },
  { id: 'economy', label: 'Economy', emoji: '🪙', tint: '#FFF0BE', edge: '#E4C983', ink: '#7A6230' },
];

export const CATEGORY_BY_ID: Record<AchievementCategory, AchievementCategoryDef> =
  ACHIEVEMENT_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {} as Record<AchievementCategory, AchievementCategoryDef>);

export default ACHIEVEMENTS;
