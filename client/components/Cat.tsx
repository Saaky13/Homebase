import type { Ctx2D } from './skiaCanvas2d';
import type { Direction } from '../constants/catSprites';
import type { BobaFlavor } from '../constants/bobaCup';
import { catAspectRatio, getCatSkImage } from './catImageCache';
import { CUP_GRID_ASPECT, DRINK_STEPS, getBobaCupSkImage } from './bobaImageCache';

export type CatState =
  | 'walkingToLine'
  | 'waiting'
  | 'walkingToSeat'
  | 'seated'
  | 'leaving';

export type SeatFacing = 'front' | 'left' | 'right' | null;

export interface Cat {
  id: string;
  /** Which roster cat this is — one the player has actually adopted. */
  catId: string;
  groupId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  size: number;
  state: CatState;
  seatIndex: number | null;
  seatFacing: SeatFacing;
  seatedAt: number | null;
  /** The cup handed over at the counter, carried until they leave. */
  drink: BobaFlavor | null;
  /** Current draw scale, eased toward `targetScale` as the cat moves. */
  scale: number;
  targetScale: number;
}

export interface QueueSpot {
  x: number;
  y: number;
}

export interface SeatSpot {
  x: number;
  y: number;
  tableId: string;
  role: 'left' | 'middle' | 'right';
}

export function createCat(
  id: string,
  catId: string,
  groupId: string,
  startX: number,
  startY: number,
  queueSpot: QueueSpot
): Cat {
  return {
    id,
    catId,
    groupId,
    x: startX,
    y: startY,
    targetX: queueSpot.x,
    targetY: queueSpot.y,
    speed: 3,
    // Drawn at size * 1.8, so 30 puts a cat at ~54px on a 390px-wide floor —
    // a bit under a 64px tabletop. At 52 a cat came out 94px wide, half again
    // wider than the table it was sitting at, and ten of them buried the café.
    // At 26 they read as too far away to be the point of the screen.
    size: 30,
    state: 'walkingToLine',
    seatIndex: null,
    seatFacing: null,
    seatedAt: null,
    drink: null,
    scale: 1,
    targetScale: 1,
  };
}

/**
 * How much a cat shrinks once it takes a chair.
 *
 * A seated cat is further into the room than one at the counter, and the side
 * chairs are further still — at full size a cat stood taller than the table it
 * was sitting at. The middle chair keeps more of its height because it's the
 * one facing the player.
 */
const SEAT_SCALE = { middle: 0.86, side: 0.74 } as const;

/**
 * Dead-centre on the back chair, a cat sat squarely above the table and read as
 * floating behind it. A few pixels down and right tucks them in against the
 * tabletop, and off the table's exact centre line.
 */
const BACK_SEAT_NUDGE = { x: 5, y: 7 } as const;

export function updateCat(cat: Cat) {
  // Eased rather than snapped, so a cat shrinks into its chair on the way over
  // instead of popping the moment it's served.
  if (cat.scale !== cat.targetScale) {
    cat.scale += (cat.targetScale - cat.scale) * 0.12;
    if (Math.abs(cat.targetScale - cat.scale) < 0.005) cat.scale = cat.targetScale;
  }

  if (cat.state === 'waiting' || cat.state === 'seated') return;

  const dx = cat.targetX - cat.x;
  const dy = cat.targetY - cat.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 2) {
    cat.x = cat.targetX;
    cat.y = cat.targetY;

    if (cat.state === 'walkingToSeat') {
      cat.state = 'seated';
      cat.seatedAt = Date.now();
    }

    return;
  }

  cat.x += (dx / distance) * cat.speed;
  cat.y += (dy / distance) * cat.speed;
}

export function retargetCat(cat: Cat, queueSpot: QueueSpot) {
  cat.targetX = queueSpot.x;
  cat.targetY = queueSpot.y;
  cat.state = 'walkingToLine';
}

export function sendCatToSeat(cat: Cat, seat: SeatSpot, seatIndex: number) {
  cat.targetScale =
    seat.role === 'middle' ? SEAT_SCALE.middle : SEAT_SCALE.side;

  // Aim the cat's *feet* at the chair rather than its centre: the sprite is
  // drawn from the middle, so a fixed lift left tall cats hovering and short
  // ones sunk into the tabletop.
  const height = spriteHeight(cat, cat.targetScale);
  const nudge = seat.role === 'middle' ? BACK_SEAT_NUDGE : { x: 0, y: 0 };

  cat.targetX = seat.x + nudge.x;
  cat.targetY = seat.y + 4 - height / 2 + nudge.y;
  cat.state = 'walkingToSeat';
  cat.seatIndex = seatIndex;
  if (seat.role === 'middle') cat.seatFacing = 'front';
  else if (seat.role === 'left') cat.seatFacing = 'left';
  else cat.seatFacing = 'right';
}

