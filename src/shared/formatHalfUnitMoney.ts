import type { HalfUnits } from '../game/beatTheHouse/HalfUnits';
import { asHalfUnits } from '../game/beatTheHouse/asHalfUnits';

export const formatHalfUnits = (value: HalfUnits, includePositiveSign = false): string => {
  const exactValue = asHalfUnits(value);
  const negative = exactValue < 0;
  const absoluteValue = negative ? -exactValue : exactValue;
  const remainder = absoluteValue % 2;
  const wholeCredits = (absoluteValue - remainder) / 2;
  const amount = `£${wholeCredits.toLocaleString('en-GB')}${remainder === 1 ? '.50' : ''}`;
  return `${negative ? '-' : includePositiveSign ? '+' : ''}${amount}`;
};
