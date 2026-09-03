import type { Rng } from '../rng/Rng';
import type { BeatTheHouseShoe } from '../beatTheHouse/shoe/BeatTheHouseShoe';

export interface GameOptions {
  readonly initialBankroll?: number;
  readonly rng?: Rng;
  readonly randomInt?: (maxExclusive: number) => number;
  readonly shoe?: BeatTheHouseShoe;
}
