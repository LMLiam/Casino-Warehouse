import type { Card } from '../cards/Card';
import { bestTotal } from './bestTotal';

export const isBlackjack = (cards: readonly Card[]): boolean => cards.length === 2 && bestTotal(cards) === 21;
