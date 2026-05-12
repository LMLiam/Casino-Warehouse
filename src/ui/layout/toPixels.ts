import type { PointPercent } from './PointPercent';
import type { RectPercent } from './RectPercent';
import { tableSize } from './tableSize';

export const toPixels = (pointOrRect: PointPercent | RectPercent) => ({
  x: (pointOrRect.x / 100) * tableSize.width,
  y: (pointOrRect.y / 100) * tableSize.height,
});
