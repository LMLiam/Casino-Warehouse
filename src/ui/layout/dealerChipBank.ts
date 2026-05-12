import type { PointPercent } from './PointPercent';

const point = (x: number, y: number): PointPercent => ({ x, y });

export const dealerChipBank: PointPercent = point(50, 8.7);
