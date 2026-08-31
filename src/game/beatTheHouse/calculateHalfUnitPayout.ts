import { asHalfUnits } from './asHalfUnits';
import { wholeChipToHalfUnits } from './wholeChipToHalfUnits';
import type { HalfUnitPayout } from './HalfUnitPayout';

export const calculateHalfUnitPayout = (stake: number, ratio: { readonly numerator: number; readonly denominator: number }): HalfUnitPayout => {
  if (!Number.isSafeInteger(ratio.numerator) || ratio.numerator < 0) {
    throw new Error('Profit ratio numerator must be a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(ratio.denominator) || ratio.denominator <= 0) {
    throw new Error('Profit ratio denominator must be a positive safe integer.');
  }

  const stakeHalfUnits = wholeChipToHalfUnits(stake);
  const profitNumerator = stakeHalfUnits * ratio.numerator;
  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % ratio.denominator !== 0) {
    throw new Error('Profit cannot be represented exactly in half-units.');
  }

  const profitHalfUnits = asHalfUnits(profitNumerator / ratio.denominator);
  const returnedHalfUnits = asHalfUnits(stakeHalfUnits + profitHalfUnits);
  return { stakeHalfUnits, profitHalfUnits, returnedHalfUnits };
};
