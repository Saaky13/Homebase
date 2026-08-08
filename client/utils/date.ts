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
 * Counts consecutive completed days for a habit, walking backward starting
 * at (and including) fromDateKey for as long as each day is present.
 */
export function computeHabitStreak(
  habitLogs: Record<string, string[]>,
  habitId: string,
  fromDateKey: string
): number {
  let streak = 0;
  let cursor = fromDateKey;

  while (true) {
    const completedIds = habitLogs[cursor] ?? [];
    if (!completedIds.includes(habitId)) break;
    streak += 1;
    cursor = getPreviousDateKey(cursor);
  }

  return streak;
}
