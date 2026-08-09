// Shared date-key helpers. Every screen that needs to key data off calendar
// days (habits, mission check-ins, daily stats, the guide system) should go
// through these instead of re-implementing the same formatting/streak logic.

export function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDateKey(year: number, month: number, day: number): string {
  return formatDateKey(new Date(year, month, day));
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

export function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return formatDateKey(date);
}

export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * Habit logs map a date key to per-habit rep counts for that day.
 */
export type HabitLogs = Record<string, Record<string, number>>;

export function repsOn(logs: HabitLogs, dateKey: string, habitId: string): number {
  return logs[dateKey]?.[habitId] ?? 0;
}

/**
 * Counts consecutive *fully completed* days for a habit, walking backward
 * starting at (and including) fromDateKey. A day only counts once the habit
 * hit its full daily cap — partial progress keeps the pearls it earned but
 * doesn't extend a streak.
 */
export function computeHabitStreak(
  habitLogs: HabitLogs,
  habitId: string,
  fromDateKey: string,
  timesPerDay: number
): number {
  const cap = Math.max(1, timesPerDay);
  let streak = 0;
  let cursor = fromDateKey;

  while (repsOn(habitLogs, cursor, habitId) >= cap) {
    streak += 1;
    cursor = getPreviousDateKey(cursor);
  }

  return streak;
}
