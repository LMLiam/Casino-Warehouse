import type { ChipCrop } from './ChipCrop';
import { chipValues } from './chipValues';

export const chipCrops: readonly ChipCrop[] = (() => {
  const chipCropSize = 384;
  const chipColumnWidth = 384;
  const chipLeftInset = 0;
  const chipRowY = [86, 520] as const;

  return chipValues.map((value, index) => {
    const y = chipRowY[Math.floor(index / 4)];
    if (y === undefined) {
      throw new Error('Chip crop row is invalid.');
    }
    return {
      value,
      x: (index % 4) * chipColumnWidth + chipLeftInset,
      y,
      size: chipCropSize,
    };
  });
})();
