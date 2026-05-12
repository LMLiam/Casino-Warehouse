import type { Card } from '../cards/Card';

export const isSoft = (cards: readonly Card[]): boolean => {
  const hardTotal = cards.reduce((sum, card) => sum + blackjackValue(card), 0);
  return cards.some((card) => card.rank === 'A') && hardTotal + 10 <= 21;
};

const blackjackValue = (card: Card): number => {
  if (card.rank === 'A') {
    return 1;
  }
  if (['K', 'Q', 'J'].includes(card.rank)) {
    return 10;
  }
  return Number(card.rank);
};
