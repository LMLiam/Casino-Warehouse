import type { Card } from '../cards/Card';
import { ranks } from '../cards/ranks';
import { suits } from '../cards/suits';

export const isCard = (card: Card | { readonly suit?: string; readonly rank?: string } | null): card is Card => {
  if (card === null || typeof card.suit !== 'string' || typeof card.rank !== 'string') {
    return false;
  }
  const isSuit = (value: string): value is Card['suit'] => suits.some((suit) => suit === value);
  const isRank = (value: string): value is Card['rank'] => ranks.some((rank) => rank === value);
  return isSuit(card.suit) && isRank(card.rank);
};
