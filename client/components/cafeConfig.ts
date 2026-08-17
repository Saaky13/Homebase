export type TableCenter = {
  id: string;
  x: number;
  y: number;
};

/**
 * Ten tables in two columns. The two columns are deliberately out of phase —
 * with matching rows on both sides the floor read as a spreadsheet, and the
 * eye counted rows instead of seeing a room.
 */
export function getTableCenters(): TableCenter[] {
  return [
    { id: 'L1', x: 68, y: 272 },
    { id: 'L2', x: 102, y: 358 },
    { id: 'L3', x: 64, y: 446 },
    { id: 'L4', x: 106, y: 530 },
    { id: 'L5', x: 80, y: 616 },

    { id: 'R1', x: 322, y: 300 },
    { id: 'R2', x: 288, y: 388 },
    { id: 'R3', x: 326, y: 472 },
    { id: 'R4', x: 284, y: 556 },
    { id: 'R5', x: 310, y: 640 },
  ];
}