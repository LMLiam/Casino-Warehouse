import type { Card } from '../cards/Card';
import type { Rng } from '../rng/Rng';

export interface BlackjackOptions {
  readonly rng?: Rng;
  readonly deck?: Card[];
}
