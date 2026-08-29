import type { Card } from '../../cards/Card';
import type { HandResult } from '../../types/HandResult';
import type { BeatTheHouseSideBets } from './BeatTheHouseSideBets';

export type BeatTheHouseSideSettlementInput = {
  readonly sideBets: BeatTheHouseSideBets;
  readonly mainResult: HandResult;
  readonly playerFirstCard: Card;
  readonly playerFinalCard?: Card | undefined;
  readonly dealer: {
    readonly cards: readonly Card[];
    readonly bust: boolean;
    readonly blackAce: boolean;
    readonly finalCard?: Card | undefined;
  };
};
