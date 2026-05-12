import type { Card } from '../cards/Card';
import type { Rng } from '../rng/Rng';

export interface BlackjackTableOptions {
  readonly rng?: Rng;
  readonly deck?: readonly Card[];
}
