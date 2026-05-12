import type { ChipCrop } from './ChipCrop';
import { chipCrops } from './chipCrops';
import type { ChipValue } from './ChipValue';

export const chipCropByValue = new Map<ChipValue, ChipCrop>(chipCrops.map((crop) => [crop.value, crop]));
