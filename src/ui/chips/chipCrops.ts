import type { ChipCrop } from './ChipCrop';
import { chipValues } from './chipValues';

const chipCropSize = 384;

const chipColumnWidth = 384;

const chipLeftInset = 0;

const chipRowY = [86, 520] as const;

export const chipCrops: readonly ChipCrop[] = chipValues.map((value, index) => ({
  value,
  x: (index % 4) * chipColumnWidth + chipLeftInset,
  y: chipRowY[Math.floor(index / 4)],
  size: chipCropSize,
}));
