import type { BetType } from '../types/BetType';

export const betTypeLabel = (betType: BetType): string =>
  ({
    main: 'Main',
    aceFlash: 'Ace Flash',
    dealerBust: 'Dealer Bust',
    matchPush: 'Match Push',
    dealerSevens: 'Dealer Sevens',
  })[betType];
