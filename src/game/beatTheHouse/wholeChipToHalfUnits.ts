import { asNonNegativeHalfUnits } from './asNonNegativeHalfUnits';
import { beatTheHouseRules } from './beatTheHouseRules';
import type { HalfUnits } from './HalfUnits';

export const wholeChipToHalfUnits = (stake: number): HalfUnits => {
  if (!Number.isSafeInteger(stake) || stake < 0) {
    throw new Error('Whole-chip stakes must be non-negative safe integers.');
  }
  return asNonNegativeHalfUnits(stake * beatTheHouseRules.halfUnitsPerWholeChip);
};
