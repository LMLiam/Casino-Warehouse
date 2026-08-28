import type { Card } from '../../cards/Card';

export type BeatTheHouseMainSettlementInput = {
  readonly mainStake: number;
  readonly playerFirstCard: Card;
  readonly playerMode: 'immediateLoss' | 'automaticWin' | 'compare';
  readonly playerFinalCard?: Card;
  readonly dealerFirstCard: Card;
  readonly dealerBust: boolean;
  readonly dealerFinalCard?: Card;
};
