/**
 * Who is in the café right now.
 *
 * The café's queue used to live in `CafeCanvas` as a local array, rebuilt from
 * nothing every time the screen mounted. That made two things impossible: the
 * town map couldn't know anyone was waiting, and a cat could be seen running
 * across town while the same cat stood in the café line — the collection is one
 * pool of cats, and both simulations were drawing from it independently.
 *
 * So presence is state now, and it is the *only* authority on where a cat is.
 * The café screen renders this list, the town map renders its complement, and
 * neither one invents a cat of its own.
 *
 * A visit is a fixed lifecycle, and the state records just two moments of it:
 *
 *   sets off ──(WALK_IN_MS)──▶ in line ──served──▶ lingers ──(LINGER_MS)──▶ gone
 *   `setOffAt`                            `servedAt`
 *
 * Everything in between is *derived from the clock*, never stored: a customer
 * is "walking over" until `WALK_IN_MS` after it set off, "in line" after that,
 * and swept out by the settle `LINGER_MS` after it was served. Deriving the
 * phase means the town map and the café can each ask "where is this cat right
 * now?" and get the same answer without anything having written state — a cat
 * reaching the door is not an event, it's a timestamp going stale.
 *
 * Arrivals are settled the way popularity and the greenhouse are settled: a
 * pure function of elapsed time, run on whatever screen happens to be open, so
 * the café fills at the same rate whether you are watching it or not.
 */

import { maxGroupSize, spawnIntervalMs } from './popularity';

/** One cat's visit. Lives from setting off to walking back out. */
export interface CafeCustomer {
  /** Unique per *visit* — the same cat gets a new one each time it comes in. */
  id: string;
  /** Roster id. What the sprite is drawn from, and who this is in the town. */
  catId: string;
  /** Cats arrive together and sit at the same table. */
  groupId: string;
  /** ms epoch this cat set off for the café. In line `WALK_IN_MS` later. */
  setOffAt: number;
  /** ms epoch it was handed a cup, or null while it's still in line. */
  servedAt: number | null;
}

export interface CafeVisitState {
  customers: CafeCustomer[];
  /** ms epoch the arrival clock has been advanced to. */
  lastArrivalAt: number;
  /**
   * How many groups have ever set off. Doubles as the id source and as the
   * seed for the draw — see `roll`.
   */
  arrivalSeq: number;
}

/**
 * How many cats can stand in line.
 *
 * Matches the number of spots `getQueueSpots` lays out. The café clamps to the
 * real spot count as well, so a change there can only ever leave capacity here
 * unused rather than stranding a customer with nowhere to stand.
 */
export const QUEUE_CAPACITY = 9;

/**
 * How long a cat takes to get from "called in" to standing in line.
 *
 * This one number is what both screens animate against: the town map walks the
 * roamer to the café door inside this window (leaving cats hurry, so they make
 * it), and the café spawns the cat through its own door the moment the window
 * closes. A customer whose window already closed before you looked — a
 * catch-up arrival from while the app was shut — is simply in line, which is
 * exactly the "been waiting a while" behaviour the queue wants.
 */
export const WALK_IN_MS = 15000;

/**
 * How far apart cats from the same group set off.
 *
 * A group used to share one `setOffAt`, and since joining the line is that
 * timestamp going stale, the whole group joined in the same instant: the café
 * door badge jumped straight from 0 to 3, and the café floor spawned three
 * cats through the door in one frame, marching in a stack. Spacing the
 * departures makes every derived view single-file for free — the badge ticks
 * 1, 2, 3 and the door admits one cat at a time — without adding any state or
 * a second rule: it is still just `setOffAt` going stale, per cat.
 */
export const WALK_STAGGER_MS = 3000;

/** How long a served cat sits with its drink before heading home. */
export const LINGER_MS = 60000;

/**
 * How many cats may be in the café at once — waiting *or* sitting.
 *
 * Without a ceiling, "the line fills and holds" plus a small collection meant
 * every cat you own ended up inside after half an hour away, and the town map
 * opened onto empty streets. Half the collection may visit at a time; the
 * other half keeps the town alive. The queue capacity still binds once the
 * collection outgrows it.
 */
export function maxInside(ownedCount: number): number {
  return Math.min(QUEUE_CAPACITY, Math.max(1, Math.ceil(ownedCount / 2)));
}

export const emptyCafeVisit = (): CafeVisitState => ({
  customers: [],
  lastArrivalAt: 0,
  arrivalSeq: 0,
});

/**
 * Deterministic 0–1 from an integer.
 *
 * Settling runs inside a state updater, and React may invoke an updater more
 * than once for a single commit — with `Math.random()` the second run would
 * draw a different cat than the first and the two would disagree about who
 * walked in. Seeding off `arrivalSeq` makes a re-run produce the identical
 * result. Same trick, same reason, as `town/map.ts`'s `noise`.
 */
