export type TableCenter = {
  id: string;
  x: number;
  y: number;
};

export function getTableCenters(): TableCenter[] {
  return [
    { id: 'L1', x: 70, y: 275 },
    { id: 'L2', x: 100, y: 360 },
    { id: 'L3', x: 66, y: 445 },
    { id: 'L4', x: 104, y: 530 },
    { id: 'L5', x: 82, y: 615 },

    { id: 'R1', x: 320, y: 275 },
    { id: 'R2', x: 290, y: 360 },
    { id: 'R3', x: 324, y: 445 },
    { id: 'R4', x: 286, y: 530 },
    { id: 'R5', x: 308, y: 615 },
  ];
}