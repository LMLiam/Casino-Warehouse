import type { ChipBreakdown } from './ChipBreakdown';
import type { ChipValue } from './ChipValue';
import { chipValues } from './chipValues';

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
