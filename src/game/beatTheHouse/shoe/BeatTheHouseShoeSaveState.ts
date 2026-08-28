import type { Card } from '../../cards/Card';

export interface BeatTheHouseShoeSaveState {
  readonly remainingCards: readonly Card[];
  readonly totalCards: number;
  readonly cutThresholdCardsDealt: number;
  readonly shufflePending: boolean;
}
