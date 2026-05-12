import type { HandLayout } from './HandLayout';
import type { PointPercent } from './PointPercent';
import type { RectPercent } from './RectPercent';

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
