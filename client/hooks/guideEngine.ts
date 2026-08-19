import type { CafeState } from './useCafeState';
import { GUIDE_SCRIPT, type GuideBeat, type GuideContext } from '../constants/guideScript';
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

/**
 * The ids of one-time `moment` beats that are *already* true for this save.
 *
 * Moments celebrate something happening ("you created a habit", "you served a
 * cat"), but they're matched against state that stays true forever afterwards.
 * A save that predates the beat — or predates the guide entirely — therefore
 * satisfies a whole stack of them at once, and the overlay dutifully fires
 * them one after another, four seconds apart, congratulating you for things
 * you did weeks ago while you're trying to use a completely different screen.
 * That is the single loudest way this system misbehaves.
 *
 * So a save runs this once and records the lot as already seen. Nothing is
 * shown; the beats are simply spent. A genuinely fresh save matches none of
 * them and loses nothing.
 *
 * Repeatable moments are deliberately excluded — `welcome-back` and `level-up`
 * are supposed to recur, and marking them seen would just start their cooldown
 * for no reason. `level-up` is handled separately by rolling
 * `lastAcknowledgedLevel` up to the current level.
 *
 * The context is built with an empty pathname because no `moment` matcher
 * reads the route; orientation beats do, and they must never be caught up —
 * you haven't seen a room just because you own the building.
 */
export function catchUpSeenIds(state: CafeState): string[] {
  const ctx = buildGuideContext(state, '', null);

  return GUIDE_SCRIPT.filter(
    (beat) => beat.kind === 'moment' && !beat.repeatable && beat.match(ctx)
  ).map((beat) => beat.id);
}
