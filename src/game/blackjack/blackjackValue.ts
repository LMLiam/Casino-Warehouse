import type { Card } from '../cards/Card';

export const blackjackValue = (card: Card): number => {
  if (card.rank === 'A') {
    return 1;
  }
  if (['K', 'Q', 'J'].includes(card.rank)) {
    return 10;
  }
  return Number(card.rank);
};
