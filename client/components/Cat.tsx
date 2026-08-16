import type { Ctx2D } from './skiaCanvas2d';
import type { Direction } from '../constants/catSprites';
import { catAspectRatio, getCatSkImage } from './catImageCache';

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
  lineOffsetX: number;
  seatFacing: SeatFacing;
  seatedAt: number | null;
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
  queueSpot: QueueSpot,
  lineOffsetX: number = 0
): Cat {
  return {
    id,
    catId,
    groupId,
    x: startX + lineOffsetX,
    y: startY,
    targetX: queueSpot.x + lineOffsetX,
    targetY: queueSpot.y,
    speed: 3,
    // Drawn at size * 1.8, so 26 puts a cat at ~47px on a 390px-wide floor —
    // roughly three quarters of a 60px table. At 52 a cat came out 94px wide,
    // half again wider than the table it was sitting at, and ten of them
    // buried the café.
    size: 26,
    state: 'walkingToLine',
    seatIndex: null,
    lineOffsetX,
    seatFacing: null,
    seatedAt: null,
  };
}

export function updateCat(cat: Cat) {
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
  cat.targetX = queueSpot.x + cat.lineOffsetX;
  cat.targetY = queueSpot.y;
  cat.state = 'walkingToLine';
}

export function sendCatToSeat(cat: Cat, seat: SeatSpot, seatIndex: number) {
  cat.targetX = seat.x;
  cat.targetY = seat.y - 14;
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
  const width = cat.size * 1.8;
  const height = width * catAspectRatio(cat.catId);

  // Feet sit at the bottom of the sprite, so the shadow is anchored there
  // rather than to the centre.
  const feetY = cat.y + height / 2 - 2;

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(cat.x, feetY, cat.size * 0.45, cat.size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Skia images are either fully decoded or null — there's no partially
  // loaded state to guard against the way there was with HTMLImageElement.
  if (img) {
    ctx.drawImage(img, cat.x - width / 2, cat.y - height / 2, width, height);
  }
}