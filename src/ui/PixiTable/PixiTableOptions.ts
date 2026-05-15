import type { BetType } from '../../game/types/BetType';
import type { HandId } from '../../game/types/HandId';

export interface PixiTableOptions {
  readonly onBet: (handId: HandId, betType: BetType | 'dealerTip') => void;
}
