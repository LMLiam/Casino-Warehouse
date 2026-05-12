import type { Card } from '../cards/Card';
import type { Rng } from '../rng/Rng';

export interface GameOptions {
  readonly initialBankroll?: number;
  readonly rng?: Rng;
  readonly deck?: Card[];
}
