import type { Card } from '../cards/Card';
import { bestTotal } from './bestTotal';
import { isSoft } from './isSoft';

export const dealerMustHit = (cards: readonly Card[]): boolean => {
  const total = bestTotal(cards);
  return total < 17 || (total === 17 && isSoft(cards));
};
