import type { Card } from '../cards/Card';
import type { Bets } from '../types/Bets';
import type { GameSnapshot } from '../types/GameSnapshot';

export interface BeatTheHouseSaveState extends Omit<GameSnapshot, 'lastEvents'> {
  readonly deck: readonly Card[];
  readonly lastBets?: Bets | undefined;
}
