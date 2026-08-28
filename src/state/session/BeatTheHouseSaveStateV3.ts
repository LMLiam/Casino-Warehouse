import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { BeatTheHouseShoeSaveState } from '../../game/beatTheHouse/shoe/BeatTheHouseShoeSaveState';

export type BeatTheHouseSaveStateV3 = Omit<GameSnapshot, 'lastEvents' | 'dealer' | 'shoe'> & {
  readonly dealer: GameSnapshot['dealer'];
  readonly shoe: BeatTheHouseShoeSaveState;
  readonly lastBets?: GameSnapshot['bets'];
};
