import type { Card } from '../cards/Card';
import { bestTotal } from './bestTotal';

export const dealerMustHit = (cards: readonly Card[]): boolean => {
  const total = bestTotal(cards);
  return total < 17;
};
