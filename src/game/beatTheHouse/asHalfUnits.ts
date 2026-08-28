import type { HalfUnits } from './HalfUnits';

export const asHalfUnits = (value: number): HalfUnits => {
  if (!Number.isSafeInteger(value)) {
    throw new Error('Half-units must be a safe integer.');
  }
  return value as HalfUnits;
};
