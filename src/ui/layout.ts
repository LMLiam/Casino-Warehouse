import type { BetType, HandId } from '../game/types';

export const tableSize = {
  width: 1672,
  height: 941,
};

export interface RectPercent {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PointPercent {
  readonly x: number;
  readonly y: number;
}

export interface HandLayout {
  readonly id: HandId;
  readonly label: string;
  readonly cards: readonly PointPercent[];
  readonly marker: PointPercent;
  readonly popup: PointPercent;
  readonly zones: Record<BetType, RectPercent>;
}

const rect = (x: number, y: number, width: number, height: number): RectPercent => ({ x, y, width, height });
const point = (x: number, y: number): PointPercent => ({ x, y });

export const handLayouts: readonly HandLayout[] = [
  {
    id: 'left',
    label: 'Left',
    cards: [point(12.35, 55.35), point(17, 55.35), point(21.55, 55.35), point(26.15, 55.35)],
    marker: point(18.8, 66.1),
    popup: point(18.9, 62.6),
    zones: {
      main: rect(19.25, 70.55, 9.8, 17.7),
      aceFlash: rect(9.45, 44.55, 6.1, 10.8),
      dealerBust: rect(16.15, 41.0, 6.2, 10.9),
      matchPush: rect(22.85, 41.0, 6.2, 10.9),
      dealerSevens: rect(29.7, 44.2, 6.8, 11.9),
    },
  },
  {
    id: 'centre',
    label: 'Centre',
    cards: [point(42.55, 63.35), point(47.35, 63.35), point(52.05, 63.35), point(56.75, 63.35)],
    marker: point(50, 71.8),
    popup: point(50, 68),
    zones: {
      main: rect(50, 75.85, 9.8, 17.6),
      aceFlash: rect(39.65, 52.1, 6.1, 10.8),
      dealerBust: rect(46.25, 48.7, 6.2, 10.9),
      matchPush: rect(53.25, 48.75, 6.2, 10.9),
      dealerSevens: rect(59.75, 51.95, 6.8, 11.9),
    },
  },
  {
    id: 'right',
    label: 'Right',
    cards: [point(73, 55.35), point(77.65, 55.35), point(82.3, 55.35), point(86.9, 55.35)],
    marker: point(81.2, 66.1),
    popup: point(81.2, 62.6),
    zones: {
      main: rect(80.75, 70.55, 9.8, 17.7),
      aceFlash: rect(69.95, 44.55, 6.1, 10.8),
      dealerBust: rect(76.4, 41.0, 6.2, 10.9),
      matchPush: rect(83.1, 41.0, 6.2, 10.9),
      dealerSevens: rect(90.25, 44.2, 6.8, 11.9),
    },
  },
];

export const dealerSlots: readonly PointPercent[] = [point(42.25, 24), point(47.7, 24), point(53.15, 24), point(58.6, 24)];
export const dealerChipBank: PointPercent = point(50, 8.7);

export const toPixels = (pointOrRect: PointPercent | RectPercent) => ({
  x: (pointOrRect.x / 100) * tableSize.width,
  y: (pointOrRect.y / 100) * tableSize.height,
});

export const rectToPixels = (rectPercent: RectPercent) => ({
  x: ((rectPercent.x - rectPercent.width / 2) / 100) * tableSize.width,
  y: ((rectPercent.y - rectPercent.height / 2) / 100) * tableSize.height,
  width: (rectPercent.width / 100) * tableSize.width,
  height: (rectPercent.height / 100) * tableSize.height,
});
