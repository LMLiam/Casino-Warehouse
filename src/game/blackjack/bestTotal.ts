import type { Card } from '../cards/Card';
import { blackjackValue } from './blackjackValue';

export const bestTotal = (cards: readonly Card[]): number => {
  let total = cards.reduce((sum, card) => sum + blackjackValue(card), 0);
  let aces = cards.filter((card) => card.rank === 'A').length;
  while (aces > 0 && total + 10 <= 21) {
    total += 10;
    aces -= 1;
  }
  return total;
};
