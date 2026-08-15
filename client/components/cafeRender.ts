import { getTableCenters } from './cafeConfig';
import type { Ctx2D } from './skiaCanvas2d';

export function getSeatSpots() {
  return getTableCenters().flatMap((table) => [
    { x: table.x, y: table.y - 33, tableId: table.id, role: 'middle' as const },
    { x: table.x - 28, y: table.y - 4, tableId: table.id, role: 'left' as const },
    { x: table.x + 28, y: table.y - 4, tableId: table.id, role: 'right' as const },
  ]);
}

export function getQueueSpots(width: number) {
  const centerX = width / 2;
  return Array.from({ length: 10 }, (_, i) => ({
    x: centerX,
    y: 255 + i * 36,
  }));
}

export function drawCafeBackground(
  ctx: Ctx2D,
  width: number,
  height: number,
  counterStyle: number,
  rugStyle: number
) {
  const matchaBg = '#DCE8D4';
  const roomColor = '#EDF4E7';
  const borderColor = '#C6D5BC';

  ctx.fillStyle = matchaBg;
  ctx.fillRect(0, 0, width, height);

  const roomX = 28;
  const roomY = 42;
  const roomWidth = width - 56;
  const roomHeight = height - 84;

  ctx.fillStyle = roomColor;
  ctx.beginPath();
  ctx.roundRect(roomX, roomY, roomWidth, roomHeight, 24);
  ctx.fill();

  drawFloorTiles(
    ctx,
    roomX + 10,
    roomY + 70,
    roomWidth - 20,
    roomHeight - 90
  );

  if (rugStyle === 2) {
    drawWalkwayRugOption2(ctx, width, roomY + 170, roomHeight - 220);
  } else {
    drawWalkwayRugOption1(ctx, width, roomY + 170, roomHeight - 220);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(roomX, roomY, roomWidth, roomHeight, 24);
  ctx.stroke();

  if (counterStyle === 2) {
    drawCounterOption2(ctx, width);
  } else {
    drawCounterOption1(ctx, width);
  }
}

export function drawSeatingAreas(
  ctx: Ctx2D,
  tableStyle: number
) {
  getTableCenters().forEach((table) => {
    if (tableStyle === 2) {
      drawTableOption2(ctx, table.x, table.y);
    } else {
      drawTableOption1(ctx, table.x, table.y);
    }
  });
}

function drawTableOption1(
  ctx: Ctx2D,
  x: number,
  y: number
) {
  const tableColor = '#D8B07A';
  const tableTop = '#C7965D';
  const chairColor = '#BFCDB4';

  ctx.fillStyle = chairColor;

  ctx.beginPath();
  ctx.roundRect(x - 7, y - 34, 14, 18, 6);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(x - 31, y - 8, 14, 18, 6);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(x + 17, y - 8, 14, 18, 6);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 23, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = tableColor;
  ctx.beginPath();
  ctx.roundRect(x - 5, y - 2, 10, 22, 5);
  ctx.fill();

  ctx.fillStyle = tableTop;
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTableOption2(
  ctx: Ctx2D,
  x: number,
  y: number
) {
  const chairBase = '#E5D1B7';
  const chairSeat = '#F5E7D6';
  const tableLeg = '#9B633B';
  const tableTop = '#D39061';
  const outline = 'rgba(88, 56, 32, 0.15)';

  ctx.fillStyle = chairBase;
  ctx.beginPath();
  ctx.roundRect(x - 8, y - 38, 16, 20, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 34, y - 10, 16, 20, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + 18, y - 10, 16, 20, 7);
  ctx.fill();

  ctx.fillStyle = chairSeat;
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 22, 18, 8, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 35, y + 4, 18, 8, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + 17, y + 4, 18, 8, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath();
  ctx.ellipse(x, y + 13, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = tableLeg;
  ctx.beginPath();
  ctx.roundRect(x - 6, y + 1, 12, 24, 6);
  ctx.fill();

  ctx.fillStyle = 'rgba(110,64,30,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 28, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = tableTop;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 28, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 22, 12, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.beginPath();
  ctx.ellipse(x - 5, y - 6, 12, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 28, 17, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#F7E7D8';
  ctx.beginPath();
  ctx.arc(x, y - 1, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#D99BB0';
  ctx.beginPath();
  ctx.arc(x, y - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCounterOption1(ctx: Ctx2D, width: number) {
  const counterFront = '#CF9A63';
  const counterMid = '#D9A672';
  const counterTop = '#B57E43';

  drawCounterShape(ctx, width / 2, 118, 266, 104, 14, 'rgba(0,0,0,0.07)');
  drawCounterShape(ctx, width / 2, 110, 266, 104, 5, counterMid);
  drawCounterShape(ctx, width / 2, 106, 266, 98, 0, counterFront);

  ctx.fillStyle = counterTop;
  ctx.beginPath();
  ctx.roundRect(width / 2 - 140, 84, 280, 20, 13);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 120, 89, 240, 6, 6);
  ctx.fill();
}

function drawCounterOption2(ctx: Ctx2D, width: number) {
  const counterFront = '#E39D6B';
  const counterMid = '#EDBC85';
  const counterTop = '#C77F48';

  drawCounterShape(ctx, width / 2, 118, 282, 116, 16, 'rgba(0,0,0,0.08)');
  drawCounterShape(ctx, width / 2, 110, 282, 116, 6, counterMid);
  drawCounterShape(ctx, width / 2, 104, 282, 108, 0, counterFront);

  ctx.fillStyle = counterTop;
  ctx.beginPath();
  ctx.roundRect(width / 2 - 150, 80, 300, 24, 14);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 126, 86, 252, 7, 7);
  ctx.fill();
}

function drawWalkwayRugOption1(
  ctx: Ctx2D,
  width: number,
  y: number,
  height: number
) {
  const rugWidth = 74;
  const x = width / 2 - rugWidth / 2;

  ctx.fillStyle = '#B86B4B';
  ctx.beginPath();
  ctx.roundRect(x, y, rugWidth, height, 24);
  ctx.fill();

  ctx.fillStyle = '#D9A672';
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 10, rugWidth - 16, height - 20, 18);
  ctx.fill();
}

function drawWalkwayRugOption2(
  ctx: Ctx2D,
  width: number,
  y: number,
  height: number
) {
  const rugWidth = 84;
  const x = width / 2 - rugWidth / 2;

  ctx.fillStyle = '#8E4E47';
  ctx.beginPath();
  ctx.roundRect(x, y, rugWidth, height, 24);
  ctx.fill();

  ctx.fillStyle = '#D5B08D';
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 10, rugWidth - 16, height - 20, 18);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const stripeY = y + 28 + i * ((height - 56) / 5);
    ctx.strokeStyle = 'rgba(96, 46, 41, 0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 16, stripeY);
    ctx.lineTo(x + rugWidth - 16, stripeY);
    ctx.stroke();
  }
}

function drawFloorTiles(
  ctx: Ctx2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const majorLine = 'rgba(130, 150, 120, 0.14)';
  const minorLine = 'rgba(130, 150, 120, 0.08)';
  const tile = 32;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 18);
  ctx.clip();

  for (let row = y; row <= y + height; row += tile) {
    ctx.strokeStyle = majorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, row);
    ctx.lineTo(x + width, row);
    ctx.stroke();

    if (row + tile / 2 < y + height) {
      ctx.strokeStyle = minorLine;
      ctx.beginPath();
      ctx.moveTo(x, row + tile / 2);
      ctx.lineTo(x + width, row + tile / 2);
      ctx.stroke();
    }
  }

  for (let col = x; col <= x + width; col += tile) {
    ctx.strokeStyle = majorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(col, y);
    ctx.lineTo(col, y + height);
    ctx.stroke();

    if (col + tile / 2 < x + width) {
      ctx.strokeStyle = minorLine;
      ctx.beginPath();
      ctx.moveTo(col + tile / 2, y);
      ctx.lineTo(col + tile / 2, y + height);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCounterShape(
  ctx: Ctx2D,
  centerX: number,
  topY: number,
  width: number,
  height: number,
  yOffset: number,
  fill: string
) {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const top = topY + yOffset;
  const bottom = top + height;
  const openingInset = 50;
  const openingDepth = 32;

  ctx.fillStyle = fill;
  ctx.beginPath();

  ctx.moveTo(left, top + 4);
  ctx.quadraticCurveTo(left + 4, top, left + 12, top);
  ctx.lineTo(right - 12, top);
  ctx.quadraticCurveTo(right - 4, top, right, top + 4);

  ctx.lineTo(right, top + 44);
  ctx.quadraticCurveTo(right - 14, bottom + 8, centerX, bottom + 12);
  ctx.quadraticCurveTo(left + 14, bottom + 8, left, top + 44);

  ctx.lineTo(left, top + 4);
  ctx.lineTo(left + openingInset, top + 4);
  ctx.lineTo(left + openingInset, top + openingDepth);
  ctx.quadraticCurveTo(centerX, top + openingDepth + 12, right - openingInset, top + openingDepth);
  ctx.lineTo(right - openingInset, top + 4);
  ctx.lineTo(right, top + 4);

  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}