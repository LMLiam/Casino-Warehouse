import type { Card } from './Card';

export const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds';
