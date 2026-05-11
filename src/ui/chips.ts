export const chipValues = [1, 5, 25, 100, 500, 1000, 5000, 10000] as const;

export type ChipValue = (typeof chipValues)[number];

export interface ChipCrop {
  readonly value: ChipValue;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface ChipBreakdown {
  readonly roundedAmount: number;
  readonly chips: ChipValue[];
}

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

export const chipCropByValue = new Map<ChipValue, ChipCrop>(chipCrops.map((crop) => [crop.value, crop]));

export const chipSheetSize = {
  width: 1536,
  height: 1024,
};

export const toChipBreakdown = (amount: number): ChipBreakdown => {
  const roundedAmount = Math.floor(Math.max(0, amount));
  const chips: ChipValue[] = [];
  let remainder = roundedAmount;

  for (const denomination of [...chipValues].reverse()) {
    const count = Math.floor(remainder / denomination);
    remainder %= denomination;
    for (let index = 0; index < count; index += 1) {
      chips.push(denomination);
    }
  }

  return { roundedAmount, chips };
};
