import type { Card } from './Card';
import { suitSymbols } from './suitSymbols';

export const cardLabel = (card: Card): string => `${card.rank}${suitSymbols[card.suit]}`;
