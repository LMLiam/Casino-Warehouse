import type { Rank } from './Rank';
import type { Suit } from './Suit';

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}
