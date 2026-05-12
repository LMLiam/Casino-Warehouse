import type { Card } from '../cards/Card';
import { blackjackValue } from './blackjackValue';

export const isSoft = (cards: readonly Card[]): boolean => {
  const hardTotal = cards.reduce((sum, card) => sum + blackjackValue(card), 0);
  return cards.some((card) => card.rank === 'A') && hardTotal + 10 <= 21;
};
