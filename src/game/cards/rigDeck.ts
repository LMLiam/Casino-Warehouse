import type { Card } from './Card';

export const rigDeck = (dealOrder: Card[]): Card[] => [...dealOrder].reverse();
