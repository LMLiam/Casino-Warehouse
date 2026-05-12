import type { RectPercent } from './RectPercent';
import { tableSize } from './tableSize';

export const rectToPixels = (rectPercent: RectPercent) => ({
  x: ((rectPercent.x - rectPercent.width / 2) / 100) * tableSize.width,
  y: ((rectPercent.y - rectPercent.height / 2) / 100) * tableSize.height,
  width: (rectPercent.width / 100) * tableSize.width,
  height: (rectPercent.height / 100) * tableSize.height,
});
