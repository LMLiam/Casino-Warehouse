import type { PointPercent } from './PointPercent';

const point = (x: number, y: number): PointPercent => ({ x, y });

export const dealerSlots: readonly PointPercent[] = [point(42.25, 24), point(47.7, 24), point(53.15, 24), point(58.6, 24)];
