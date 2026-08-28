import type { Card } from '../cards/Card';

export interface DealerHand {
  readonly cards: Card[];
  readonly holeCard?: Card | undefined;
  readonly holeRevealed: boolean;
  readonly bust: boolean;
  readonly blackAce: boolean;
  readonly finalCard?: Card | undefined;
}
