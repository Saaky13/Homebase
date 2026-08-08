import { CafeState } from './useCafeState';
import { GuideBeat, GuideContext, GUIDE_SCRIPT } from '../constants/guideScript';
import { getTodayDateKey } from '../utils/date';

export function buildGuideContext(
  state: CafeState,
  pathname: string,
  daysSinceLastOpen: number | null
): GuideContext {
  return {
    state,
    pathname,
    todayKey: getTodayDateKey(),
    hour: new Date().getHours(),
    name: state.userName,
    daysSinceLastOpen,
  };
}

/**
 * Picks the single highest-priority guide beat that's currently eligible:
 * not muted, not already-seen-and-one-time, past its cooldown if repeatable,
 * and its match() condition holds against the current context.
 */
export function resolveGuideMessage(ctx: GuideContext): GuideBeat | null {
  const { guide } = ctx.state;

  const eligible = GUIDE_SCRIPT.filter((beat) => {
    if (guide.mutedMessageIds.includes(beat.id)) return false;

    const alreadySeen = guide.seenMessageIds.includes(beat.id);

    if (alreadySeen) {
      if (!beat.repeatable) return false;

      const cooldownMs = (beat.cooldownHours ?? 20) * 60 * 60 * 1000;
      const lastSeenAt = guide.lastSeenAt[beat.id] ?? 0;
      if (Date.now() - lastSeenAt < cooldownMs) return false;
    }

    return beat.match(ctx);
  });

  if (!eligible.length) return null;

  eligible.sort((a, b) => b.priority - a.priority);
  return eligible[0];
}
