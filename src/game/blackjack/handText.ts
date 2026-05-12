import type { Card } from '../cards/Card';
import { cardLabel } from '../cards/cardLabel';
import { bestTotal } from './bestTotal';

export const handText = (cards: readonly Card[]): string => `${cards.map(cardLabel).join(' ')} (${bestTotal(cards)})`;
