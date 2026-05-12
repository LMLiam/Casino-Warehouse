import type { ChipValue } from './ChipValue';

export interface ChipBreakdown {
  readonly roundedAmount: number;
  readonly chips: ChipValue[];
}
