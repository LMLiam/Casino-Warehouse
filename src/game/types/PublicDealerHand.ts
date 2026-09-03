import type { Card } from '../cards/Card';

export interface PublicDealerHand {
  readonly cards: readonly Card[];
  readonly holeRevealed: boolean;
  readonly bust: boolean;
  readonly blackAce: boolean;
  readonly finalCard?: Card | undefined;
}
