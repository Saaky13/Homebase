import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { useCafeState } from '../hooks/useCafeState';
import {
  createCat,
  updateCat,
  drawCat,
  retargetCat,
  sendCatToSeat,
  sendCatOut,
  isCatOffscreen,
  Cat,
} from './Cat';
import {
  getQueueSpots,
  getSeatSpots,
  drawCafeBackground,
  drawSeatingAreas,
} from './cafeRender';

type Table = {
  id: string;
  seatIndexes: number[];
};

export default function CafeCanvas() {
  const canvasRef = useRef<any>(null);
  const catsRef = useRef<Cat[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const autoSpawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const catSpritesRef = useRef<Record<string, HTMLImageElement>>({});
  const pearlsRef = useRef(0);

  const { state, addCoins, spendPearls, addDrinkServed } = useCafeState();

  useEffect(() => {
    pearlsRef.current = state.pearls;
  }, [state.pearls]);

  const getQueueCats = () =>
    catsRef.current.filter(
      (cat) => cat.state === 'walkingToLine' || cat.state === 'waiting'
    );

  const getFrontGroupInQueue = () => {
    const queueCats = getQueueCats();
    if (!queueCats.length) return [];
    return queueCats.filter((cat) => cat.groupId === queueCats[0].groupId);
  };

  const getTables = (): Table[] => {
    const seats = getSeatSpots();
    const grouped: Record<string, number[]> = {};

    seats.forEach((seat, index) => {
      if (!grouped[seat.tableId]) grouped[seat.tableId] = [];
      grouped[seat.tableId].push(index);
    });

    return Object.entries(grouped).map(([id, seatIndexes]) => ({
      id,
      seatIndexes,
    }));
  };

  const getOccupiedSeatIndexes = () =>
    new Set(
      catsRef.current
        .filter((cat) => cat.seatIndex !== null)
        .map((cat) => cat.seatIndex as number)
    );

  const getOpenSeatIndexesForTable = (table: Table) => {
    const occupied = getOccupiedSeatIndexes();
    return table.seatIndexes.filter((seatIndex) => !occupied.has(seatIndex));
  };

  const getCatsAtTable = (table: Table) => {
    const set = new Set(table.seatIndexes);
    return catsRef.current.filter(
      (cat) => cat.seatIndex !== null && set.has(cat.seatIndex)
    );
  };

  function shuffleArray<T>(array: T[]) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const findSeatIndexesForGroup = (groupSize: number): number[] | null => {
    const tables = shuffleArray(getTables());

    if (groupSize > 1) {
      const emptyTable = tables.find((table) => {
        const catsAtTable = getCatsAtTable(table).length;
        const openSeats = getOpenSeatIndexesForTable(table).length;
        return catsAtTable === 0 && openSeats >= groupSize;
      });

      if (!emptyTable) return null;
      return shuffleArray(getOpenSeatIndexesForTable(emptyTable)).slice(0, groupSize);
    }

    const soloWantsOwnTable = Math.random() < 0.8;

    if (soloWantsOwnTable) {
      const emptyTable = tables.find((table) => {
        const catsAtTable = getCatsAtTable(table).length;
        return catsAtTable === 0 && getOpenSeatIndexesForTable(table).length >= 1;
      });

      if (emptyTable) {
        return [shuffleArray(getOpenSeatIndexesForTable(emptyTable))[0]];
      }
    }

    const openTable = tables.find((table) => {
      const catsAtTable = getCatsAtTable(table).length;
      const openSeats = getOpenSeatIndexesForTable(table).length;
      return catsAtTable > 0 && openSeats >= 1;
    });

    if (openTable) {
      return [shuffleArray(getOpenSeatIndexesForTable(openTable))[0]];
    }

    const fallbackEmpty = tables.find(
      (table) => getOpenSeatIndexesForTable(table).length >= 1
    );

    if (!fallbackEmpty) return null;
    return [shuffleArray(getOpenSeatIndexesForTable(fallbackEmpty))[0]];
  };

  const canServeFrontGroup = () => {
    const front = getFrontGroupInQueue();
    if (!front.length) return false;

    const pearlCost = front.length * 5;
    if (pearlsRef.current < pearlCost) return false;

    const seats = findSeatIndexesForGroup(front.length);
    return !!seats && seats.length >= front.length;
  };

  const serveFrontGroup = () => {
    const front = getFrontGroupInQueue();
    if (!front.length) return;

    const seats = findSeatIndexesForGroup(front.length);
    if (!seats || seats.length < front.length) return;

    const pearlCost = front.length * 5;
    if (pearlsRef.current < pearlCost) return;

    const paid = spendPearls(pearlCost);
    if (!paid) return;

    pearlsRef.current -= pearlCost;

    const allSeats = getSeatSpots();

    front.forEach((cat, index) => {
      const seatIndex = seats[index];
      const seat = allSeats[seatIndex];
      if (!seat) return;

      sendCatToSeat(cat, seat, seatIndex);
      addCoins(25);
      addDrinkServed(1);
    });
  };

  const updateQueueTargets = (width: number) => {
    const queueCats = getQueueCats();
    const queueSpots = getQueueSpots(width);

    let rowIndex = 0;
    let i = 0;

    while (i < queueCats.length && rowIndex < queueSpots.length) {
      const currentGroupId = queueCats[i].groupId;
      const groupCats = queueCats.filter((cat) => cat.groupId === currentGroupId);

      const firstIndex = queueCats.findIndex((cat) => cat.groupId === currentGroupId);
      if (firstIndex !== i) {
        i++;
        continue;
      }

      const queueSpot = queueSpots[rowIndex];
      if (!queueSpot) break;

      groupCats.forEach((cat) => retargetCat(cat, queueSpot));

      i += groupCats.length;
      rowIndex += 1;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 390;
    const height = 844;

    canvas.width = width;
    canvas.height = height;

    const loadImage = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };

    catSpritesRef.current = {
      front: loadImage('/cat_pics/cat_front.png'),
      back: loadImage('/cat_pics/cat_back.png'),
      left: loadImage('/cat_pics/cat_left.png'),
      right: loadImage('/cat_pics/cat_right.png'),
      front_left: loadImage('/cat_pics/cat_front_left.png'),
      front_right: loadImage('/cat_pics/cat_front_right.png'),
      back_left: loadImage('/cat_pics/cat_back_left.png'),
      back_right: loadImage('/cat_pics/cat_back_right.png'),
    };

    const spawnGroupInternal = () => {
      const queueCats = getQueueCats();
      const queueSpots = getQueueSpots(width);

      const requestedGroupSize = 1 + Math.floor(Math.random() * 3);
      const availableQueueSlots = queueSpots.length - queueCats.length;
      const actualGroupSize = Math.min(requestedGroupSize, availableQueueSlots);
      if (actualGroupSize <= 0) return;

      const groupId = `group-${Date.now()}-${Math.random()}`;
      const offsets =
        actualGroupSize === 1 ? [0] : actualGroupSize === 2 ? [-22, 22] : [-28, 0, 28];

      for (let i = 0; i < actualGroupSize; i++) {
        const queueSpot = queueSpots[queueCats.length + i];
        if (!queueSpot) break;

        catsRef.current.push(
          createCat(
            `${groupId}-cat-${i}`,
            groupId,
            width / 2,
            height - 72,
            queueSpot,
            offsets[i]
          )
        );
      }
    };

    autoSpawnIntervalRef.current = setInterval(spawnGroupInternal, 60000);

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;

      const clickX = (event.clientX - rect.left) * scaleX;
      const clickY = (event.clientY - rect.top) * scaleY;

      const spawnButton = { x: width - 74, y: height - 84, width: 52, height: 52 };
      const serveButton = { x: width - 92, y: 24, width: 72, height: 40 };

      const clickedSpawn =
        clickX >= spawnButton.x &&
        clickX <= spawnButton.x + spawnButton.width &&
        clickY >= spawnButton.y &&
        clickY <= spawnButton.y + spawnButton.height;

      const clickedServe =
        clickX >= serveButton.x &&
        clickX <= serveButton.x + serveButton.width &&
        clickY >= serveButton.y &&
        clickY <= serveButton.y + serveButton.height;

      if (clickedSpawn) {
        spawnGroupInternal();
        return;
      }

      if (clickedServe && canServeFrontGroup()) {
        serveFrontGroup();
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      catsRef.current.forEach((cat) => {
        if (
          cat.state === 'seated' &&
          cat.seatedAt &&
          Date.now() - cat.seatedAt >= 60000
        ) {
          sendCatOut(cat, width / 2, height + 110);
        }
      });

      catsRef.current = catsRef.current.filter(
        (cat) => !(cat.state === 'leaving' && isCatOffscreen(cat, width, height))
      );

      updateQueueTargets(width);
      catsRef.current.forEach(updateCat);

      drawCafeBackground(
        ctx,
        width,
        height,
        state.visuals.counterStyle,
        state.visuals.rugStyle
      );

      drawSeatingAreas(ctx, state.visuals.tableStyle);

      catsRef.current.forEach((cat) => drawCat(ctx, cat, catSpritesRef.current));

      drawSpawnButton(ctx, width, height);
      drawServeButton(ctx, width, canServeFrontGroup());

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (autoSpawnIntervalRef.current) clearInterval(autoSpawnIntervalRef.current);
    };
  }, [state.visuals, addCoins, spendPearls, addDrinkServed]);

  return (
    <View style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} />
    </View>
  );
}

function drawServeButton(
  ctx: CanvasRenderingContext2D,
  width: number,
  canServe: boolean
) {
  const x = width - 92;
  const y = 24;
  const w = 72;
  const h = 40;

  ctx.fillStyle = canServe ? '#63B97C' : '#A8C9B1';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Serve', x + w / 2, y + h / 2 + 1);
}

function drawSpawnButton(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const x = width - 74;
  const y = height - 84;
  const w = 52;
  const h = 52;

  ctx.fillStyle = '#E88973';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', x + w / 2, y + h / 2 + 1);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block' as any,
    outlineStyle: 'none' as any,
  },
});