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
 *   `setOffAt`                   │        `servedAt`
 *                                └──(patienceMs)──▶ walks out unserved
 *
 * Everything in between is *derived from the clock*, never stored: a customer
 * is "walking over" until `WALK_IN_MS` after it set off, "in line" after that,
 * swept out by the settle `LINGER_MS` after it was served — or swept out
 * unserved once it has stood in line for `patienceMs`. Deriving the phase
 * means the town map and the café can each ask "where is this cat right now?"
 * and get the same answer without anything having written state — a cat
 * reaching the door is not an event, it's a timestamp going stale, and so is a
 * cat giving up on you.
 *
 * Arrivals are settled the way popularity and the greenhouse are settled: a
 * pure function of elapsed time, run on whatever screen happens to be open, so
 * the café fills at the same rate whether you are watching it or not.
 */

import { MAX_PATIENCE_MS, patienceWindowMs } from './bonds';
import type { CatStat } from './catLore';
import { getCat } from './catSprites';
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
  /**
   * How long this cat will stand in line before giving up, stamped when it was
   * called in.
   *
   * The one thing about a visit that is *stored* rather than derived, and for
   * the same reason `recordCatsServed` takes the drink: it can't be recovered
   * afterwards. The window comes from this cat's bond at the moment it set off
   * (see `patienceWindowMs` in `bonds.ts`), and a bond moves — derive it live
   * and serving a cat would retroactively extend the wait of the cat standing
   * behind it, and a levelling serve would make a cat already out the door
   * un-leave. Stamped once, `setOffAt + WALK_IN_MS + patienceMs` is a fixed
   * instant, and the phase is still just the clock passing it.
   */
  patienceMs: number;
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

/**
 * The window this particular cat walks in with.
 *
 * Patience is per-cat now, not per-café: rarity sets the base and the bond you
 * have built with *that* cat multiplies it. A cat missing from the roster or
 * from `catStats` falls back to a common at bond zero, which is the most
 * forgiving answer available and therefore the right one to guess with.
 */
function windowFor(catId: string, catStats: Record<string, CatStat>): number {
  const rarity = getCat(catId)?.rarity ?? 'common';
  return patienceWindowMs(catStats[catId]?.bondXp ?? 0, rarity);
}

/** Whether this customer has finished the walk over and is standing in line. */
export function hasJoined(customer: CafeCustomer, now: number): boolean {
  return now - customer.setOffAt >= WALK_IN_MS;
}

/**
 * The instant this cat gives up and walks out, if it hasn't been served by
 * then. Its patience is spent standing in line, so the walk over doesn't
 * count against it.
 */
export function leavesAt(customer: CafeCustomer): number {
  return customer.setOffAt + WALK_IN_MS + customer.patienceMs;
}

/** Waited too long and gone. A served cat can never walk out — it has its cup. */
export function hasWalkedOut(customer: CafeCustomer, now: number): boolean {
  return customer.servedAt === null && now >= leavesAt(customer);
}

/** Sat with its drink long enough and headed home. */
export function hasFinished(customer: CafeCustomer, now: number): boolean {
  return customer.servedAt !== null && now - customer.servedAt >= LINGER_MS;
}

/**
 * How much patience this cat has left, 1 on arrival down to 0 at the door.
 *
 * Only meaningful for a cat in line; a cat still walking over reads 1 and a
 * served one reads 1 forever, which is what the café wants — neither of them
 * should be wearing a timer.
 */
export function patienceLeft(customer: CafeCustomer, now: number): number {
  if (customer.servedAt !== null) return 1;
  const spent = (now - customer.setOffAt - WALK_IN_MS) / customer.patienceMs;
  return Math.min(1, Math.max(0, 1 - spent));
}

/**
 * Customers who have run out of patience as of `now` and are about to be swept.
 *
 * Read *before* settling, so the caller can charge for them: the settle
 * removes them, and once removed there is nothing left to count. Both are pure
 * derivations off the same clock, so passing the same `now` to each guarantees
 * they agree about who left.
 */
