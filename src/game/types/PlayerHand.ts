import type { Card } from '../cards/Card';
import type { HandId } from './HandId';
import type { HandResult } from './HandResult';

export interface PlayerHand {
  readonly id: HandId;
  readonly cards: Card[];
  readonly done: boolean;
  readonly result?: HandResult;
  readonly automaticWin: boolean;
  readonly finalCard?: Card;
}
