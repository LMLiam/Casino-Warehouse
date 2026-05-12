import type { Card } from './Card';

export const isBlackAce = (card: Card | undefined): boolean => Boolean(card && card.rank === 'A' && (card.suit === 'spades' || card.suit === 'clubs'));
