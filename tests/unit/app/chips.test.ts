import { describe, expect, it } from 'vitest';
import { chipCropByValue } from '../../../src/ui/chips/chipCropByValue';
import { chipCrops } from '../../../src/ui/chips/chipCrops';
import { chipSheetSize } from '../../../src/ui/chips/chipSheetSize';
import { chipValues } from '../../../src/ui/chips/chipValues';
import { toChipBreakdown } from '../../../src/ui/chips/toChipBreakdown';

describe('chip helpers', () => {
  it('maps every chip value to a spritesheet crop', () => {
    expect(chipCrops).toHaveLength(chipValues.length);
    expect(chipSheetSize).toEqual({ width: 1536, height: 1024 });

    for (const value of chipValues) {
      expect(chipCropByValue.get(value)).toMatchObject({ value, size: 384 });
    }
  });

  it('rounds amounts down, clamps negatives, and returns greedy chip breakdowns', () => {
    expect(toChipBreakdown(-25)).toEqual({ roundedAmount: 0, chips: [] });
    expect(toChipBreakdown(0.99)).toEqual({ roundedAmount: 0, chips: [] });
    expect(toChipBreakdown(138.75)).toEqual({ roundedAmount: 138, chips: [100, 25, 5, 5, 1, 1, 1] });
    expect(toChipBreakdown(16000)).toEqual({ roundedAmount: 16000, chips: [10000, 5000, 1000] });
  });
});
