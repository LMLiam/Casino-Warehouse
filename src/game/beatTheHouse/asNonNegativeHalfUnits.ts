import { asHalfUnits } from './asHalfUnits';
import type { HalfUnits } from './HalfUnits';

export const asNonNegativeHalfUnits = (value: number): HalfUnits => {
  const halfUnits = asHalfUnits(value);
  if (halfUnits < 0) {
    throw new Error('Half-units cannot be negative.');
  }
  return halfUnits;
};
