import type { ChipCrop } from './ChipCrop';
import { chipValues } from './chipValues';

export const chipCrops: readonly ChipCrop[] = (() => {
  const chipCropSize = 384;
  const chipColumnWidth = 384;
  const chipLeftInset = 0;
  const chipRowY = [86, 520] as const;

  return chipValues.map((value, index) => ({
    value,
    x: (index % 4) * chipColumnWidth + chipLeftInset,
    y: chipRowY[Math.floor(index / 4)],
    size: chipCropSize,
  }));
})();