export function sendCatOut(cat: Cat, exitX: number, exitY: number) {
  cat.targetX = exitX;
  cat.targetY = exitY;
  cat.state = 'leaving';
  cat.seatIndex = null;
  cat.seatedAt = null;
  cat.seatFacing = null;
  cat.targetScale = 1;
  // They finished it. A cat walking out still clutching a full cup reads as a
  // cat who was never served.
  cat.drink = null;
}

/** Sprite height at a given scale — the grid is 28x37, not square. */
function spriteHeight(cat: Cat, scale: number) {
  return cat.size * 1.8 * scale * catAspectRatio(cat.catId);
}

export function isCatOffscreen(cat: Cat, width: number, height: number) {
  return cat.x < -80 || cat.x > width + 80 || cat.y < -80 || cat.y > height + 80;
}

export function drawCat(ctx: Ctx2D, cat: Cat) {
  const dx = cat.targetX - cat.x;
  const dy = cat.targetY - cat.y;

  let direction: Direction = 'front';

  if (cat.state === 'seated' && cat.seatFacing) {
    if (cat.seatFacing === 'left') direction = 'right';
    else if (cat.seatFacing === 'right') direction = 'left';
    else direction = 'front';
  } else if (dx > 5 && dy > 5) direction = 'front_right';
  else if (dx < -5 && dy > 5) direction = 'front_left';
  else if (dx > 5 && dy < -5) direction = 'back_right';
  else if (dx < -5 && dy < -5) direction = 'back_left';
  else if (Math.abs(dx) > Math.abs(dy)) {
    direction = dx > 0 ? 'right' : 'left';
  } else {
    direction = dy > 0 ? 'front' : 'back';
  }

  const img = getCatSkImage(cat.catId, direction);

  // The old shared PNGs were square. The procedural sprites are taller than
  // they are wide (28x37), so the height follows the grid or the cats come out
  // squashed.
  const width = cat.size * 1.8 * cat.scale;
  const height = width * catAspectRatio(cat.catId);

  // Feet sit at the bottom of the sprite, so the shadow is anchored there
  // rather than to the centre.
  const feetY = cat.y + height / 2 - 2;

  // Warm and dark enough to actually anchor the cat to the boards. At 12%
  // black the sprites looked pasted onto the floor rather than standing on it.
  const shadow = cat.size * cat.scale;

  ctx.fillStyle = 'rgba(74,44,26,0.22)';
  ctx.beginPath();
  ctx.ellipse(cat.x, feetY, shadow * 0.52, shadow * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(74,44,26,0.13)';
  ctx.beginPath();
  ctx.ellipse(cat.x, feetY, shadow * 0.68, shadow * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();

  // Skia images are either fully decoded or null — there's no partially
  // loaded state to guard against the way there was with HTMLImageElement.
  if (img) {
    ctx.drawImage(img, cat.x - width / 2, cat.y - height / 2, width, height);
  }
}

/** How long a seated cat takes to work through its cup, in ms. */
const SIP_INTERVAL = 15000;

/**
 * The cup a served cat is carrying, held at their side and sipped down while
 * they sit.
 *
 * Drawn in a pass after every cat rather than inside `drawCat`: cats in a group
 * stand 28 apart and are 54 wide, so a cup drawn with its own cat disappeared
 * under the neighbour painted next.
 */
export function drawCatDrink(ctx: Ctx2D, cat: Cat) {
  if (!cat.drink) return;

  const catWidth = cat.size * 1.8 * cat.scale;
  const catHeight = catWidth * catAspectRatio(cat.catId);

  const elapsed = cat.seatedAt ? Date.now() - cat.seatedAt : 0;
  const step = Math.min(DRINK_STEPS - 1, Math.floor(elapsed / SIP_INTERVAL));

  const img = getBobaCupSkImage(cat.drink as NonNullable<Cat['drink']>, step);
  if (!img) return;

  const cupWidth = catWidth * 0.3;
  const cupHeight = cupWidth * CUP_GRID_ASPECT;

  // Held on whichever side the cat is facing, so the cup is never behind them.
  const side = cat.seatFacing === 'right' ? -1 : 1;
  const cx = cat.x + side * catWidth * 0.46;
  const base = cat.y + catHeight * 0.3;

  ctx.fillStyle = 'rgba(74,44,26,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, base, cupWidth * 0.42, cupWidth * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(img, cx - cupWidth / 2, base - cupHeight, cupWidth, cupHeight);
}