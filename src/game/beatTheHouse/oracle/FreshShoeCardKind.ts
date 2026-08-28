import type { Card } from '../../cards/Card';

export type FreshShoeCardKind = {
  readonly rank: Card['rank'];
  readonly suit: Card['suit'];
  readonly value: number;
  readonly copiesPerDeck: number;
  readonly isBlackAce: boolean;
};