function roll(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Whether this customer has finished the walk over and is standing in line. */
export function hasJoined(customer: CafeCustomer, now: number): boolean {
  return now - customer.setOffAt >= WALK_IN_MS;
}

/** Cats standing in line right now — what the café-door badge counts. */
export function countWaiting(visit: CafeVisitState, now: number): number {
  let n = 0;
  for (const c of visit.customers) {
    if (c.servedAt === null && hasJoined(c, now)) n++;
  }
  return n;
}

/**
 * Roster ids inside the café — in line or at a table — and therefore not out
 * in the town.
 */
export function catsInside(visit: CafeVisitState, now: number): Set<string> {
  const set = new Set<string>();
  for (const c of visit.customers) {
    if (hasJoined(c, now)) set.add(c.catId);
  }
  return set;
}

/**
 * Roster ids on their way over — still out in the town, but headed for the
 * café door. The town map walks these; the café doesn't draw them yet.
 */
export function catsEnRoute(visit: CafeVisitState, now: number): Set<string> {
  const set = new Set<string>();
  for (const c of visit.customers) {
    if (!hasJoined(c, now)) set.add(c.catId);
  }
  return set;
}

/**
 * Advances the café to `now`: sends home anyone who has finished their drink,
 * then walks the arrival clock forward and calls cats in.
 *
 * Returns the *same object* when nothing changed, so the caller can bail out of
 * its commit rather than re-rendering two canvases on a five-second tick.
 */
export function settleCafeVisit(
  visit: CafeVisitState,
  now: number,
  popularity: number,
  ownedCats: string[]
): CafeVisitState {
  const interval = spawnIntervalMs(popularity);
  const cap = maxInside(ownedCats.length);

  // Finished their cup and gone home. This is the only way a served cat
  // leaves, on either screen — the café animates the walk-out off the back of
  // it, and the town respawns the roamer at the café door off the same change.
  const customers = visit.customers.filter(
    (c) => c.servedAt === null || now - c.servedAt < LINGER_MS
  );
  let changed = customers.length !== visit.customers.length;

  // A save from before this existed, or a clock that has gone backwards. Start
  // one interval back so the first cat sets off right away rather than three
  // minutes out.
  const anchor =
    visit.lastArrivalAt > 0 && visit.lastArrivalAt <= now
      ? visit.lastArrivalAt
      : now - interval;

  // A week away is the same as ten minutes away: the café only holds so many,
  // and the rest of the town's cats were never going to fit. Rewinding to just
  // enough intervals to fill it keeps the loop bounded without pretending the
  // absence didn't happen.
  let cursor = Math.max(anchor, now - interval * (QUEUE_CAPACITY + 1));
  let seq = visit.arrivalSeq;

  while (cursor + interval <= now) {
    cursor += interval;

    // Unserved customers hold a line spot whether they've reached it yet or
    // not — a spot is claimed the moment a cat sets off, or the settle could
    // call in twelve cats for nine spots while they were all mid-walk.
    const unserved = customers.filter((c) => c.servedAt === null).length;
    const room = Math.min(QUEUE_CAPACITY - unserved, cap - customers.length);
    // The clock keeps running against a full café — the door just doesn't open.
    if (room <= 0) continue;

    // A cat can't visit twice at once: anyone already here (or on the way) is
    // out of the draw. Everyone else is fair game.
    const here = new Set(customers.map((c) => c.catId));
    const pool = ownedCats.filter((id) => !here.has(id));
    if (!pool.length) continue;

    // Busier cafés draw bigger groups, not just more of them.
    const size = Math.min(
      1 + Math.floor(roll(seq) * maxGroupSize(popularity)),
      room,
      pool.length
    );

    const groupId = `visit-${seq}`;
    for (let i = 0; i < size; i++) {
      const pick = pool.splice(Math.floor(roll(seq * 31 + i * 7 + 1) * pool.length), 1)[0];
      customers.push({
        id: `${groupId}-${i}`,
        catId: pick,
        groupId,
        // Staggered, so the group files in one cat at a time — see
        // WALK_STAGGER_MS. A tail member's departure can sit slightly in the
        // future until its turn comes; pruneCustomers knows to allow that.
        setOffAt: cursor + i * WALK_STAGGER_MS,
        servedAt: null,
      });
    }

    seq += 1;
    changed = true;
  }

  if (!changed && cursor === visit.lastArrivalAt) return visit;

  return { customers, lastArrivalAt: cursor, arrivalSeq: seq };
}

/** Marks customers as served, so they stop queueing and start drinking. */
export function markServed(
  visit: CafeVisitState,
  ids: string[],
  now: number
): CafeVisitState {
  if (!ids.length) return visit;
  const set = new Set(ids);

  let touched = false;
  const customers = visit.customers.map((c) => {
    if (!set.has(c.id) || c.servedAt !== null) return c;
    touched = true;
    return { ...c, servedAt: now };
  });

  return touched ? { ...visit, customers } : visit;
}

/**
 * Launders the customer list on load: drops customers whose cat is no longer
 * in the collection, duplicates of the same cat, and entries whose timestamps
 * are malformed or from a clock that has since gone backwards. None of these
 * should be reachable — `settleCafeVisit` filters the pool both ways and only
 * ever stamps the present — but a save is forever, and a broken customer would
 * either double a cat on screen or stand "walking over" for eternity, so the
 * load path validates the list rather than trusting it.
 */
export function pruneCustomers(
  visit: CafeVisitState,
  ownedCats: string[],
  now: number
): CafeVisitState {
  const owned = new Set(ownedCats);
  const seen = new Set<string>();

  // A staggered group member legitimately has its departure a few seconds in
  // the future (see WALK_STAGGER_MS); only a stamp beyond the deepest possible
  // stagger is garbage.
  const latestValidSetOff = now + QUEUE_CAPACITY * WALK_STAGGER_MS;

  const customers = visit.customers.filter((c) => {
    if (!owned.has(c.catId) || seen.has(c.catId)) return false;
    if (!Number.isFinite(c.setOffAt) || c.setOffAt > latestValidSetOff) return false;
    if (c.servedAt !== null && (!Number.isFinite(c.servedAt) || c.servedAt > now)) return false;
    seen.add(c.catId);
    return true;
  });

  return customers.length === visit.customers.length ? visit : { ...visit, customers };
}
