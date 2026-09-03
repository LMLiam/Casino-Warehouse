import type { Bets } from '../types/Bets';
import type { DealerHand } from '../types/DealerHand';
import type { GameSnapshot } from '../types/GameSnapshot';
import type { BeatTheHouseShoeSaveState } from '../beatTheHouse/shoe/BeatTheHouseShoeSaveState';

export interface BeatTheHouseSaveState extends Omit<GameSnapshot, 'lastEvents' | 'dealer' | 'shoe'> {
  readonly shoe: BeatTheHouseShoeSaveState;
  readonly dealer: DealerHand;
  readonly lastBets?: Bets | undefined;
}