export function impatientCustomers(
  visit: CafeVisitState,
  now: number
): CafeCustomer[] {
  return visit.customers.filter((c) => hasWalkedOut(c, now));
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
  ownedCats: string[],
  catStats: Record<string, CatStat>
): CafeVisitState {
  const interval = spawnIntervalMs(popularity);
  const cap = maxInside(ownedCats.length);

  // Two ways out, and both are a timestamp going stale rather than an event:
  // the cup is finished, or the wait ran out. This is the only way a cat
  // leaves on either screen — the café animates the walk-out off the back of
  // the list changing, and the town respawns the roamer at the café door off
  // the same change, which is why a cat that gives up needed no new plumbing.
  const customers = visit.customers.filter(
    (c) => !hasFinished(c, now) && !hasWalkedOut(c, now)
  );
  let changed = customers.length !== visit.customers.length;

  // A save from before this existed, or a clock that has gone backwards. Start
  // one interval back so the first cat sets off right away rather than three
  // minutes out.
  const anchor =
    visit.lastArrivalAt > 0 && visit.lastArrivalAt <= now
      ? visit.lastArrivalAt
      : now - interval;

  // A week away is the same as four hours away, and patience is why: a cat
  // called in longer ago than the longest window anyone has has provably left
  // already, so replaying it would only be a loop iteration that ends in the
  // sweep below. `MAX_PATIENCE_MS`, not this café's typical window — the bound
  // has to hold for whichever cat the draw happens to pick, and guessing low
  // would silently drop a patient cat that was still owed its spot.
  //
  // This is the visible cost of the rule. The café doesn't hold a line for you
  // indefinitely — leave it overnight and you come back to whoever turned up in
  // the last few hours, not to everyone who ever knocked.
  const survivable =
    WALK_IN_MS + MAX_PATIENCE_MS + QUEUE_CAPACITY * WALK_STAGGER_MS;
  let cursor = Math.max(anchor, now - survivable);
  let seq = visit.arrivalSeq;

  while (cursor + interval <= now) {
    cursor += interval;

    // Unserved customers hold a line spot whether they've reached it yet or
    // not — a spot is claimed the moment a cat sets off, or the settle could
    // call in twelve cats for nine spots while they were all mid-walk.
    //
    // Occupancy is asked as of `cursor`, not of `now`, so a catch-up plays out
    // in order: a cat called in early in a long absence frees its spot part
    // way through, exactly as it would have if anyone had been watching. Asked
    // as of `now` instead, a queue of cats who left hours ago would block the
    // whole rewind and you'd come back to an empty café.
    let waiting = 0;
    let present = 0;
    for (const c of customers) {
      if (hasWalkedOut(c, cursor)) continue;
      present++;
      if (c.servedAt === null) waiting++;
    }

    const room = Math.min(QUEUE_CAPACITY - waiting, cap - present);
    // The clock keeps running against a full café — the door just doesn't open.
    if (room <= 0) continue;

    // A cat can't visit twice at once: anyone already here (or on the way) is
    // out of the draw. One that walked out earlier in this same catch-up is
    // back in it, though — it left, and coming back later is a second visit.
    const here = new Set(
      customers.filter((c) => !hasWalkedOut(c, cursor)).map((c) => c.catId)
    );
    const pool = ownedCats.filter((id) => !here.has(id));
    if (!pool.length) continue;

    // Busier cafés draw bigger groups, not just more of them.
    const size = Math.min(
      1 + Math.floor(roll(seq) * maxGroupSize(popularity)),
      room,
      pool.length
    );

    // The queue does not necessarily empty from the front, and that is the
    // point of the feature rather than a flaw in it. A window used to be
    // floored at the deadline of whoever was last to leave, so the line always
    // drained in order; per-cat patience makes that floor a contradiction —
    // flooring Prism's half hour at the four hours a well-bonded common is
    // owed would erase the difference the mechanic exists to express.
    //
    // So a cat leaves on its own clock and can leave from the middle of the
    // line. `CafeCanvas` already draws that honestly: a departing cat steps
    // sideways into the aisle before heading for the door, so the sprite you
    // watch leave is the one that actually gave up, wherever it was standing.
    const groupId = `visit-${seq}`;
    for (let i = 0; i < size; i++) {
      const pick = pool.splice(Math.floor(roll(seq * 31 + i * 7 + 1) * pool.length), 1)[0];
      // Staggered, so the group files in one cat at a time — see
      // WALK_STAGGER_MS. A tail member's departure can sit slightly in the
      // future until its turn comes; pruneCustomers knows to allow that.
      const setOffAt = cursor + i * WALK_STAGGER_MS;
      const patience = windowFor(pick, catStats);

      // What the clock alone says: set off, walked in, stood there `patience`.
      const natural = setOffAt + WALK_IN_MS + patience;

      // A cat admitted by a catch-up set off in the *past*, so a replay can
      // land one on the mat with a minute left — you open the app, tap it,
      // and it walks before you can pour anything. Patience is meant to
      // measure being ignored, and nobody could have served it while the app
      // was shut. So a cat that survives to `now` gets its window measured
      // from `now`, and one whose replayed window closed earlier is still
      // swept below exactly as before: the floor only ever applies to a cat
      // you can actually see, and never resurrects one that came and went.
      const deadline = natural > now ? Math.max(natural, now + patience) : natural;

      customers.push({
        id: `${groupId}-${i}`,
        catId: pick,
        groupId,
        setOffAt,
        servedAt: null,
        patienceMs: deadline - setOffAt - WALK_IN_MS,
      });
    }

    seq += 1;
    changed = true;
  }

  // Anyone called in *during* the catch-up whose window closed before we
  // reached `now` came and went while the app was shut. They're swept here
  // rather than never admitted, so the occupancy above stays honest about the
  // café having been full at the time — and because they never landed in
  // state, nothing charges you for them. You are only billed for cats you
  // could have seen.
  const present = customers.filter((c) => !hasWalkedOut(c, now));
  if (present.length !== customers.length) changed = true;

  if (!changed && cursor === visit.lastArrivalAt) return visit;

  return { customers: present, lastArrivalAt: cursor, arrivalSeq: seq };
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
  now: number,
  catStats: Record<string, CatStat>
): CafeVisitState {
  const owned = new Set(ownedCats);
  const seen = new Set<string>();

  // A staggered group member legitimately has its departure a few seconds in
  // the future (see WALK_STAGGER_MS); only a stamp beyond the deepest possible
  // stagger is garbage.
  const latestValidSetOff = now + QUEUE_CAPACITY * WALK_STAGGER_MS;

  let touched = false;
  const customers: CafeCustomer[] = [];

  for (const c of visit.customers) {
    if (!owned.has(c.catId) || seen.has(c.catId)) {
      touched = true;
      continue;
    }
    if (!Number.isFinite(c.setOffAt) || c.setOffAt > latestValidSetOff) {
      touched = true;
      continue;
    }
    if (c.servedAt !== null && (!Number.isFinite(c.servedAt) || c.servedAt > now)) {
      touched = true;
      continue;
    }
    seen.add(c.catId);

    if (Number.isFinite(c.patienceMs) && c.patienceMs > 0) {
      customers.push(c);
      continue;
    }

    // A save written before cats could get bored carries no window, and its
    // `setOffAt`s are as old as the save — measure from those and every cat in
    // it is evicted on the load that introduces the rule, at a cost. So the
    // window is measured from *now* instead, the same courtesy
    // `settlePopularity` extends on its first run: the mechanic starts today,
    // and nobody is charged for time they spent waiting before it existed.
    touched = true;
    customers.push({
      ...c,
      patienceMs: now + windowFor(c.catId, catStats) - c.setOffAt - WALK_IN_MS,
    });
  }

  return touched ? { ...visit, customers } : visit;
}
